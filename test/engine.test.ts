import { describe, expect, it } from "vitest";
import { AgentPresent, type Clock, type ReminderEvent } from "../src/index.js";

const HOME = { latitude: 5.6037, longitude: -0.1870 };

describe("AgentPresent", () => {
  it("rechecks context and triggers only after arrival", async () => {
    const events: ReminderEvent[] = [];
    const locations = [
      { latitude: 5.55, longitude: -0.25, recordedAt: new Date() },
      { latitude: 5.59, longitude: -0.20, recordedAt: new Date() },
      { ...HOME, recordedAt: new Date() },
    ];
    let locationIndex = 0;
    let sleeps = 0;

    const clock: Clock = {
      now: () => new Date(),
      sleep: async () => { sleeps += 1; },
    };

    const engine = new AgentPresent({
      location: {
        getCurrentLocation: async () => locations[Math.min(locationIndex++, locations.length - 1)]!,
      },
      places: {
        resolve: async () => HOME,
      },
      routes: {
        estimate: async () => ({ durationSeconds: 600, calculatedAt: new Date() }),
      },
      notifier: {
        notify: async (event) => { events.push(event); },
      },
      clock,
    });

    await engine.monitor({
      id: "medicine",
      message: "Take your medicine",
      destination: { type: "saved-place", placeId: "home" },
    });

    expect(events.map((event) => event.state)).toEqual([
      "scheduled",
      "checking",
      "checking",
      "triggered",
    ]);
    expect(sleeps).toBe(2);
  });
});
