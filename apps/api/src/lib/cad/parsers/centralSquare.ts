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

export const CENTRAL_SQUARE_CAD_NUMBER_KEYS = [
  "IncidentId",
  "IncidentID",
  "incident_id",
  "incidentId",
  "IncidentNumber",
  "incidentNumber",
  "CaseNumber",
  "EventID",
  "EventId",
  "displayId",
  "id",
];

const TYPE_KEYS = [
  "NatureOfCall",
  "nature",
  "incident_type",
  "incidentType",
  "CallType",
  "ProblemNature",
  "Complaint",
  "type",
];
const LOCATION_KEYS = ["Address", "address", "location", "FullAddress", "Location"];
const PRIORITY_KEYS = ["Priority", "priority", "PriorityCode"];
const NAME_KEYS = ["CallerName", "caller_name", "callerName", "RPName", "Name"];
const PHONE_KEYS = ["CallerPhone", "callback", "Callback", "callerPhone", "Phone"];
const NOTES_KEYS = ["Comments", "Narrative", "Remarks", "notes", "comments"];
const STATUS_KEYS = ["Status", "incident_status", "IncidentStatus", "status"];
const UNIT_KEYS = ["UnitList", "assigned_units", "assignedUnits", "Units", "units"];
const REV_KEYS = ["Revision", "Version", "Sequence", "version_number"];

function callerBlock(o: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(o.Caller) ?? asRecord(o.caller) ?? asRecord(o.ReportingParty);
}

function parseCentralSquareRecord(o: Record<string, unknown>): NormalizedCadIncident {
  const caller = callerBlock(o);
  const base: NormalizedCadIncident = {
    cadNumber: pickFirstString(o, CENTRAL_SQUARE_CAD_NUMBER_KEYS) ?? "UNKNOWN",
    incidentType: pickFirstString(o, TYPE_KEYS) ?? "UNKNOWN",
    priority: normalizeCadPriority(pickFirst(o, PRIORITY_KEYS)),
    location: pickFirstString(o, LOCATION_KEYS) || "Unknown",
    callerCallback: (caller ? pickFirstString(caller, PHONE_KEYS) : undefined) ?? pickFirstString(o, PHONE_KEYS),
    callerName: (caller ? pickFirstString(caller, NAME_KEYS) : undefined) ?? pickFirstString(o, NAME_KEYS),
    units: parseCadUnits(pickFirst(o, UNIT_KEYS)),
    coordinates: parseCadCoordinates(o),
    notes: pickFirstString(o, NOTES_KEYS),
    cadStatus: pickFirstString(o, STATUS_KEYS),
    revision: parseCadRevision(o, REV_KEYS),
    rawPayload: o,
  };
  return enrichNormalizedCadIncident(base, o);
}

export const centralSquareCadParser: CadParser = {
  vendor: "central_square",
  validate(rawPayload: unknown): boolean {
    return anyExtractedRecordHasCadId(rawPayload, CENTRAL_SQUARE_CAD_NUMBER_KEYS);
  },
  parse(rawPayload: unknown): NormalizedCadIncident {
    return parseCentralSquareRecord(resolveIncidentRecord(rawPayload));
  },
  generateSetupInstructions(integration: CadIntegrationSetupContext): string {
    const u = integration.webhookUrl;
    const tp = integration.tokenPreview?.trim() || "****";
    return [
      `CentralSquare CAD (Enterprise / Inform / Superion / Tritech) — “${integration.name}” (${integration.id}):`,
      "",
      "Read-only ingest. Field names vary by product version; Rapid Cortex accepts PascalCase and snake_case.",
      "",
      "Webhook (recommended)",
      `POST ${u}`,
      `Header X-RC-Token: <token ending …${tp}>`,
      "Optional: X-RC-Signature: sha256=<hex> (HMAC-SHA256 of raw body, key=plaintext token).",
      "JSON or XML. Batches: { \"Incidents\": [ … ] } or { \"incidents\": [ … ] }.",
      "",
      "Accepted id keys: IncidentId, IncidentNumber, incident_id, CaseNumber.",
      "Also: NatureOfCall / nature, Address / location, Priority, UnitList / assigned_units[],",
      "CallerName, CallerPhone / callback, Comments, Status.",
      "",
      "API poll: paste the full incidents-list HTTPS URL from Integration Engine / vendor API,",
      "plus org/agency code. Rapid Cortex adds `modifiedSince`, `pageSize`, and `page`.",
    ].join("\n");
  },
};
