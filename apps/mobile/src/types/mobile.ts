/** Rapid Cortex mobile domain types — Safe & Sound, Guardian, Venue/Campus codes. */

export type ReportType = 'anonymous' | 'identified' | 'both';
export type CodeVertical = 'venue' | 'campus';
export type CodeStatus = 'active' | 'inactive';

export interface NFCWriteEvent {
  eventId: string;
  codeId: string;
  writtenBy: string;
  writtenByName?: string | null;
  devicePlatform: 'ios' | 'android';
  writeMethod: 'native_nfc';
  bytesWritten: number;
  tagType?: string | null;
  writtenAt: string;
}

export interface RCCodeMetrics {
  nfcTaps: number;
  qrScans: number;
  lastNfcTap?: string | null;
  lastQrScan?: string | null;
}

export interface RCCode {
  codeId: string;
  agencyId: string;
  name: string;
  zone: string;
  reportType: ReportType;
  vertical: CodeVertical;
  smsNumber?: string | null;
  reportUrl: string;
  nfcUrl: string;
  status: CodeStatus;
  nfcWriteLog: NFCWriteEvent[];
  metrics: RCCodeMetrics;
  createdAt: string;
  updatedAt: string;
}

export type SSDeviceType = 'home' | 'guardian';
export type SSDeviceStatus = 'online' | 'offline' | 'lost';

export interface SSDevice {
  deviceId: string;
  ownerId: string;
  name: string;
  type: SSDeviceType;
  mountType: string;
  bleAddress?: string | null;
  serialNumber?: string | null;
  status: SSDeviceStatus;
  lostModeActive: boolean;
  lastSeenAt?: string | null;
  batteryPct?: number | null;
  rcCoreConsent: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LocationSource =
  | 'gps'
  | 'cellular'
  | 'bluetooth'
  | 'community'
  | 'phone_gps';

export interface LocationSnapshot {
  lat: number;
  lng: number;
  accuracy?: number | null;
  altitude?: number | null;
  address?: string | null;
  source: LocationSource;
  timestamp: string;
}

export interface SSLocationEvent {
  eventId: string;
  deviceId: string;
  location: LocationSnapshot;
  recordedAt: string;
}

export type GeofenceShape = 'circle' | 'polygon';

export interface SSGeofenceSchedule {
  enabled: boolean;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface SSGeofence {
  geofenceId: string;
  deviceId: string;
  name: string;
  shape: GeofenceShape;
  centerLat?: number | null;
  centerLng?: number | null;
  radiusMeters?: number | null;
  polygonCoordinates?: Array<{ lat: number; lng: number }> | null;
  alertOnEnter: boolean;
  alertOnExit: boolean;
  schedule?: SSGeofenceSchedule | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyContact {
  contactId: string;
  ownerId: string;
  name: string;
  phone: string;
  relationship: string;
  notifyViaPush: boolean;
  notifyViaSMS: boolean;
  notifyViaCall: boolean;
  canCancelAlert: boolean;
  preferredLanguage: string | null;
  preferredLanguageName: string | null;
  preferredLanguageRTL: boolean;
}

export type GuardianDetectionType =
  | 'fall'
  | 'immobility'
  | 'cardiac_distress'
  | 'sos';

export type EmergencyStatus =
  | 'DETECTED'
  | 'COUNTDOWN_ACTIVE'
  | 'CANCELLED'
  | 'CONTACTS_NOTIFIED'
  | 'INCIDENT_CREATED'
  | 'ESCALATION_INITIATED'
  | 'ESCALATION_CONNECTED';

export interface StatusTransition {
  status: EmergencyStatus;
  transitionedAt: string;
  detail?: string | null;
}

export interface SensorSnapshot {
  heartRateBpm?: number | null;
  motionDetected?: boolean | null;
  fallConfidence?: number | null;
  immobilityMinutes?: number | null;
}

export type WearerLanguageSource = 'user_preference' | 'device_locale' | null;

export interface GuardianEmergencyEvent {
  eventId: string;
  deviceId: string;
  ownerId: string;
  detectionType: GuardianDetectionType;
  detectionConfidence: number;
  detectedAt: string;
  cancelWindowExpiresAt: string;
  status: EmergencyStatus;
  statusHistory: StatusTransition[];
  location: LocationSnapshot;
  sensorSnapshot: SensorSnapshot;
  batteryPct: number;
  wearerLanguage: string | null;
  wearerLanguageName: string | null;
  wearerLanguageRTL: boolean;
  wearerLanguageSource: WearerLanguageSource;
  cancelledAt?: string;
  cancelledBy?: string;
  incidentId?: string;
  auditHash: string;
}

export type SSSubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'trialing'
  | 'incomplete';

export interface SSSubscription {
  subscriptionId: string;
  deviceId: string;
  deviceSerial: string;
  status: SSSubscriptionStatus;
  amountCents: number;
  currency: string;
  interval: 'month';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCodePayload {
  agencyId: string;
  name: string;
  zone: string;
  reportType: ReportType;
  vertical: CodeVertical;
  smsNumber?: string | null;
}

export interface RegisterDevicePayload {
  deviceId: string;
  type: SSDeviceType;
  bleAddress?: string;
  name: string;
  mountType: string;
  serialNumber?: string;
}

export interface CreateGeofencePayload {
  name: string;
  shape: GeofenceShape;
  centerLat?: number;
  centerLng?: number;
  radiusMeters?: number;
  polygonCoordinates?: Array<{ lat: number; lng: number }>;
  alertOnEnter: boolean;
  alertOnExit: boolean;
  schedule?: SSGeofenceSchedule | null;
}

export interface RCLanguage {
  code: string;
  name: string;
  nativeName?: string;
  direction: 'ltr' | 'rtl';
  capabilities: {
    speechToText: boolean;
    translation: boolean;
  };
}

export interface LanguageRegistryResponse {
  ok: boolean;
  primaryProvider: string;
  fallbackProvider: string;
  count: number;
  languages: RCLanguage[];
}

export interface AgencySummary {
  agencyId: string;
  name: string;
  agencyType?: string | null;
  vertical?: string | null;
  jurisdictionSlug?: string | null;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}
