import { createHash } from "node:crypto";

export type AuditEvent = {
  event: string;
  subject?: string;
  role?: string;
  externalKeyHash?: string;
  action?: string;
  status?: number | string;
  errorCode?: string;
  durationMs?: number;
};

/** Redacted structured audit — never log Watch payloads, tokens, or API keys. */
export function auditLog(evt: AuditEvent): void {
  console.log(
    JSON.stringify({
      msg: "mcp_watch_audit",
      ts: new Date().toISOString(),
      ...evt,
    }),
  );
}

export function hashExternalKey(externalKey: string): string {
  return createHash("sha256").update(externalKey).digest("hex").slice(0, 16);
}
