/**
 * Audit event vocabulary for the 13 competitive differentiator features.
 * Merged into security AUDIT_EVENT_TYPES via packages/shared audit-schema re-export.
 * All values are namespaced under `features.` to avoid collisions.
 */
export const FEATURES_AUDIT_EVENT_TYPES = {
  CITIZEN_REGISTERED: "features.citizen.registered",
  CITIZEN_UPDATED: "features.citizen.updated",
  CITIZEN_DELETED: "features.citizen.deleted",
  CITIZEN_LOOKED_UP: "features.citizen.looked_up",

  ADDRESS_INTEL_DEPOSITED: "features.address.intel.deposited",
  ADDRESS_HAZARD_ADDED: "features.address.hazard.added",
  ADDRESS_PREPLAN_UPSERTED: "features.address.preplan.upserted",
  ADDRESS_FLOOR_PLAN_UPLOAD_URL: "features.address.floor_plan.upload_url",

  ALT_RESPONSE_FLAGGED: "features.alt_response.flagged",
  ALT_RESPONSE_SUPERVISOR_DECIDED: "features.alt_response.supervisor_decided",
  ALT_RESPONSE_OUTCOME_RECORDED: "features.alt_response.outcome_recorded",
  CO_RESPONDER_STATUS_UPDATED: "features.co_responder.status_updated",

  MUTUAL_AID_REQUESTED: "features.mutual_aid.requested",
  MUTUAL_AID_COMMITTED: "features.mutual_aid.committed",
  MUTUAL_AID_COMMITMENT_UPDATED: "features.mutual_aid.commitment_updated",
  MUTUAL_AID_CLOSED: "features.mutual_aid.closed",

  MCI_ACTIVATED: "features.mci.activated",
  MCI_PATIENT_ADDED: "features.mci.patient_added",
  MCI_PATIENT_TRANSPORTED: "features.mci.patient_transported",
  MCI_HOSPITAL_CAPACITY_UPDATED: "features.mci.hospital_capacity_updated",
  MCI_CLOSED: "features.mci.closed",

  INFRA_UPSERTED: "features.infra.upserted",
  INFRA_PROTOCOL_UPSERTED: "features.infra.protocol_upserted",

  INTERPRETER_REQUESTED: "features.interpreter.requested",
  INTERPRETER_COMPLETED: "features.interpreter.completed",

  EVIDENCE_CREATED: "features.evidence.created",
  EVIDENCE_ACCESSED: "features.evidence.accessed",
  EVIDENCE_HOLD_PLACED: "features.evidence.hold_placed",
  EVIDENCE_PUBLIC_RECORDS_REQUESTED: "features.evidence.public_records_requested",

  ASSESSMENT_SESSION_CREATED: "features.assessment.session_created",
  ASSESSMENT_SCENARIO_SUBMITTED: "features.assessment.scenario_submitted",
  ASSESSMENT_REVIEWED: "features.assessment.reviewed",

  LEARNING_PATTERN_DETECTED: "features.learning.pattern_detected",
  LEARNING_PATTERN_ACKNOWLEDGED: "features.learning.pattern_acknowledged",
  LEARNING_ANALYSIS_RUN: "features.learning.analysis_run",

  EVENT_CREATED: "features.event.created",
  SURGE_EVENT_UPSERTED: "features.surge.event_upserted",

  CHECKIN_STARTED: "features.checkin.started",
  CHECKIN_COMPLETED: "features.checkin.completed",
  CHECKIN_ESCALATED: "features.checkin.escalated",

  PANIC_TRIGGERED: "features.panic.triggered",
  PANIC_ACKNOWLEDGED: "features.panic.acknowledged",
  PANIC_RESOLVED: "features.panic.resolved",

  SOCIAL_SIGNAL_INGESTED: "features.social.signal_ingested",
  SOCIAL_SIGNAL_REVIEWED: "features.social.signal_reviewed",
  SOCIAL_ALERT_SENT: "features.social.alert_sent",

  AGENCY_SSO_CONFIGURED: "features.agency.sso.configured",
  AGENCY_SSO_DELETED: "features.agency.sso.deleted",
} as const;

export type FeaturesAuditEventTypeName =
  (typeof FEATURES_AUDIT_EVENT_TYPES)[keyof typeof FEATURES_AUDIT_EVENT_TYPES];
