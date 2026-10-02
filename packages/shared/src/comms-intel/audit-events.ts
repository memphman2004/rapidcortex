/**
 * Audit vocabulary for Communications Intelligence (Context Cards, Command Intelligence, NexiQ Vault).
 * Merged into security AUDIT_EVENT_TYPES via packages/shared audit-schema re-export.
 */
export const COMMS_INTEL_AUDIT_EVENT_TYPES = {
  CONTEXT_CARD_VIEWED: "comms_intel.context_card.viewed",
  SAFETY_FLAG_SET: "comms_intel.safety_flag.set",
  SAFETY_FLAG_CLEARED: "comms_intel.safety_flag.cleared",
  COMMAND_DASHBOARD_VIEWED: "comms_intel.command.dashboard_viewed",
  COMMAND_EXPORT: "comms_intel.command.export",
  VAULT_SEARCH: "comms_intel.vault.search",
  VAULT_INGESTION_STARTED: "comms_intel.vault.ingestion_started",
  VAULT_INGESTION_COMPLETED: "comms_intel.vault.ingestion_completed",
  VAULT_INGESTION_FAILED: "comms_intel.vault.ingestion_failed",
  VAULT_RECORD_DELETED: "comms_intel.vault.record_deleted",
} as const;

export type CommsIntelAuditEventTypeName =
  (typeof COMMS_INTEL_AUDIT_EVENT_TYPES)[keyof typeof COMMS_INTEL_AUDIT_EVENT_TYPES];
