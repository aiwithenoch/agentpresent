export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type LocationSnapshot = Coordinates & {
  recordedAt: Date;
  accuracyMeters?: number;
};

export type Destination =
  | { type: "coordinates"; coordinates: Coordinates; label?: string }
  | { type: "saved-place"; placeId: string };

export type ReminderIntent = {
  id: string;
  message: string;
  destination: Destination;
  arrivalRadiusMeters?: number;
  metadata?: Record<string, unknown>;
};

export type RouteEstimate = {
  durationSeconds: number;
  distanceMeters?: number;
  calculatedAt: Date;
};

export type ReminderState =
  | "scheduled"
  | "checking"
  | "triggered"
  | "cancelled"
  | "failed";

export type ReminderEvent = {
  intent: ReminderIntent;
  state: ReminderState;
  location?: LocationSnapshot;
  estimate?: RouteEstimate;
  reason?: string;
};
