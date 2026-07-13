export type RingConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";
export type RingDeviceType = "CAMERA" | "DOORBELL" | "UNKNOWN";
export type RingRequestStatus =
  | "DRAFT"
  | "SENT"
  | "OPENED"
  | "APPROVED"
  | "DECLINED"
  | "EXPIRED"
  | "REVOKED";
export type RingStreamStatus = "PENDING" | "ACTIVE" | "STOPPED" | "EXPIRED" | "ERROR";
export type RingRequestDurationMinutes = 10 | 30 | 60 | 120;

export interface LinkedRingAccount {
  agencyId: string;
  userId: string;
  ringAccountId: string;
  connectionStatus: RingConnectionStatus;
  scopes: string[];
  secretsManagerTokenKey: string;
  createdAt: string;
  updatedAt: string;
  lastTokenRefreshAt: string | null;
}

export interface LinkedRingDevice {
  agencyId: string;
  userId: string;
  ringAccountId: string;
  deviceId: string;
  deviceName: string;
  deviceType: RingDeviceType;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  isEnabledForConnect: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RingEmergencyCameraRequest {
  requestId: string;
  agencyId: string;
  jurisdictionId: string;
  incidentId: string;
  requestedByUserId: string;
  ringAccountId: string;
  deviceId: string;
  deviceName: string;
  deviceType: RingDeviceType;
  incidentLatitude: number;
  incidentLongitude: number;
  deviceLatitude: number;
  deviceLongitude: number;
  distanceMeters: number;
  requestStatus: RingRequestStatus;
  requestedDurationMinutes: RingRequestDurationMinutes;
  approvedDurationMinutes: RingRequestDurationMinutes | null;
  requestTokenHash: string;
  createdAt: string;
  expiresAt: string;
  approvedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
  /** Set when consent link is consumed (approve/decline). */
  usedAt: string | null;
  /**
   * bcrypt hash of owner stop token included in the original SMS.
   * Used for mid-session revoke and pre-approve cancel.
   */
  stopTokenHash?: string | null;
}

export interface RingEmergencyCameraSession {
  sessionId: string;
  requestId: string;
  agencyId: string;
  jurisdictionId: string;
  incidentId: string;
  deviceId: string;
  streamStatus: RingStreamStatus;
  startedAt: string;
  expiresAt: string;
  stoppedAt: string | null;
  stoppedBy: string | null;
  streamProvider: string | null;
  streamReference: string | null;
  /** bcrypt hash for owner-initiated revoke (`revokeToken` in request body). */
  revokeTokenHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RingOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

export interface RingOAuthState {
  agencyId: string;
  userId: string;
  nonce: string;
  createdAt: number;
  /** Ring Appstore return URL — redirect here after successful account link. */
  ringReturnUrl?: string | null;
  /** Optional US state / DC for device-owner pre-registration matching. */
  usState?: string | null;
}

/** Ephemeral OAuth state for citizen (non-Cognito) Ring linking. */
export interface RingCitizenOAuthState {
  agencyId: string;
  nonce: string;
  createdAt: number;
  flow: "citizen";
}

export interface RingCitizenOwnerRecord {
  pk: string;
  ringAccountId: string;
  agencyId: string;
  name?: string;
  phone?: string;
  email?: string;
  deviceIds: string[];
  secretsManagerTokenKey: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pre-registration / device-owner enrollment record.
 * `agencyId` is omitted when the owner signed up before a local PSAP enrolled (sparse GSI).
 * `state` (US abbreviation) enables matching via state-index when a PSAP goes live.
 */
export interface RingHomeownerParticipantRecord {
  homeownerId: string;
  ringAccountId: string;
  /** Present when linked to an enrolled agency; omitted for state-only pre-registration. */
  agencyId?: string;
  /** US state / DC abbreviation for future PSAP matching. */
  state?: string;
  deviceCount: number;
  deviceIds: string[];
  secretsManagerTokenKey: string;
  consentGiven: boolean;
  name?: string;
  phone?: string;
  email?: string;
  registeredAt: string;
  updatedAt: string;
  /** Optional TTL epoch seconds (unused for active enrollments). */
  ttl?: number;
}

export interface RingCameraListItem {
  deviceId: string;
  deviceName: string;
  deviceType: RingDeviceType;
  distanceMeters: number;
  ownerStatus: RingRequestStatus | "AVAILABLE";
  /** Present when ownerStatus is APPROVED and a KVS session exists. */
  streamSessionId?: string;
  streamReference?: string | null;
}
