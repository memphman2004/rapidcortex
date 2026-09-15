/**
 * Unified support ticket types for the web form channel.
 * Phone CTR records stay on `rc-support-calls`; this type is the `rc-support-tickets` table.
 */

export const SUPPORT_CHANNELS = ["phone", "web_form", "email"] as const;
export type SupportChannel = (typeof SUPPORT_CHANNELS)[number];

export const TICKET_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_RESPONSE",
  "ESCALATED",
  "RESOLVED",
  "CLOSED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const ACTIVE_TICKET_STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_RESPONSE",
  "ESCALATED",
];

export const TICKET_SEVERITIES = ["SEV1", "SEV2", "SEV3", "SEV4"] as const;
export type TicketSeverity = (typeof TICKET_SEVERITIES)[number];

export const SUPPORT_CATEGORIES = [
  "user_provisioning",
  "sso_auth",
  "integration_cad",
  "security_alert",
  "billing",
  "user_management",
  "configuration",
  "ui_issue",
  "feature_not_working",
  "audio_transcription",
  "dashboard_reporting",
  "staff_management",
  "incident_review",
  "training_request",
  "feature_request",
  "bug_report",
  "technical",
  "other",
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export interface TicketNote {
  noteId: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export type TicketActivityType =
  | "created"
  | "status_changed"
  | "severity_changed"
  | "assigned"
  | "note_added"
  | "email_sent"
  | "escalated";

export interface TicketActivity {
  activityId: string;
  type: TicketActivityType;
  label: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface SupportTicketRecord {
  /** PK */
  ticketId: string;
  agencyId: string;
  agencyName: string;
  status: TicketStatus;
  channel: SupportChannel;
  severity: TicketSeverity;
  category: SupportCategory;
  submittedByUserId: string;
  submittedByName: string;
  submittedByEmail: string;
  submittedByRole: string;
  subject: string;
  description: string;
  currentPageUrl?: string;
  userAgent?: string;
  screenshotS3Key?: string;
  callerPhone?: string;
  callDurationSeconds?: number;
  transcript?: string;
  connectContactId?: string;
  assignedToUserId?: string;
  assignedToName?: string;
  notes: TicketNote[];
  activities: TicketActivity[];
  firstResponseAt?: string;
  emailSentAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** DynamoDB TTL epoch seconds — 7 years */
  ttl: number;
}

export interface SubmitTicketBody {
  category: SupportCategory;
  severity: TicketSeverity;
  subject: string;
  description: string;
  currentPageUrl?: string;
  userAgent?: string;
  agencyName?: string;
}

export interface SubmitTicketResponse {
  ticketId: string;
  severity: TicketSeverity;
  slaExpectation: string;
  message: string;
}

export interface TicketBoardMetrics {
  totalOpen: number;
  sev1Active: number;
  sev2Active: number;
  resolvedThisMonth: number;
  avgResolutionHours: number | null;
  oldestOpenHours: number | null;
}

export interface TicketBoardData {
  columns: Record<TicketStatus, SupportTicketRecord[]>;
  metrics: TicketBoardMetrics;
}

export interface PatchSupportTicketBody {
  status?: TicketStatus;
  severity?: TicketSeverity;
  category?: SupportCategory;
  subject?: string;
  assignedToUserId?: string;
  assignedToName?: string;
  note?: string;
  resolutionNotes?: string;
  reopenReason?: string;
}

export interface AddSupportTicketNoteBody {
  text: string;
}
