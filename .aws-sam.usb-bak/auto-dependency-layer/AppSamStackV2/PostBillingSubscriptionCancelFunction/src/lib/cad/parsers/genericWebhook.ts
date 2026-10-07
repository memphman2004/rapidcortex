import type { CadIntegrationSetupContext } from "../types.js";
import type { CadParser } from "../types.js";
import type { NormalizedCadIncident } from "../types.js";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

type FieldMap = Record<string, string>;

const defaultMap: FieldMap = {
  cadNumber: "cadNumber",
  incidentType: "incidentType",
  priority: "priority",
  location: "location",
  callerCallback: "callerCallback",
  callerName: "callerName",
  units: "units",
  notes: "notes",
};

/** Resolve dotted paths like `incident.id` on nested objects (lodash.get-style). */
function getByPath(root: unknown, path: string): unknown {
  if (!path.trim()) return undefined;
  const parts = path.split(".").map((p) => p.trim()).filter(Boolean);
  let cur: unknown = root;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function readMapped(payload: Record<string, unknown>, map: FieldMap, logicalKey: string): unknown {
  const pathOrKey = map[logicalKey] ?? logicalKey;
  if (pathOrKey.includes(".")) return getByPath(payload, pathOrKey);
  return payload[pathOrKey];
}

function tp(i: CadIntegrationSetupContext): string {
  return i.tokenPreview?.trim() || "****";
}

function normalizePriority(v: unknown): NormalizedCadIncident["priority"] {
  const pr = String(v ?? "P3").toUpperCase();
  if (pr === "P1" || pr === "P2" || pr === "P3" || pr === "P4") return pr as NormalizedCadIncident["priority"];
  return "P3";
}

export const genericWebhookCadParser: CadParser = {
  vendor: "generic_webhook",
  validate(rawPayload: unknown): boolean {
    const root = asRecord(rawPayload);
    if (!root) return false;
    const payload = asRecord(root.payload) ?? root;
    const mapping = (asRecord(root.fieldMapping) as FieldMap | null) ?? (root.fieldMapping as FieldMap | undefined);
    const map = { ...defaultMap, ...mapping };
    const cad = readMapped(payload, map, "cadNumber");
    return (
      typeof cad === "string" ||
      typeof payload.cadNumber === "string" ||
      typeof payload.IncidentNumber === "string" ||
      typeof payload.incident_id === "string" ||
      typeof payload.call_number === "string"
    );
  },
  parse(rawPayload: unknown): NormalizedCadIncident {
    const root = asRecord(rawPayload) ?? {};
    const mapping = (asRecord(root.fieldMapping) as FieldMap | null) ?? (root.fieldMapping as FieldMap | undefined);
    const map = { ...defaultMap, ...mapping };
    const payload = asRecord(root.payload) ?? root;
    const g = (k: keyof typeof map | string) => readMapped(payload, map, String(k));
    const pr = String(g("priority") ?? "P3").toUpperCase();
    const priority = normalizePriority(pr);
    const unitsRaw = g("units");
    const units = Array.isArray(unitsRaw) ? (unitsRaw as unknown[]).map(String) : [];
    return {
      cadNumber: String(g("cadNumber") ?? "UNKNOWN"),
      incidentType: String(g("incidentType") ?? "UNKNOWN"),
      priority,
      location: String(g("location") ?? "Unknown"),
      callerCallback: g("callerCallback") != null ? String(g("callerCallback")) : undefined,
      callerName: g("callerName") != null ? String(g("callerName")) : undefined,
      units,
      notes: g("notes") != null ? String(g("notes")) : undefined,
      rawPayload: asRecord(root.payload) ?? rawPayload,
    };
  },
  generateSetupInstructions(integration: CadIntegrationSetupContext): string {
    const u = integration.webhookUrl;
    return [
      `Generic CAD webhook — “${integration.name}” (${integration.id}):`,
      "",
      `POST ${u}`,
      `Header: X-RC-Token: <token ending …${tp(integration)}>`,
      "Optional integrity: X-RC-Signature: sha256=<hex> (HMAC-SHA256 of raw body, key=plaintext token).",
      "",
      "Body JSON may be flat or wrapped:",
      '  { "cadNumber": "…", "incidentType": "…", "priority": "P1|P2|P3|P4", "location": "…",',
      '    "callerCallback": "…", "callerName": "…", "units": ["U1"] }',
      "",
      'Optional: { "payload": { … }, "fieldMapping": { "cadNumber": "incident.id", "location": "scene.address.line1" } }',
      "Nested paths use dot notation (same as incident.id → payload.incident.id).",
    ].join("\n");
  },
};
