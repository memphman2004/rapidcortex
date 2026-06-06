import type { CadIntegrationSetupContext } from "../types.js";
import type { CadParser } from "../types.js";
import type { NormalizedCadIncident } from "../types.js";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function normalizePriority(v: unknown): NormalizedCadIncident["priority"] {
  const n = Number(v);
  if (n === 1) return "P1";
  if (n === 2) return "P2";
  if (n === 4) return "P4";
  const s = String(v ?? "P3").toUpperCase();
  if (s === "P1" || s === "P2" || s === "P3" || s === "P4") return s;
  return "P3";
}

export const tylerNewWorldCadParser: CadParser = {
  vendor: "tyler_new_world",
  validate(rawPayload: unknown): boolean {
    const o = asRecord(rawPayload);
    if (!o) return false;
    return typeof o.call_number === "string" || typeof o.callNumber === "string" || typeof o.id === "string";
  },
  parse(rawPayload: unknown): NormalizedCadIncident {
    const o = asRecord(rawPayload) ?? {};
    const cadNumber = String(o.call_number ?? o.callNumber ?? o.id ?? "UNKNOWN");
    const incidentType = String(o.call_type ?? o.callType ?? o.nature ?? "UNKNOWN");
    const location = String(o.location_text ?? o.locationText ?? o.address ?? "");
    const units = Array.isArray(o.apparatus)
      ? (o.apparatus as unknown[]).map((u) => {
          const r = asRecord(u);
          return r ? String(r.unit_id ?? r.unitId ?? r.id ?? "") : "";
        }).filter(Boolean)
      : [];
    return {
      cadNumber,
      incidentType,
      priority: normalizePriority(o.priority_code ?? o.priorityCode ?? o.priority),
      location: location || "Unknown",
      callerCallback: o.caller_phone != null ? String(o.caller_phone) : undefined,
      callerName: o.caller_name != null ? String(o.caller_name) : undefined,
      units,
      cadStatus:
        o.dispatch_status != null ? String(o.dispatch_status)
        : o.status != null ? String(o.status)
        : o.call_status != null ? String(o.call_status)
        : undefined,
      revision: typeof o.version_number === "number" ? o.version_number : undefined,
      rawPayload,
    };
  },
  generateSetupInstructions(integration: CadIntegrationSetupContext): string {
    const u = integration.webhookUrl;
    const tp = integration.tokenPreview?.trim() || "****";
    return [
      `Tyler New World — “${integration.name}” (${integration.id}):`,
      "",
      "1) Contact Tyler Technologies support to enable CAD API / outbound webhooks for your agency.",
      `2) Provide Rapid Cortex inbound URL: ${u}`,
      `3) Authentication: header X-RC-Token (token suffix …${tp})`,
      "4) Optional integrity: X-RC-Signature: sha256=<hex> where hex = HMAC-SHA256(UTF-8 body, plaintext token).",
      "",
      "For API poll mode, set integration.config fields: apiUrl, apiKey, agencyCode (Tyler agency identifier).",
    ].join("\n");
  },
};
