# AgentPresent

**Open-source location-aware reminder infrastructure for proactive AI agents.**

AgentPresent lets an agent monitor a real-world condition such as:

> Remind me to take my medicine when I get home.

Instead of setting a timer for the first ETA, AgentPresent schedules internal context checks. It wakes up, reads the user's latest location, recalculates the ETA, adapts the next check, and only triggers the user-facing reminder after the arrival condition is true.

## Why AgentPresent?

Normal reminders are time-based. AgentPresent is state-based.

```text
User intent
   ↓
Resolve destination
   ↓
Read current location
   ↓
Check arrival radius
   ↓
Calculate live ETA
   ↓
Schedule an internal recheck
   ↓
Repeat until the condition is true
   ↓
Notify the agent/user
```

AgentPresent is a library, not a hosted app. Location data stays inside the developer's own agent and infrastructure.

## Status

Early MVP. The core adaptive monitoring loop and provider interfaces are implemented. Production persistence, provider packages, retries, and MCP support are next.

## Install

```bash
npm install agentpresent
```

Until the package is published, clone the repository and run:

```bash
npm install
npm run check
```

## Usage

```ts
import { AgentPresent } from "agentpresent";

const present = new AgentPresent({
  location: myLocationProvider,
  places: myPlaceProvider,
  routes: myRouteProvider,
  notifier: myAgentCallback,
});

await present.monitor({
  id: "medicine-at-home",
  message: "Take your medicine",
  destination: {
    type: "saved-place",
    placeId: "home",
  },
});
```

Your agent supplies four adapters:

- `LocationProvider`: returns the latest user coordinates.
- `PlaceProvider`: resolves `home`, `work`, or another saved place.
- `RouteProvider`: calculates a current travel ETA.
- `ReminderNotifier`: sends the final event back to the agent, notification system, or chat.

The core does not require Google Maps, Mapbox, or any specific vendor.

## Provider model

```ts
interface LocationProvider {
  getCurrentLocation(): Promise<LocationSnapshot>;
}

interface PlaceProvider {
  resolve(destination: Destination): Promise<Coordinates>;
}

interface RouteProvider {
  estimate(origin: Coordinates, destination: Coordinates): Promise<RouteEstimate>;
}

interface ReminderNotifier {
  notify(event: ReminderEvent): Promise<void>;
}
```

Possible adapters include Google Routes, Mapbox Directions, HERE, OpenRouteService, OSRM, Valhalla, browser geolocation, a mobile agent runtime, or a custom source.

## Adaptive checking

The first ETA is not treated as the reminder time. It is used to choose when the engine should investigate again.

```text
ETA: 55 minutes → internal recheck later
ETA: 18 minutes → check sooner
ETA: 4 minutes  → check frequently
Inside arrival radius → trigger reminder
```

This reduces unnecessary polling while adapting to traffic, route changes, stops, or delays.

## Privacy principles

- No AgentPresent cloud is required.
- Providers are injected by the developer.
- Raw location history does not need to be stored.
- Agent developers should request explicit location permission.
- Reminder events should explain why they triggered.
- Users must be able to cancel monitoring.

## Roadmap

- Persistent reminder store and process restarts
- Retry and provider fallback policies
- Google, Mapbox, OpenRouteService, and OSRM adapters
- Webhook and agent callback notifier
- MCP server/tool interface
- Natural-language intent parser
- Arrival, departure, nearby, route, and dwell triggers
- Battery/API-budget-aware scheduling
- Observability and audit events

## Development

```bash
npm install
npm run build
npm test
```

See [`examples/basic.ts`](examples/basic.ts) for a runnable provider-agnostic example.

## License

MIT
