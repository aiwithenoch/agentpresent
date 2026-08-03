import {
  AgentPresent,
  type LocationProvider,
  type PlaceProvider,
  type ReminderNotifier,
  type RouteProvider,
  type TelemetrySink,
} from "../src/index.js";

const HOME = { latitude: 5.6037, longitude: -0.1870 };
let step = 0;

const location: LocationProvider = {
  async getCurrentLocation() {
    const samples = [
      { latitude: 5.5600, longitude: -0.2300 },
      { latitude: 5.5900, longitude: -0.2000 },
      HOME,
    ];
    const current = samples[Math.min(step++, samples.length - 1)]!;
    return { ...current, recordedAt: new Date(), accuracyMeters: 10 };
  },
};

const places: PlaceProvider = {
  async resolve(destination) {
    if (destination.type === "coordinates") return destination.coordinates;
    if (destination.placeId === "home") return HOME;
    throw new Error(`Unknown place: ${destination.placeId}`);
  },
};

const routes: RouteProvider = {
  async estimate(origin, destination) {
    const roughDistance = Math.hypot(
      origin.latitude - destination.latitude,
      origin.longitude - destination.longitude,
    );
    return {
      durationSeconds: Math.max(30, Math.round(roughDistance * 25_000)),
      calculatedAt: new Date(),
    };
  },
};

const notifier: ReminderNotifier = {
  async notify(event) {
    console.log(`REMINDER: ${event.intent.message}`);
  },
};

const telemetry: TelemetrySink = {
  async record(event) {
    console.log(`[${event.state}] ${event.reason ?? ""}`);
  },
};

const agentPresent = new AgentPresent({
  location,
  places,
  routes,
  notifier,
  telemetry,
  minimumCheckIntervalMs: 100,
  maximumCheckIntervalMs: 500,
});

const handle = agentPresent.monitor({
  id: "medicine-at-home",
  message: "Take your medicine",
  destination: { type: "saved-place", placeId: "home" },
  maximumDurationMs: 10_000,
});

console.log(`Started ${handle.id} without blocking the agent.`);
console.log("Final result:", await handle.completion);
