import type {
  Clock,
  ErrorClassifier,
  LocationProvider,
  PlaceProvider,
  ReminderNotifier,
  RouteProvider,
  TelemetrySink,
} from "./providers.js";
import { systemClock } from "./providers.js";
import type {
  Coordinates,
  LocationSnapshot,
  MonitorHandle,
  MonitorResult,
  ReminderEvent,
  ReminderIntent,
} from "./types.js";

export type AgentPresentOptions = {
  location: LocationProvider;
  places: PlaceProvider;
  routes: RouteProvider;
  notifier: ReminderNotifier;
  telemetry?: TelemetrySink;
  errorClassifier?: ErrorClassifier;
  clock?: Clock;
  minimumCheckIntervalMs?: number;
  maximumCheckIntervalMs?: number;
  retryBaseDelayMs?: number;
  retryMaximumDelayMs?: number;
  maximumRetryAttempts?: number;
  defaultMaximumDurationMs?: number;
  defaultMaximumChecks?: number;
};

type ActiveMonitor = {
  controller: AbortController;
  intent: ReminderIntent;
};

export class AgentPresent {
  private readonly monitors = new Map<string, ActiveMonitor>();
  private readonly clock: Clock;
  private readonly minimumCheckIntervalMs: number;
  private readonly maximumCheckIntervalMs: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaximumDelayMs: number;
  private readonly maximumRetryAttempts: number;
  private readonly defaultMaximumDurationMs: number;
  private readonly defaultMaximumChecks: number;

  constructor(private readonly options: AgentPresentOptions) {
    this.clock = options.clock ?? systemClock;
    this.minimumCheckIntervalMs = options.minimumCheckIntervalMs ?? 30_000;
    this.maximumCheckIntervalMs = options.maximumCheckIntervalMs ?? 30 * 60_000;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1_000;
    this.retryMaximumDelayMs = options.retryMaximumDelayMs ?? 60_000;
    this.maximumRetryAttempts = options.maximumRetryAttempts ?? 5;
    this.defaultMaximumDurationMs = options.defaultMaximumDurationMs ?? 24 * 60 * 60_000;
    this.defaultMaximumChecks = options.defaultMaximumChecks ?? 500;
  }

  monitor(intent: ReminderIntent): MonitorHandle {
    if (this.monitors.has(intent.id)) throw new Error(`Reminder ${intent.id} is already active.`);

    const controller = new AbortController();
    this.monitors.set(intent.id, { controller, intent });

    const completion = this.run(intent, controller).finally(() => {
      this.monitors.delete(intent.id);
    });

    return {
      id: intent.id,
      completion,
      cancel: () => this.cancel(intent.id),
    };
  }

  cancel(id: string): boolean {
    const active = this.monitors.get(id);
    if (!active) return false;
    active.controller.abort(new Error("Reminder cancelled."));
    return true;
  }

  isMonitoring(id: string): boolean {
    return this.monitors.has(id);
  }

  private async run(intent: ReminderIntent, controller: AbortController): Promise<MonitorResult> {
    const signal = controller.signal;

    try {
      await this.record({ intent, state: "scheduled", reason: "Monitoring started." });
      const destination = await this.withRetry(intent, signal, () => this.options.places.resolve(intent.destination));
      return await this.runLoop(intent, destination, signal);
    } catch (error) {
      if (signal.aborted) {
        const event: ReminderEvent = { intent, state: "cancelled", reason: "Monitoring cancelled." };
        await this.record(event);
        return { id: intent.id, state: "cancelled" };
      }

      const event: ReminderEvent = {
        intent,
        state: "failed",
        reason: error instanceof Error ? error.message : "Unknown monitoring error.",
      };
      await this.record(event);
      return { id: intent.id, state: "failed" };
    }
  }

  private async runLoop(intent: ReminderIntent, destination: Coordinates, signal: AbortSignal): Promise<MonitorResult> {
    const radius = intent.arrivalRadiusMeters ?? 120;
    const startedAt = this.clock.now().getTime();
    const maximumDurationMs = intent.maximumDurationMs ?? this.defaultMaximumDurationMs;
    const maximumChecks = intent.maximumChecks ?? this.defaultMaximumChecks;
    let checks = 0;

    while (!signal.aborted) {
      if (this.clock.now().getTime() - startedAt >= maximumDurationMs || checks >= maximumChecks) {
        const event: ReminderEvent = { intent, state: "expired", reason: "Monitoring limit reached before arrival." };
        await this.record(event);
        return { id: intent.id, state: "expired" };
      }

      const location = await this.withRetry(intent, signal, () => this.options.location.getCurrentLocation());
      this.validateLocation(intent, location);
      checks += 1;

      const directDistance = haversineMeters(location, destination);
      if (directDistance <= radius) {
        const event: ReminderEvent = {
          intent,
          state: "triggered",
          location,
          reason: `Arrived within ${Math.round(directDistance)}m using straight-line distance.`,
        };
        await this.options.notifier.notify(event);
        await this.record(event);
        return { id: intent.id, state: "triggered" };
      }

      const estimate = await this.withRetry(intent, signal, () => this.options.routes.estimate(location, destination));
      await this.record({ intent, state: "checking", location, estimate, reason: "Context re-evaluated." });
      await this.clock.sleep(this.nextCheckDelay(estimate.durationSeconds), signal);
    }

    throw signal.reason ?? new Error("Monitoring aborted.");
  }

  private async withRetry<T>(intent: ReminderIntent, signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        if (signal.aborted) throw error;
        attempt += 1;
        const transient = this.options.errorClassifier?.isTransient(error) ?? true;
        if (!transient || attempt > this.maximumRetryAttempts) throw error;

        const delay = Math.min(this.retryMaximumDelayMs, this.retryBaseDelayMs * 2 ** (attempt - 1));
        await this.record({
          intent,
          state: "retrying",
          attempt,
          reason: `Transient provider error; retrying in ${delay}ms.`,
        });
        await this.clock.sleep(delay, signal);
      }
    }
  }

  private validateLocation(intent: ReminderIntent, location: LocationSnapshot): void {
    const maximumAge = intent.maximumLocationAgeMs;
    if (maximumAge !== undefined) {
      const age = this.clock.now().getTime() - location.recordedAt.getTime();
      if (age > maximumAge) throw new Error(`Location snapshot is stale by ${age}ms.`);
    }

    const maximumAccuracy = intent.maximumAccuracyMeters;
    if (
      maximumAccuracy !== undefined &&
      location.accuracyMeters !== undefined &&
      location.accuracyMeters > maximumAccuracy
    ) {
      throw new Error(`Location accuracy ${location.accuracyMeters}m exceeds ${maximumAccuracy}m.`);
    }
  }

  private nextCheckDelay(etaSeconds: number): number {
    const etaMs = Math.max(0, etaSeconds * 1_000);
    const adaptive = etaMs > 60 * 60_000 ? etaMs * 0.5
      : etaMs > 20 * 60_000 ? etaMs * 0.4
      : etaMs > 5 * 60_000 ? etaMs * 0.3
      : etaMs > 60_000 ? etaMs * 0.2
      : this.minimumCheckIntervalMs;

    return Math.min(this.maximumCheckIntervalMs, Math.max(this.minimumCheckIntervalMs, Math.round(adaptive)));
  }

  private async record(event: ReminderEvent): Promise<void> {
    await this.options.telemetry?.record(event);
  }
}

export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const earthRadius = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
