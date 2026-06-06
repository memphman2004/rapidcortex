/** Billable capability flags — backend enforcement; frontend may mirror for UX only. */
export const MONETIZATION_FEATURE_KEYS = [
  "dispatcher_dashboard",
  "supervisor_dashboard",
  "agency_admin_dashboard",
  "qa_dashboard",
  "executive_dashboard",
  "it_security_dashboard",
  "responder_dashboard",
  /** Explicit gate for Rapid Cortex web consoles (never granted to RC Lite API-only). */
  "dashboard_access",

  /** Full-platform console surfaces (RC Lite must never receive these). */
  "advanced_reports_dashboard",
  "full_incident_console",
  "command_center_ui",

  "ai_summary",
  "transcription",
  "translation",
  "caller_text",
  "caller_photo",
  "caller_video",
  "live_video",
  "cad_export",
  "cad_export_api",
  "cad_api_push",
  "supervisor_silent_monitor",
  "qa_scorecards",
  "api_access",
  "webhooks",
  "advanced_reports",
  "grant_reporting",
  "premium_support",
  "govcloud_option",

  "api_portal_access",
  "sandbox_access",
  "production_api_access",
  "developer_docs",

  /** RC Lite — standalone API product modules (public-safety intelligence APIs). */
  "incident_intelligence_api",
  "transcription_api",
  "translation_api",
  "caller_link_api",
  "caller_media_api",
  "qa_analysis_api",
  "api_usage_dashboard",
  "api_key_management",
  "audit_logs_api",
] as const;

export type MonetizationFeatureKey = (typeof MONETIZATION_FEATURE_KEYS)[number];
