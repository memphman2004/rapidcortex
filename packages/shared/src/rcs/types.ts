/**
 * Response Continuity System (RCS) — life-safety call persistence types.
 * Silent monitor queue → unit geofence arrival confirmation → audio sentinel →
 * escalation engine → closure gate with supervisor override audit.
 * Addon: `rcs.module` ($3500/mo, `packages/shared/src/billing/addon-catalog.ts`).
 */

export const RCS_CALL_STATES = [
  "MONITORING",
  "UNIT_DISPATCHED",
  "UNIT_EN_ROUTE",
  "UNIT_ARRIVED",
  "AUDIO_ALERT",
  "ESCALATED",
  "SUPERVISOR_ACKNOWLEDGED",
  "CLOSED",
  "OVERRIDE_CLOSED",
] as const;
export type RcsCallState = (typeof RCS_CALL_STATES)[number];

/** Terminal states — no further mutation once reached. */
export const RCS_CLOSED_STATES: readonly RcsCallState[] = ["CLOSED", "OVERRIDE_CLOSED"];

export const RCS_ESCALATION_LEVELS = ["NONE", "LEVEL_1", "LEVEL_2", "LEVEL_3", "CRITICAL"] as const;
export type RcsEscalationLevel = (typeof RCS_ESCALATION_LEVELS)[number];

export const RCS_AUDIO_STATUSES = [
  "SILENT",
  "LISTENING",
  "ALERT",
  "CONFIRMED_SAFE",
  "CONFIRMED_DANGER",
] as const;
export type RcsAudioStatus = (typeof RCS_AUDIO_STATUSES)[number];

export interface RcsGeoPoint {
  latitude: number;
  longitude: number;
}

export interface RcsUnit {
  unitId: string;
  callSign?: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
  /** True once the unit has been confirmed within the call's arrival geofence. */
  onScene: boolean;
  distanceMeters?: number;
}

export interface RcsClosureOverride {
  byUserId: string;
  byBadge: string;
  reason: string;
  at: string;
}

export interface RcsCall {
  callId: string;
  agencyId: string;
  incidentId?: string;
  callerPhone?: string;
  state: RcsCallState;
  escalationLevel: RcsEscalationLevel;
  audioStatus: RcsAudioStatus;
  location?: RcsGeoPoint;
  /** Meters from `location` a unit must be within to be considered on-scene. */
  arrivalRadiusMeters: number;
  units: RcsUnit[];
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  assignedDispatcherId?: string;
  closedAt?: string;
  closedByUserId?: string;
  /** Present only when closed via supervisor override (state = OVERRIDE_CLOSED). */
  closureOverride?: RcsClosureOverride;
  supervisorAckByUserId?: string;
  supervisorAckAt?: string;
  notes?: string;
}

export interface RcsCallStartRequest {
  incidentId?: string;
  callerPhone?: string;
  location?: RcsGeoPoint;
  arrivalRadiusMeters?: number;
  notes?: string;
}

export interface RcsCallStateUpdateRequest {
  state: RcsCallState;
  notes?: string;
}

export interface RcsCallCloseRequest {
  /** Required to close a call that has not reached UNIT_ARRIVED. Dispatchers may not override. */
  supervisorOverride?: {
    badge: string;
    reason: string;
  };
}

export interface RcsAudioAlertRequest {
  audioStatus: RcsAudioStatus;
  detail?: string;
}

export interface RcsUnitPositionRequest {
  unitId: string;
  callSign?: string;
  latitude: number;
  longitude: number;
  /** When provided, the position is evaluated against this call's geofence. */
  callId?: string;
}

export interface RcsSupervisorAckRequest {
  note?: string;
}

/** EventBridge Scheduler payload delivered to the escalation trigger Lambda (no HTTP route). */
export interface RcsEscalationTriggerEvent {
  callId: string;
  agencyId: string;
  level: RcsEscalationLevel;
}
