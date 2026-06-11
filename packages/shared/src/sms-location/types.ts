export type LocationTokenStatus = "PENDING" | "RECEIVED" | "DENIED" | "EXPIRED";

export type LocationSource = "GPS" | "CELL_TOWER" | "MANUAL";

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
}

export interface LocationTokenRecord {
  token: string;
  incidentId: string;
  agencyId: string;
  /** SHA-256 hash of E.164 phone — never plain text. */
  phoneHash: string;
  vertical: "campus" | "venue" | "911";
  status: LocationTokenStatus;
  source?: LocationSource;
  coordinates?: LocationCoordinates;
  locationText?: string;
  createdAt: string;
  receivedAt?: string;
  ttl: number;
}

export interface LocateTokenPublicView {
  valid: boolean;
  status: LocationTokenStatus;
  vertical: "campus" | "venue" | "911";
}

export interface LocateSubmitBody {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  altitude?: number;
  locationText?: string;
  source?: LocationSource;
}

export interface IncidentLocationEntry {
  source: LocationSource;
  accuracyMeters?: number;
  receivedAt: string;
  locationText?: string;
  coordinates?: LocationCoordinates;
}
