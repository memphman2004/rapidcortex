/**
 * Ring Connect audit event vocabulary (Prompt 1 foundation).
 * Merged into `AUDIT_EVENT_TYPES` in `rapid-cortex-security`.
 */
export const RING_AUDIT_EVENT_TYPES = {
  // Ring Integration — OAuth + Account
  RING_OAUTH_INITIATED: "ring.oauth.initiated",
  RING_OAUTH_STATE_MISMATCH: "ring.oauth.state_mismatch",
  RING_TOKEN_EXCHANGE_FAILED: "ring.token.exchange_failed",
  RING_TOKEN_REFRESHED: "ring.token.refreshed",
  RING_TOKEN_REFRESH_FAILED: "ring.token.refresh_failed",
  RING_ACCOUNT_LINKED: "ring.account.linked",
  RING_ACCOUNT_UNLINKED: "ring.account.unlinked",

  // Ring Integration — Devices
  RING_DEVICES_LISTED: "ring.devices.listed",
  RING_DEVICES_REFRESHED: "ring.devices.refreshed",

  // Ring Connect — Emergency Collaboration
  AVAILABLE_RING_CAMERAS_VIEWED: "ring.cameras.available_viewed",
  RING_CAMERA_REQUEST_CREATED: "ring.camera.request_created",
  RING_CAMERA_REQUEST_SENT: "ring.camera.request_sent",
  RING_CAMERA_REQUEST_OPENED: "ring.camera.request_opened",
  RING_CAMERA_REQUEST_APPROVED: "ring.camera.request_approved",
  RING_CAMERA_REQUEST_DECLINED: "ring.camera.request_declined",
  RING_CAMERA_SESSION_STARTED: "ring.camera.session_started",
  RING_CAMERA_SESSION_REVOKED: "ring.camera.session_revoked",
  RING_CAMERA_SESSION_EXPIRED: "ring.camera.session_expired",
} as const;

export type RingAuditEventTypeName =
  (typeof RING_AUDIT_EVENT_TYPES)[keyof typeof RING_AUDIT_EVENT_TYPES];
