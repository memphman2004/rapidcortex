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

export const TYLER_CAD_NUMBER_KEYS = [
  "eventNumber",
  "EventNumber",
  "call_number",
  "callNumber",
  "CallNumber",
  "CallId",
  "IncidentNumber",
  "id",
];

const TYPE_KEYS = ["callType", "call_type", "CallType", "nature", "Nature", "incidentType"];
const LOCATION_KEYS = [
  "locationAddress",
  "location_text",
  "locationText",
  "address",
  "Address",
  "Location",
  "location",
];
const PRIORITY_KEYS = ["priority", "priority_code", "priorityCode", "Priority"];
const NAME_KEYS = ["callerName", "caller_name", "CallerName", "Name"];
const PHONE_KEYS = ["callerPhone", "caller_phone", "CallerPhone", "Phone"];
const NOTES_KEYS = ["remarks", "Comments", "Narrative", "notes", "Remarks"];
const STATUS_KEYS = ["eventStatus", "dispatch_status", "call_status", "status", "Status"];
const UNIT_KEYS = ["assignedUnits", "apparatus", "Units", "units", "AssignedUnits"];
const REV_KEYS = ["version_number", "Version", "Revision", "Sequence"];

function callerBlock(o: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(o.caller) ?? asRecord(o.Caller) ?? asRecord(o.reportingParty);
}

function parseTylerRecord(o: Record<string, unknown>): NormalizedCadIncident {
  const caller = callerBlock(o);
  const base: NormalizedCadIncident = {
    cadNumber: pickFirstString(o, TYLER_CAD_NUMBER_KEYS) ?? "UNKNOWN",
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

export const tylerNewWorldCadParser: CadParser = {
  vendor: "tyler_new_world",
  validate(rawPayload: unknown): boolean {
    return anyExtractedRecordHasCadId(rawPayload, TYLER_CAD_NUMBER_KEYS);
  },
  parse(rawPayload: unknown): NormalizedCadIncident {
    return parseTylerRecord(resolveIncidentRecord(rawPayload));
  },
  generateSetupInstructions(integration: CadIntegrationSetupContext): string {
    const u = integration.webhookUrl;
    const tp = integration.tokenPreview?.trim() || "****";
    return [
      `Tyler New World — “${integration.name}” (${integration.id}):`,
      "",
      "Read-only ingest. Tyler typically enables API access through their PSAP team (plan 2–5 business days).",
      "Rapid Cortex is not a Tyler-certified connector; use the base URL and agency code Tyler provides.",
      "",
      "API poll (typical)",
      "1) Obtain API base URL, API key, and agency code from Tyler.",
      "2) Paste the full incidents-list HTTPS URL in Admin → CAD (auth type + agency code).",
      "3) Rapid Cortex polls with `eventsSince`, `agencyCode`, and `limit`.",
      "",
      "Webhook (if Tyler enables outbound HTTP)",
      `POST ${u}`,
      `Header X-RC-Token: <token ending …${tp}>`,
      "Optional: X-RC-Signature: sha256=<hex> (HMAC-SHA256 of raw body, key=plaintext token).",
      "",
      "Accepted keys: eventNumber / call_number / id, callType, locationAddress / location_text,",
      "priority, callerName, callerPhone, remarks, assignedUnits / apparatus[], eventStatus.",
      "Batches: { \"events\": [ … ] } or { \"incidents\": [ … ] }.",
    ].join("\n");
  },
};
