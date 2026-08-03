import type { Coordinates, Destination, LocationSnapshot, ReminderEvent, RouteEstimate } from "./types.js";

export interface LocationProvider {
  getCurrentLocation(): Promise<LocationSnapshot>;
}

export interface PlaceProvider {
  resolve(destination: Destination): Promise<Coordinates>;
}

export interface RouteProvider {
  estimate(origin: Coordinates, destination: Coordinates): Promise<RouteEstimate>;
}

export interface ReminderNotifier {
  notify(event: ReminderEvent): Promise<void>;
}

export interface Clock {
  now(): Date;
  sleep(milliseconds: number, signal?: AbortSignal): Promise<void>;
}

export const systemClock: Clock = {
  now: () => new Date(),
  sleep: (milliseconds, signal) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason ?? new Error("Aborted"));
        return;
      }
      const timer = setTimeout(resolve, milliseconds);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(signal.reason ?? new Error("Aborted"));
        },
        { once: true },
      );
    }),
};
