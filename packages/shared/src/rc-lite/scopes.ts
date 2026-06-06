/** RC Lite OAuth/API key scopes — enforce per route alongside tenant isolation. */
export const RC_LITE_API_SCOPES = [
  "intelligence:write",
  "cad:write",
  "transcription:write",
  "translation:write",
  "caller_links:write",
  "media:write",
  "qa:write",
  "webhooks:manage",
  "usage:read",
  "audit_logs:read",
] as const;

export type RcLiteApiScope = (typeof RC_LITE_API_SCOPES)[number];
