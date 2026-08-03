# AgentPresent

Open-source, location-aware reminder infrastructure for proactive AI agents.

AgentPresent lets an AI agent monitor real-world conditions such as:

> Remind me to take my medicine when I get home.

Instead of treating the first estimated arrival time as the reminder time, AgentPresent uses that ETA to schedule an internal check. It wakes up, reads the latest location, recalculates the ETA, chooses the next check time, and only sends the reminder when the arrival condition is actually true.

## How it works

```text
User gives the agent an intent
        |
        v
AgentPresent resolves the destination
        |
        v
Reads the user's current location
        |
        v
Checks whether the user has arrived
        |
        v
Calculates a live route ETA
        |
        v
Schedules an internal recheck
        |
        v
Repeats until the condition is true
        |
        v
Sends the reminder back to the AI agent
```

AgentPresent is a library, not a hosted application. Developers run it inside their own agent and infrastructure. AgentPresent does not require users to send location data to an AgentPresent server.

## Project status

AgentPresent is currently an early TypeScript MVP.

The repository includes:

- An adaptive location-monitoring loop
- Arrival-radius detection
- ETA-based recheck scheduling
- Cancellation support
- Provider interfaces
- A runnable example
- Unit tests
- GitHub Actions CI

## Install

The package is not published to npm yet. Clone the repository:

```bash
git clone https://github.com/aiwithenoch/agentpresent.git
cd agentpresent
npm install
npm run check
```

After an npm release, installation will be:

```bash
npm install agentpresent
```

## Basic usage

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

## Provider architecture

AgentPresent does not force developers to use one maps or location company. Developers inject providers that match these interfaces.

```ts
interface LocationProvider {
  getCurrentLocation(): Promise<LocationSnapshot>;
}

interface PlaceProvider {
  resolve(destination: Destination): Promise<Coordinates>;
}

interface RouteProvider {
  estimate(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<RouteEstimate>;
}

interface ReminderNotifier {
  notify(event: ReminderEvent): Promise<void>;
}
```

### LocationProvider

Returns the user's latest coordinates. The data may come from a phone agent runtime, browser geolocation, wearable, vehicle, custom device, or another trusted source.

### PlaceProvider

Resolves a saved or named destination such as `home`, `work`, or `pharmacy` into coordinates.

### RouteProvider

Returns an updated travel ETA. Possible adapters include:

- Google Routes
- Mapbox Directions
- HERE Routing
- OpenRouteService
- OSRM
- Valhalla
- GraphHopper
- A custom routing service

### ReminderNotifier

Returns the final reminder event to the developer's AI agent, notification layer, webhook, chat system, or other callback.

## Adaptive checking

The initial ETA is not the notification deadline. It only helps the engine decide when to investigate again.

```text
ETA 55 minutes -> schedule a later internal check
ETA 18 minutes -> check sooner
ETA 4 minutes  -> check frequently
User arrives   -> trigger the reminder
```

This allows the reminder to adapt when traffic changes, the user stops somewhere, the route changes, or the first ETA is wrong.

## Example scenario

The user says:

> Remind me to take medicine when I get home.

AgentPresent can perform this sequence:

1. Resolve the user's saved home coordinates.
2. Read the user's current location.
3. Calculate an ETA of 55 minutes.
4. Schedule an internal check before the expected arrival.
5. Wake up and request fresh location and ETA information.
6. Continue adapting the check interval as the user gets closer.
7. Confirm the user is within the configured arrival radius.
8. Send `Take your medicine` back to the AI agent.

## Privacy principles

- No AgentPresent cloud service is required.
- Provider credentials belong to the developer.
- Raw location history does not need to be stored.
- Location access should require clear user permission.
- Users should be able to inspect and cancel active monitors.
- Reminder events should explain why they were triggered.

## Roadmap

- Persistent reminder storage
- Recovery after process restarts
- Provider retry and fallback policies
- Google Routes adapter
- Mapbox adapter
- OpenRouteService adapter
- OSRM adapter
- MCP server and tools
- Natural-language intent parsing
- Departure, nearby, dwell, and route triggers
- API-budget-aware scheduling
- Audit events and observability

## Development

```bash
npm install
npm run build
npm test
npm run check
```

A provider-agnostic example is available in [`examples/basic.ts`](examples/basic.ts).

## Contributing

Contributions, provider adapters, bug reports, and design discussions are welcome. Open an issue before beginning a large change so the architecture can be discussed first.

## License

MIT
