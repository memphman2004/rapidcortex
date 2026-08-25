import type { CadIntegrationSetupContext } from "../types.js";
import type { CadParser } from "../types.js";
import type { NormalizedCadIncident } from "../types.js";
import {
  anyExtractedRecordHasCadId,
  asRecord,
  normalizeCadPriority,
  parseCadCoordinates,
  parseCadRevision,
  parseCadUnits,
  pickFirst,
  pickFirstString,
  resolveIncidentRecord,
  enrichNormalizedCadIncident,
} from "./parse-helpers.js";

export const MOTOROLA_CAD_NUMBER_KEYS = [
  "EventId",
  "EventID",
  "EventNumber",
  "IncidentNumber",
  "IncidentId",
  "CADEventID",
  "cadEventId",
  "CallNumber",
  "CallId",
  "eventNumber",
  "incidentNumber",
];

const TYPE_KEYS = ["NatureCode", "CallType", "TypeCode", "IncidentType", "EventType", "Problem", "Nature", "callType"];
const LOCATION_KEYS = ["Location", "Address", "FullAddress", "LocationText", "StreetAddress", "locationAddress"];
const PRIORITY_KEYS = ["Priority", "PriorityCode", "ResponsePriority", "CallPriority"];
const NAME_KEYS = ["CallerName", "RPName", "ReportingParty", "Name"];
const PHONE_KEYS = ["CallerPhone", "CallbackNumber", "Callback", "Phone", "ANI"];
const NOTES_KEYS = ["Narrative", "Notes", "Comments", "Remarks", "Problem"];
const STATUS_KEYS = ["Status", "EventStatus", "CallStatus", "IncidentStatus", "Disposition"];
const UNIT_KEYS = ["Units", "UnitList", "AssignedUnits", "DispatchedUnits", "Apparatus", "UnitId", "Unit"];
const REV_KEYS = ["Revision", "Sequence", "Version", "MsgSeq", "sequence", "revision"];

function callerBlock(o: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(o.CallerInfo) ?? asRecord(o.callerInfo) ?? asRecord(o.Caller) ?? asRecord(o.ReportingParty);
}

function parseMotorolaRecord(o: Record<string, unknown>): NormalizedCadIncident {
  const caller = callerBlock(o);
  const cadNumber = pickFirstString(o, MOTOROLA_CAD_NUMBER_KEYS) ?? "UNKNOWN";
  const incidentType = pickFirstString(o, TYPE_KEYS) ?? "UNKNOWN";
  const location = pickFirstString(o, LOCATION_KEYS) ?? "";
  const callerName =
    (caller ? pickFirstString(caller, NAME_KEYS) : undefined) ?? pickFirstString(o, NAME_KEYS);
  const callerCallback =
    (caller ? pickFirstString(caller, PHONE_KEYS) : undefined) ?? pickFirstString(o, PHONE_KEYS);
  const notes = pickFirstString(o, NOTES_KEYS);
  const unitsSource = pickFirst(o, UNIT_KEYS);
  const base = {
    cadNumber,
    incidentType,
    priority: normalizeCadPriority(pickFirst(o, PRIORITY_KEYS)),
    location: location || "Unknown",
    callerCallback,
    callerName,
    units: parseCadUnits(unitsSource),
    coordinates: parseCadCoordinates(o),
    notes,
    cadStatus: pickFirstString(o, STATUS_KEYS),
    revision: parseCadRevision(o, REV_KEYS),
    rawPayload: o,
  };
  return enrichNormalizedCadIncident(base, o);
}

function tp(i: CadIntegrationSetupContext): string {
  return i.tokenPreview?.trim() || "****";
}

export const motorolaPremierOneCadParser: CadParser = {
  vendor: "motorola_premier_one",
  validate(rawPayload: unknown): boolean {
    return anyExtractedRecordHasCadId(rawPayload, MOTOROLA_CAD_NUMBER_KEYS);
  },
  parse(rawPayload: unknown): NormalizedCadIncident {
    return parseMotorolaRecord(resolveIncidentRecord(rawPayload));
  },
  generateSetupInstructions(integration: CadIntegrationSetupContext): string {
    const u = integration.webhookUrl;
    return [
      `Motorola PremierOne — setup for “${integration.name}” (${integration.id}):`,
      "",
      "Read-only ingest (no CAD write-back). Rapid Cortex accepts PremierOne-style JSON or XML;",
      "it is not a Motorola-certified connector. Use the outbound URL and credentials your agency provides.",
      "",
      "Webhook (recommended)",
      "1) PremierOne Admin Console → System → Integrations → External Notifications (or equivalent outbound HTTP).",
      "2) Add notification:",
      `   • URL: ${u}`,
      "   • Method: POST",
      "   • Format: JSON or application/xml",
      `   • Header: X-RC-Token: <token ending …${tp(integration)}>`,
      "   • Optional: X-RC-Signature: sha256=<hex> (HMAC-SHA256 of raw body, key = plaintext token).",
      "3) Events: IncidentCreate, IncidentUpdate, UnitStatusChange.",
      "4) Send a test notification from Admin → CAD → this integration.",
      "",
      "JSON fields accepted (any alias): EventId / IncidentNumber / CallNumber, NatureCode, Location,",
      "Priority, Units, CallerName, CallerPhone, Narrative, Status. Batches: { \"incidents\": [ … ] }.",
      "",
      "API poll (optional): paste the full incidents-list HTTPS URL from your PremierOne API gateway,",
      "auth type, and agency code. Rapid Cortex polls that URL with `since` and `pageSize` — it does not",
      "invent a Motorola REST path.",
    ].join("\n");
  },
};
