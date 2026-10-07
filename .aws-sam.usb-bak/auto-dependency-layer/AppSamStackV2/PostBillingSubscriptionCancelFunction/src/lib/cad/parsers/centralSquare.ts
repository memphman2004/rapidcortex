import type { CadIntegrationSetupContext } from "../types.js";
import type { CadParser } from "../types.js";
import type { NormalizedCadIncident } from "../types.js";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function normalizePriority(v: unknown): NormalizedCadIncident["priority"] {
  const s = String(v ?? "P3").toUpperCase();
  if (s === "P1" || s === "P2" || s === "P3" || s === "P4") return s;
  return "P3";
}

export const centralSquareCadParser: CadParser = {
  vendor: "central_square",
  validate(rawPayload: unknown): boolean {
    const o = asRecord(rawPayload);
    if (!o) return false;
    return typeof o.incident_id === "string" || typeof o.incidentId === "string";
  },
  parse(rawPayload: unknown): NormalizedCadIncident {
    const o = asRecord(rawPayload) ?? {};
    const cadNumber = String(o.incident_id ?? o.incidentId ?? "UNKNOWN");
    const incidentType = String(o.nature ?? o.incident_type ?? o.incidentType ?? "UNKNOWN");
    const location = String(o.address ?? o.location ?? "");
    const unitsRaw = o.assigned_units ?? o.assignedUnits;
    const units =
      Array.isArray(unitsRaw) ?
        (unitsRaw as unknown[]).map((u) => (typeof u === "string" ? u : String((asRecord(u) ?? {}).unit_id ?? ""))).filter(Boolean)
      : [];
    return {
      cadNumber,
      incidentType,
      priority: normalizePriority(o.priority ?? o.Priority),
      location: location || "Unknown",
      callerCallback: o.callback != null ? String(o.callback) : undefined,
      callerName: o.caller_name != null ? String(o.caller_name) : undefined,
      units,
      cadStatus: o.incident_status != null ? String(o.incident_status) : o.status != null ? String(o.status) : undefined,
      rawPayload,
    };
  },
  generateSetupInstructions(integration: CadIntegrationSetupContext): string {
    const u = integration.webhookUrl;
    const tp = integration.tokenPreview?.trim() || "****";
    return [
      `CentralSquare (Tritech) — “${integration.name}” (${integration.id}):`,
      "",
      `POST ${u}`,
      `Header X-RC-Token: <token ending …${tp}>`,
      "Optional integrity: X-RC-Signature: sha256=<hex> (HMAC-SHA256 of raw body, key=plaintext token).",
      "Payload JSON keys: incident_id, nature, address, priority, assigned_units[], callback, caller_name.",
    ].join("\n");
  },
};
