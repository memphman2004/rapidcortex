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
  const raw = row.units ?? row.Units;
  if (Array.isArray(raw)) {
    return raw
      .map((unit) => {
        if (typeof unit === "string") return unit.trim();
        if (unit && typeof unit === "object") {
          const u = unit as Record<string, unknown>;
          return String(u.unitId ?? u.UnitId ?? u.callSign ?? "").trim();
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) return raw.split(/[,;]/).map((u) => u.trim()).filter(Boolean);
  return [];
}

function narrativeText(row: Record<string, unknown>): string {
  const direct = text(row, "narrative", "Narrative", "comments", "Comments");
  if (direct && !direct.startsWith("[")) return direct;
  const entries = row.narrative ?? row.Narrative;
  if (Array.isArray(entries)) {
    return entries
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (entry && typeof entry === "object") {
          const e = entry as Record<string, unknown>;
          return String(e.text ?? e.Text ?? "").trim();
        }
        return "";
      })
      .filter(Boolean)
      .join(" | ");
  }
  return direct;
}

/**
 * Southern Software / VisiCAD JSON.
 * Field names match the assumed C2C partner API; agency mappings may override.
 */
export const southernSoftwareCadParser: CadParser = {
  vendor: "southern_software",

  validate(rawPayload: unknown): boolean {
    const row = record(rawPayload);
    if (!row) return false;
    return Boolean(text(row, "incidentId", "IncidentId", "IncidentNumber"));
  },

  parse(rawPayload: unknown): NormalizedCadIncident {
    const row = record(rawPayload) ?? {};
    const lat = Number(row.latitude ?? row.Latitude);
    const lng = Number(row.longitude ?? row.Longitude);
    return {
      cadNumber: text(row, "incidentId", "IncidentId", "IncidentNumber"),
      incidentType: text(row, "callType", "CallType", "Nature") || "UNKNOWN",
      priority: asPriority(text(row, "priority", "Priority")),
      location: text(row, "address", "Address", "Location"),
      callerName: text(row, "callerName", "CallerName") || undefined,
      callerCallback: text(row, "callerPhone", "CallerPhone", "Callback") || undefined,
      units: unitsOf(row),
      coordinates: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined,
      notes: narrativeText(row) || undefined,
      cadStatus: text(row, "status", "Status") || undefined,
      rawPayload,
    };
  },

  generateSetupInstructions(integration: CadIntegrationSetupContext): string {
    const preview = integration.tokenPreview?.trim() || "****";
    return [
      `Southern Software (VisiCAD) — “${integration.name}” (${integration.id}):`,
      "",
      "Paste the Southern Software CAD base URL (…/ssapi) and API key from Secrets Manager.",
      "Paths follow the provisional partner API (/ssapi/v1/incidents). Confirm with Southern Software before go-live.",
      "",
      `Webhook (if SS can POST): ${integration.webhookUrl}`,
      `Header: X-RC-Token: …${preview}`,
      "",
      "Expected fields: incidentId, callType, priority, status, address, latitude, longitude, receivedAt.",
      "Write-back stays off until the CAD write-back addendum is signed.",
    ].join("\n");
  },
};
