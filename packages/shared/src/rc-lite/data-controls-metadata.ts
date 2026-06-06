/** Tenant-facing data sovereignty switches (contract-backed). No runtime enforcement yet. */

export type RcLiteDataControlId =
  | "retention_days"
  | "media_expiry_hours"
  | "audio_deletion_hours"
  | "pii_redaction_mode"
  | "legal_hold_enabled"
  | "export_audit_logs_enabled"
  | "do_not_train_on_customer_payloads";

export const RC_LITE_DATA_CONTROLS_LABELS: readonly { id: RcLiteDataControlId; title: string; description: string }[] =
  [
    {
      id: "retention_days",
      title: "Configurable transcript + artifact retention",
      description: "Per-tenant days-to-retain knobs for transcripts, summaries, QA scorecards.",
    },
    {
      id: "media_expiry_hours",
      title: "Media expiration TTL",
      description: "Automatic expiry for ephemeral caller uploads and viewer sessions.",
    },
    {
      id: "audio_deletion_hours",
      title: "Audio deletion rules",
      description: "After transcription completion, deterministic audio shredding windows.",
    },
    {
      id: "pii_redaction_mode",
      title: "PII-aware redaction",
      description: "Detector-driven masking for exports sent to CAD/RMS integrations.",
    },
    {
      id: "legal_hold_enabled",
      title: "Legal hold",
      description: "Agency-triggered freezes on deletion pathways for subpoena responsiveness.",
    },
    {
      id: "export_audit_logs_enabled",
      title: "Export logs",
      description: "Machine-readable egress logs aligned with CJIS-aligned audit workflows.",
    },
    {
      id: "do_not_train_on_customer_payloads",
      title: "No training reuse",
      description: "Contractual guarantee that RC Lite production payloads are not repurposed as model-training corpora.",
    },
  ];
