import type { CadPriority } from "rapid-cortex-shared";
import type { CadIntegrationSetupContext, CadParser, NormalizedCadIncident } from "../types.js";

function record(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function text(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function asPriority(value: string): CadPriority {
  const raw = value.trim().toUpperCase();
  if (raw === "1" || raw === "P1") return "P1";
  if (raw === "2" || raw === "P2") return "P2";
  if (raw === "4" || raw === "P4") return "P4";
  return "P3";
}

function unitsOf(row: Record<string, unknown>): string[] {
  const raw = row.Units ?? row.units ?? row.UnitList;
  if (Array.isArray(raw)) return raw.map((unit) => String(unit)).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) return raw.split(/[,;]/).map((unit) => unit.trim()).filter(Boolean);
  return [];
}

/** ProPhoenix Calls for Service JSON. Field names can be overridden in the integration mapping. */
export const prophoenixCadParser: CadParser = {
  vendor: "prophoenix",

  validate(rawPayload: unknown): boolean {
    const row = record(rawPayload);
    if (!row) return false;
    return Boolean(text(row, "CfsNumber", "cfsNumber", "CFSNumber", "CallNumber"));
  },

  parse(rawPayload: unknown): NormalizedCadIncident {
    const row = record(rawPayload) ?? {};
    const lat = Number(row.Latitude ?? row.latitude);
    const lng = Number(row.Longitude ?? row.longitude);
    return {
      cadNumber: text(row, "CfsNumber", "cfsNumber", "CFSNumber", "CallNumber"),
      incidentType: text(row, "Nature", "nature", "CallType") || "UNKNOWN",
      priority: asPriority(text(row, "Priority", "priority")),
      location: text(row, "Address", "address", "Location"),
      callerName: text(row, "CallerName", "callerName") || undefined,
      callerCallback: text(row, "CallerPhone", "callerPhone", "Callback") || undefined,
      units: unitsOf(row),
      coordinates: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined,
      notes: text(row, "Narrative", "Comments", "narrative") || undefined,
      cadStatus: text(row, "CallStatus", "Status") || undefined,
      rawPayload,
    };
  },

  generateSetupInstructions(integration: CadIntegrationSetupContext): string {
    const preview = integration.tokenPreview?.trim() || "****";
    return [
      `ProPhoenix CAD — “${integration.name}” (${integration.id}):`,
      "",
      "ProPhoenix licenses the interface per agency. Paste the Calls for Service URL they give you.",
      "NexCort iQ does not ship a public ProPhoenix endpoint.",
      "",
      `Webhook, if Phoenix can POST out: ${integration.webhookUrl}`,
      `Header: X-RC-Token: …${preview}`,
      "",
      "Expected fields: CfsNumber, Nature, Priority, CallStatus, Address, Latitude, Longitude, ReceivedDateTime.",
      "Change the field mapping when this agency's export uses different names.",
      "Write-back stays off until the CAD write-back addendum is signed.",
    ].join("\n");
  },
};
