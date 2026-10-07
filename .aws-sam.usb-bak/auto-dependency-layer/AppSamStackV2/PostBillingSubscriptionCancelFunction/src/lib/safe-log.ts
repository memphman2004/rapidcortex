/**
 * Structured logging helpers that avoid writing raw PII, tokens, or full transcripts to stdout.
 * Prefer these over `console.log(JSON.stringify(body))` on sensitive routes.
 */

const PHONE_LIKE = /\b\+?\d[\d\s().-]{8,}\b/g;
const EMAIL_LIKE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

export function redactFreeText(value: string, maxLen = 200): string {
  let s = value.slice(0, maxLen);
  s = s.replace(EMAIL_LIKE, "[redacted-email]");
  s = s.replace(PHONE_LIKE, "[redacted-phone]");
  return s;
}

export function safeJsonPreview(value: unknown, maxLen = 500): string {
  try {
    const s = JSON.stringify(value);
    return redactFreeText(s, maxLen);
  } catch {
    return "[unserializable]";
  }
}

export type SecurityAuditEvent =
  | "auth_failure"
  | "authz_denied"
  | "cross_tenant_attempt"
  | "admin_user_change"
  | "role_change"
  | "export_started"
  | "presign_generated"
  | "validation_spike";

/** Side-channel audit line (CloudWatch). Never include secrets or full JWT. */
export function logSecurityEvent(
  kind: SecurityAuditEvent,
  fields: Record<string, string | number | boolean | undefined>,
): void {
  const line = JSON.stringify({
    rc_audit: true,
    kind,
    ...fields,
    ts: new Date().toISOString(),
  });
  console.info(line);
}
