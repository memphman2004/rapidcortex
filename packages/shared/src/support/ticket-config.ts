/**
 * Display configuration for the ticket board (mirrors STAGE_CONFIG from the CRM).
 * No AWS SDK — safe in web, tests, and Lambdas.
 */

import type { SupportCategory, TicketSeverity, TicketStatus } from "./ticket-types.js";

export interface TicketStatusConfig {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const TICKET_STATUS_CONFIG: Record<TicketStatus, TicketStatusConfig> = {
  NEW: {
    label: "New",
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-400",
    borderClass: "border-l-blue-400",
  },
  OPEN: {
    label: "Open",
    bgClass: "bg-sky-500/10",
    textClass: "text-sky-400",
    borderClass: "border-l-sky-400",
  },
  IN_PROGRESS: {
    label: "In Progress",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-400",
    borderClass: "border-l-amber-400",
  },
  AWAITING_RESPONSE: {
    label: "Awaiting Reply",
    bgClass: "bg-purple-500/10",
    textClass: "text-purple-400",
    borderClass: "border-l-purple-400",
  },
  ESCALATED: {
    label: "Escalated",
    bgClass: "bg-red-500/10",
    textClass: "text-red-400",
    borderClass: "border-l-red-500",
  },
  RESOLVED: {
    label: "Resolved",
    bgClass: "bg-emerald-500/10",
    textClass: "text-emerald-400",
    borderClass: "border-l-emerald-400",
  },
  CLOSED: {
    label: "Closed",
    bgClass: "bg-slate-700/30",
    textClass: "text-slate-500",
    borderClass: "border-l-slate-600",
  },
};

export const SEVERITY_CONFIG: Record<
  TicketSeverity,
  { label: string; bgClass: string; textClass: string; dotClass: string }
> = {
  SEV1: { label: "SEV1 — Critical", bgClass: "bg-red-500/10", textClass: "text-red-400", dotClass: "bg-red-500" },
  SEV2: { label: "SEV2 — High", bgClass: "bg-orange-500/10", textClass: "text-orange-400", dotClass: "bg-orange-500" },
  SEV3: { label: "SEV3 — Medium", bgClass: "bg-amber-500/10", textClass: "text-amber-400", dotClass: "bg-amber-500" },
  SEV4: { label: "SEV4 — Standard", bgClass: "bg-blue-500/10", textClass: "text-blue-400", dotClass: "bg-blue-500" },
};

export const SLA_BY_SEVERITY: Record<TicketSeverity, string> = {
  SEV1: "Our on-call engineer will contact you within 1 hour.",
  SEV2: "A support specialist will respond within 4 hours.",
  SEV3: "You will receive a response within 8 business hours.",
  SEV4: "You will receive a response within 24 business hours.",
};

export const CATEGORY_LABELS: Record<SupportCategory, string> = {
  user_provisioning: "User Provisioning / Access",
  sso_auth: "SSO / Authentication",
  integration_cad: "CAD / Integration",
  security_alert: "Security Alert",
  billing: "Billing / Invoice",
  user_management: "User Management",
  configuration: "Platform Configuration",
  ui_issue: "UI Not Responding",
  feature_not_working: "Feature Not Working",
  audio_transcription: "Audio / Transcription Issue",
  dashboard_reporting: "Dashboard / Reporting",
  staff_management: "Staff Management",
  incident_review: "Incident Review",
  training_request: "Training Request",
  feature_request: "Feature Request",
  bug_report: "Bug Report",
  technical: "Technical Issue",
  other: "Other",
};

export const CATEGORIES_BY_ROLE: Record<string, SupportCategory[]> = {
  itadmin: [
    "user_provisioning",
    "sso_auth",
    "integration_cad",
    "security_alert",
    "billing",
    "feature_request",
    "bug_report",
    "other",
  ],
  agencyit: [
    "user_provisioning",
    "sso_auth",
    "integration_cad",
    "security_alert",
    "billing",
    "feature_request",
    "bug_report",
    "other",
  ],
  rcitadmin: [
    "user_provisioning",
    "sso_auth",
    "integration_cad",
    "security_alert",
    "billing",
    "feature_request",
    "bug_report",
    "other",
  ],
  agencyadmin: [
    "billing",
    "user_management",
    "configuration",
    "training_request",
    "feature_request",
    "bug_report",
    "other",
  ],
  CAMPUS_ADMIN: [
    "billing",
    "user_management",
    "configuration",
    "training_request",
    "feature_request",
    "bug_report",
    "other",
  ],
  VENUE_ADMIN: [
    "billing",
    "user_management",
    "configuration",
    "training_request",
    "feature_request",
    "bug_report",
    "other",
  ],
  HOSPITAL_ADMIN: [
    "billing",
    "user_management",
    "configuration",
    "training_request",
    "feature_request",
    "bug_report",
    "other",
  ],
  TRANSIT_ADMIN: [
    "billing",
    "user_management",
    "configuration",
    "training_request",
    "feature_request",
    "bug_report",
    "other",
  ],
  dispatcher: ["ui_issue", "feature_not_working", "audio_transcription", "training_request", "bug_report", "other"],
  CAMPUS_DISPATCH: ["ui_issue", "feature_not_working", "audio_transcription", "training_request", "bug_report", "other"],
  supervisor: ["dashboard_reporting", "staff_management", "incident_review", "feature_request", "other"],
  CAMPUS_SUPERVISOR: ["dashboard_reporting", "staff_management", "incident_review", "feature_request", "other"],
  VENUE_SUPERVISOR: ["dashboard_reporting", "staff_management", "incident_review", "feature_request", "other"],
  TRANSIT_SUPERVISOR: ["dashboard_reporting", "staff_management", "incident_review", "feature_request", "other"],
  _default: ["technical", "billing", "training_request", "feature_request", "bug_report", "other"],
};

export function categoriesForRole(role: string): SupportCategory[] {
  return CATEGORIES_BY_ROLE[role] ?? CATEGORIES_BY_ROLE._default ?? ["technical", "other"];
}

export const CHANNEL_LABELS: Record<string, string> = {
  phone: "Phone",
  web_form: "Web Form",
  email: "Email",
};

export const TICKET_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CLOSED"],
  OPEN: ["IN_PROGRESS", "AWAITING_RESPONSE", "ESCALATED", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["AWAITING_RESPONSE", "ESCALATED", "RESOLVED", "CLOSED"],
  AWAITING_RESPONSE: ["IN_PROGRESS", "ESCALATED", "RESOLVED", "CLOSED"],
  ESCALATED: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED", "OPEN"],
  CLOSED: ["OPEN"],
};

export const RC_SUPPORT_PHONE =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPPORT_LINE_NUMBER : undefined) ??
  "(contact RC for number)";
