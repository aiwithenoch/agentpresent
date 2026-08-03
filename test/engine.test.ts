import { describe, expect, it } from "vitest";
import {
  AgentPresent,
  haversineMeters,
  type Clock,
  type ReminderEvent,
} from "../src/index.js";

const HOME = { latitude: 5.6037, longitude: -0.1870 };

function createClock() {
  let now = 0;
  let sleeps = 0;

  const clock: Clock = {
    now: () => new Date(now),
    sleep: async (milliseconds, signal) => {
      if (signal?.aborted) throw signal.reason;
      sleeps += 1;
      now += milliseconds;
    },
  };

  return { clock, getSleeps: () => sleeps };
}

describe("AgentPresent", () => {
  it("returns immediately and triggers after arrival", async () => {
    const events: ReminderEvent[] = [];
    const locations = [
      { latitude: 5.55, longitude: -0.25, recordedAt: new Date(0) },
      { latitude: 5.59, longitude: -0.20, recordedAt: new Date(0) },
      { ...HOME, recordedAt: new Date(0) },
    ];
    let locationIndex = 0;
    const { clock, getSleeps } = createClock();

    const engine = new AgentPresent({
      location: {
        getCurrentLocation: async () => locations[Math.min(locationIndex++, locations.length - 1)]!,
      },
      places: { resolve: async () => HOME },
      routes: { estimate: async () => ({ durationSeconds: 600, calculatedAt: new Date(0) }) },
      notifier: { notify: async (event) => { events.push(event); } },
      telemetry: { record: async (event) => { events.push(event); } },
      clock,
    });

    const handle = engine.monitor({
      id: "medicine",
      message: "Take your medicine",
      destination: { type: "saved-place", placeId: "home" },
    });

    expect(handle.id).toBe("medicine");
    expect(engine.isMonitoring("medicine")).toBe(true);
    await expect(handle.completion).resolves.toEqual({ id: "medicine", state: "triggered" });
    expect(events.map((event) => event.state)).toEqual([
      "scheduled",
      "checking",
      "checking",
      "triggered",
      "triggered",
    ]);
    expect(getSleeps()).toBe(2);
  });

  it("retries a transient provider failure", async () => {
    const states: string[] = [];
    let attempts = 0;
    const { clock } = createClock();

    const engine = new AgentPresent({
      location: {
        getCurrentLocation: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error("temporary");
          return { ...HOME, recordedAt: new Date(1_000) };
        },
      },
      places: { resolve: async () => HOME },
      routes: { estimate: async () => ({ durationSeconds: 60, calculatedAt: new Date() }) },
      notifier: { notify: async () => undefined },
      telemetry: { record: async (event) => { states.push(event.state); } },
      errorClassifier: { isTransient: () => true },
      retryBaseDelayMs: 1_000,
      clock,
    });

    const result = await engine.monitor({
      id: "retry",
      message: "Retry",
      destination: { type: "saved-place", placeId: "home" },
    }).completion;

    expect(result.state).toBe("triggered");
    expect(states).toContain("retrying");
    expect(attempts).toBe(2);
  });

  it("emits cancelled when a monitor is cancelled", async () => {
    const states: string[] = [];
    const blockingClock: Clock = {
      now: () => new Date(),
      sleep: (_milliseconds, signal) => new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
    };

    const engine = new AgentPresent({
      location: { getCurrentLocation: async () => ({ latitude: 0, longitude: 0, recordedAt: new Date() }) },
      places: { resolve: async () => HOME },
      routes: { estimate: async () => ({ durationSeconds: 600, calculatedAt: new Date() }) },
      notifier: { notify: async () => undefined },
      telemetry: { record: async (event) => { states.push(event.state); } },
      clock: blockingClock,
    });

    const handle = engine.monitor({
      id: "cancel",
      message: "Cancel me",
      destination: { type: "saved-place", placeId: "home" },
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(handle.cancel()).toBe(true);
    await expect(handle.completion).resolves.toEqual({ id: "cancel", state: "cancelled" });
    expect(states).toContain("cancelled");
  });

  it("expires after the check budget", async () => {
    const { clock } = createClock();
    const engine = new AgentPresent({
      location: { getCurrentLocation: async () => ({ latitude: 0, longitude: 0, recordedAt: new Date(0) }) },
      places: { resolve: async () => HOME },
      routes: { estimate: async () => ({ durationSeconds: 600, calculatedAt: new Date(0) }) },
      notifier: { notify: async () => undefined },
      clock,
      minimumCheckIntervalMs: 1,
    });

    const result = await engine.monitor({
      id: "expire",
      message: "Expire",
      destination: { type: "saved-place", placeId: "home" },
      maximumChecks: 1,
    }).completion;

    expect(result.state).toBe("expired");
  });

  it("calculates a known haversine distance", () => {
    const distance = haversineMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    );
    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(112_000);
  });
});
