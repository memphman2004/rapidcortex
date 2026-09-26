export {
  FEATURES_AUDIT_EVENT_TYPES,
  type FeaturesAuditEventTypeName,
} from "./features/audit-events.js";

/** Wyze Connect — consent-gated homeowner cameras. Merged into security AUDIT_EVENT_TYPES. */
export const WYZE_AUDIT_EVENT_TYPES = {
  WYZE_HOMEOWNER_REGISTERED: "wyze.homeowner.registered",
  WYZE_CAMERA_REQUEST_CREATED: "wyze.camera.request_created",
  WYZE_CAMERA_REQUEST_SENT: "wyze.camera.request_sent",
  WYZE_CAMERA_REQUEST_APPROVED: "wyze.camera.request_approved",
  WYZE_CAMERA_REQUEST_DECLINED: "wyze.camera.request_declined",
  WYZE_CAMERA_SESSION_STARTED: "wyze.camera.session_started",
} as const;

/** Google Nest SDM — agency OAuth + consent-gated homeowner cameras. */
export const NEST_AUDIT_EVENT_TYPES = {
  NEST_ACCOUNT_LINKED: "nest.account.linked",
  NEST_ACCOUNT_UNLINKED: "nest.account.unlinked",
  NEST_CITIZEN_REGISTERED: "nest.citizen.registered",
  NEST_CAMERA_REQUEST_CREATED: "nest.camera.request_created",
  NEST_CAMERA_REQUEST_SENT: "nest.camera.request_sent",
  NEST_CAMERA_REQUEST_APPROVED: "nest.camera.request_approved",
  NEST_CAMERA_REQUEST_DECLINED: "nest.camera.request_declined",
} as const;

/** Milestone XProtect — on-prem Bridge Protocol (MIP SDK / REST). */
export const MILESTONE_AUDIT_EVENT_TYPES = {
  MILESTONE_CONNECTED: "milestone.connected",
  MILESTONE_DISCONNECTED: "milestone.disconnected",
  MILESTONE_CAMERAS_SYNCED: "milestone.cameras.synced",
  MILESTONE_EVENT_SENT: "milestone.event.sent",
  MILESTONE_ALARM_SENT: "milestone.alarm.sent",
  MILESTONE_LIVE_TICKET: "milestone.live.ticket",
} as const;

export type NestAuditEventTypeName =
  (typeof NEST_AUDIT_EVENT_TYPES)[keyof typeof NEST_AUDIT_EVENT_TYPES];

export type WyzeAuditEventTypeName =
  (typeof WYZE_AUDIT_EVENT_TYPES)[keyof typeof WYZE_AUDIT_EVENT_TYPES];

export type MilestoneAuditEventTypeName =
  (typeof MILESTONE_AUDIT_EVENT_TYPES)[keyof typeof MILESTONE_AUDIT_EVENT_TYPES];
