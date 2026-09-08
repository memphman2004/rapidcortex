/** Agency-agnostic Call Assist classifications. Incident codes live in tenant config, not here. */

export const CALL_ASSIST_MODES = [
  "NON_EMERGENCY",
  "AFTER_HOURS",
  "OVERFLOW",
  "CALL_TAKER_ASSIST",
] as const;
export type CallAssistMode = (typeof CALL_ASSIST_MODES)[number];

export const CALL_ASSIST_STATES = [
  "INITIATED",
  "DISCLOSURE",
  "LISTENING",
  "INTAKE",
  "TRIAGED",
  "ROUTING",
  "TRANSFERRING_911",
  "TRANSFERRING_HUMAN",
  "TRANSFERRING_EXTERNAL",
  "CALLBACK_OFFERED",
  "SURVEY",
  "COMPLETED",
  "FAILED",
] as const;
export type CallAssistState = (typeof CALL_ASSIST_STATES)[number];

export const CALL_TRIAGE_CLASSIFICATIONS = [
  "EMERGENCY",
  "NON_EMERGENCY_POLICE",
  "ANIMAL_CONTROL",
  "PARKING",
  "CODE_ENFORCEMENT",
  "PUBLIC_WORKS",
  "TOW_COMPLAINT",
  "NOISE_COMPLAINT",
  "REPORT_ONLY",
  "INFORMATION_REQUEST",
  "CARFAX_REPORTING_ELIGIBLE",
  "ONLINE_REPORTING_ELIGIBLE",
  "UNKNOWN",
] as const;
export type CallTriageClassification911 = (typeof CALL_TRIAGE_CLASSIFICATIONS)[number];
/** Tenant taxonomy ids (911 preset ids stay CALL_TRIAGE_CLASSIFICATIONS). */
export type CallTriageClassification = string;

export const ROUTING_DESTINATION_TYPES = [
  "CALL_QUEUE",
  "PHONE_EXTENSION",
  "PHONE_NUMBER",
  "ONLINE_SERVICE",
  "CALL_TAKER",
  "WORKFLOW",
  "EXTERNAL_AGENCY",
  "EMERGENCY_911",
] as const;
export type RoutingDestinationType = (typeof ROUTING_DESTINATION_TYPES)[number];

export const TRANSFER_TYPES = ["BLIND", "WARM"] as const;
export type TransferType = (typeof TRANSFER_TYPES)[number];

/** Immutable controller action — never proposed by an LLM. */
export const EMERGENCY_TRANSFER_ACTION = "TRANSFER_911" as const;
export type EmergencyTransferAction = typeof EMERGENCY_TRANSFER_ACTION;

export const CALL_ASSIST_SOURCES = ["LIVE", "OVERFLOW", "AFTER_HOURS", "DEMO", "CONNECT"] as const;
export type CallAssistSource = (typeof CALL_ASSIST_SOURCES)[number];
