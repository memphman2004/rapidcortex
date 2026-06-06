/**
 * Structured audit events for sensitive API and admin actions.
 * Wire `logAuditEvent` to your log store / SIEM in production; here it is a safe server stub.
 */

export type AuditAction =
  | "user_login"
  | "role_change"
  | "feature_enable"
  | "feature_disable"
  | "addon_enablement"
  | "agency_config_change"
  | "cad_health_check"
  | "cad_incident_read"
  | "cad_draft_update"
  | "cad_approved_write_attempt"
  | "cad_write_success"
  | "cad_write_failure"
  | "media_upload"
  | "media_access"
  | "media_retention_change"
  | "translation_request"
  | "text_to_voice_request"
  | "ai_triage_request"
  | "ai_summary_create"
  | "qa_review_create"
  | "scorecard_create"
  | "coaching_note_create"
  | "export_download";

export type AuditRecord = {
  auditId: string;
  agencyId: string;
  userId: string;
  userRole: string;
  action: AuditAction;
  featureId?: string;
  resourceType?: string;
  resourceId?: string;
  status: "success" | "failure" | "denied" | "pending";
  timestamp: string;
  sourceIp?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

function newId(): string {
  return `aud_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function logAuditEvent(
  input: Omit<AuditRecord, "auditId" | "timestamp"> & { auditId?: string; timestamp?: string },
): AuditRecord {
  const record: AuditRecord = {
    ...input,
    auditId: input.auditId ?? newId(),
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
  if (process.env.NODE_ENV !== "production" || process.env.AUDIT_LOG_TO_CONSOLE === "true") {
    console.info("[audit]", record.action, record.auditId, record.agencyId, record.userId);
  }
  return record;
}
