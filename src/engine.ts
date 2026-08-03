import type { Clock, LocationProvider, PlaceProvider, ReminderNotifier, RouteProvider } from "./providers.js";
import { systemClock } from "./providers.js";
import type { Coordinates, ReminderEvent, ReminderIntent } from "./types.js";

export type AgentPresentOptions = {
  location: LocationProvider;
  places: PlaceProvider;
  routes: RouteProvider;
  notifier: ReminderNotifier;
  clock?: Clock;
  minimumCheckIntervalMs?: number;
  maximumCheckIntervalMs?: number;
};

export class AgentPresent {
  private readonly controllers = new Map<string, AbortController>();
  private readonly clock: Clock;
  private readonly minimumCheckIntervalMs: number;
  private readonly maximumCheckIntervalMs: number;

  constructor(private readonly options: AgentPresentOptions) {
    this.clock = options.clock ?? systemClock;
    this.minimumCheckIntervalMs = options.minimumCheckIntervalMs ?? 30_000;
    this.maximumCheckIntervalMs = options.maximumCheckIntervalMs ?? 30 * 60_000;
  }

  async monitor(intent: ReminderIntent): Promise<void> {
    if (this.controllers.has(intent.id)) throw new Error(`Reminder ${intent.id} is already active.`);
    const controller = new AbortController();
    this.controllers.set(intent.id, controller);

    try {
      await this.emit({ intent, state: "scheduled", reason: "Monitoring started." });
      const destination = await this.options.places.resolve(intent.destination);
      await this.runLoop(intent, destination, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) {
        await this.emit({
          intent,
          state: "failed",
          reason: error instanceof Error ? error.message : "Unknown monitoring error.",
        });
      }
    } finally {
      this.controllers.delete(intent.id);
    }
  }

  cancel(id: string): boolean {
    const controller = this.controllers.get(id);
    if (!controller) return false;
    controller.abort(new Error("Reminder cancelled."));
    this.controllers.delete(id);
    return true;
  }

  isMonitoring(id: string): boolean {
    return this.controllers.has(id);
  }

  private async runLoop(intent: ReminderIntent, destination: Coordinates, signal: AbortSignal): Promise<void> {
    const radius = intent.arrivalRadiusMeters ?? 120;

    while (!signal.aborted) {
      const location = await this.options.location.getCurrentLocation();
      const directDistance = haversineMeters(location, destination);

      if (directDistance <= radius) {
        await this.emit({ intent, state: "triggered", location, reason: `Arrived within ${Math.round(directDistance)}m.` });
        return;
      }

      const estimate = await this.options.routes.estimate(location, destination);
      await this.emit({ intent, state: "checking", location, estimate, reason: "Context re-evaluated." });
      await this.clock.sleep(this.nextCheckDelay(estimate.durationSeconds), signal);
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

  private emit(event: ReminderEvent): Promise<void> {
    return this.options.notifier.notify(event);
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
