import type { CadAuditEvent } from "@/lib/rapid-cortex/cad/types";

/**
 * In-memory audit sink for local/demo mode.
 * TODO(cad-audit): Persist events to backend audit storage with immutable retention.
 */
const memoryAuditEvents: CadAuditEvent[] = [];
const SENSITIVE_KEY_PATTERN = /(secret|token|password|api[_-]?key|authorization)/i;

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const obj = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(obj).map(([key, nested]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return [key, "[REDACTED]"];
      }
      return [key, sanitizeValue(nested)];
    }),
  );
}

export class CadAuditService {
  async record(event: CadAuditEvent): Promise<void> {
    memoryAuditEvents.push({
      ...event,
      requestPayload: event.requestPayload
        ? (sanitizeValue(event.requestPayload) as Record<string, unknown>)
        : undefined,
    });
  }

  listRecent(limit = 50): CadAuditEvent[] {
    return memoryAuditEvents.slice(-limit).reverse();
  }
}
