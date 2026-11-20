/**
 * Behavioral Threat Assessment & Management (BTAM) — K-12 only.
 *
 * IMPORTANT LEGAL / ETHICAL CONSTRAINTS:
 * - AI advisory labels in this module are INFORMATIONAL ONLY.
 * - NexCort iQ never automatically identifies suspects, makes disciplinary
 *   decisions, or determines guilt. Human TAT members make all decisions.
 * - FERPA applies: student records are confidential. Access is restricted to
 *   campus_admin_k12, campus_supervisor_k12, and campus_counselor_k12.
 * - Never deny access to school services based solely on a BTAM case status.
 */

import { z } from "zod";

// ─── Enumerations ─────────────────────────────────────────────────────────────

/** Threat Assessment Team (TAT) case status lifecycle. */
export const btamCaseStatusSchema = z.enum([
  "open",          // Case opened, intake in progress
  "gathering",     // Gathering information / conducting interviews
  "assessing",     // TAT reviewing gathered information
  "monitoring",    // Subject under supportive monitoring plan
  "closed",        // Case closed — no actionable concern identified
  "referred",      // Referred to law enforcement or mental health services
  "escalated",     // Imminent safety concern — active response required
]);
export type BtamCaseStatus = z.infer<typeof btamCaseStatusSchema>;

/** V-CAP pathways — do not use these labels to characterize individuals.
 *  They describe the category of concern being assessed by the team. */
export const btamConcernTypeSchema = z.enum([
  "violent_ideation",        // Expressions or drawings of violence
  "threatening_communication", // Written/verbal threats, posts
  "fixation",                // Obsession with a person, group, or grievance
  "weapons_access",          // Known or suspected access to weapons
  "social_isolation",        // Severe isolation, withdrawal
  "behavioral_change",       // Sudden unexplained behavioral change
  "self_harm_risk",          // Self-harm ideation or prior attempt
  "harassment_stalking",     // Harassment or stalking behavior
  "substance_abuse",         // Substance abuse affecting safety
  "other",
]);
export type BtamConcernType = z.infer<typeof btamConcernTypeSchema>;

/** Referral sources — who triggered this case. */
export const btamReferralSourceSchema = z.enum([
  "anonymous_tip",      // QR / SMS anonymous report
  "staff_report",       // Teacher / staff concern
  "student_disclosure", // Student self-disclosed or peer told an adult
  "parent_report",      // Parent / guardian concern
  "law_enforcement",    // Police or SRO referral
  "counselor",          // School counselor referral
  "social_media",       // Social media monitoring alert
  "incident_escalation", // Escalated from an active campus incident
  "other",
]);
export type BtamReferralSource = z.infer<typeof btamReferralSourceSchema>;

// ─── BTAM Case Record ─────────────────────────────────────────────────────────

/**
 * A single BTAM case record stored in DynamoDB.
 * PK = AGENCY#{agencyId}  SK = BTAM#{caseId}
 */
export const btamCaseRecordSchema = z.object({
  caseId: z.string().min(1),
  agencyId: z.string().min(1),
  campusCode: z.string().min(1),
  status: btamCaseStatusSchema,

  /** Concern types — multiple concerns can apply to one case. */
  concernTypes: z.array(btamConcernTypeSchema).min(1),

  /** Where this case originated. */
  referralSource: btamReferralSourceSchema,

  /**
   * Subject identifier — deliberately NOT stored as a full name in the primary
   * record to minimize PII exposure. Use an internal student/staff ID or a
   * redacted label (e.g. "Student A"). Full name goes in the notes field if
   * absolutely necessary, which is role-gated.
   */
  subjectLabel: z.string().max(100),

  /** Grade level if applicable (K-12 context). */
  subjectGrade: z.string().max(20).optional(),

  /** Internal notes — FERPA-restricted. Visible only to authorized TAT members. */
  notes: z.string().max(10_000).optional(),

  /** Actions taken by the TAT — append-only log entries. */
  actions: z.array(
    z.object({
      actionId: z.string(),
      type: z.enum([
        "interview",
        "parent_contact",
        "counseling_referral",
        "law_enforcement_notification",
        "safety_plan_created",
        "monitoring_added",
        "note_added",
        "status_changed",
        "case_closed",
      ]),
      description: z.string().max(5_000),
      performedBy: z.string(),
      performedByName: z.string().optional(),
      performedAt: z.string().datetime(),
    }),
  ).default([]),

  /**
   * Safety plan summary — not a full plan, just a summary of accommodations
   * and monitoring agreed by the TAT. Full documentation should be in a secure
   * external system (e.g., the district's student information system).
   */
  safetyPlanSummary: z.string().max(2_000).optional(),

  /**
   * Linked campus incident ID (if this case was escalated from an incident).
   * Also used to surface BTAM case indicators on the incident card.
   */
  linkedIncidentId: z.string().optional(),

  /** Assigned TAT lead — agencyId-scoped staff userId. */
  assignedTo: z.string().optional(),
  assignedToName: z.string().optional(),

  /** Confidential — always true for BTAM; stored for consistency with incident model. */
  confidential: z.literal(true).default(true),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),

  /** Set by the creator — used for audit trails. NOT the subject. */
  createdBy: z.string(),
});

export type BtamCaseRecord = z.infer<typeof btamCaseRecordSchema>;

// ─── API Schemas ──────────────────────────────────────────────────────────────

/** POST body to open a new BTAM case. */
export const btamOpenCaseBodySchema = z.object({
  campusCode: z.string().min(1),
  subjectLabel: z.string().min(1).max(100),
  subjectGrade: z.string().max(20).optional(),
  concernTypes: z.array(btamConcernTypeSchema).min(1),
  referralSource: btamReferralSourceSchema,
  notes: z.string().max(10_000).optional(),
  linkedIncidentId: z.string().optional(),
  assignedTo: z.string().optional(),
  assignedToName: z.string().optional(),
});
export type BtamOpenCaseBody = z.infer<typeof btamOpenCaseBodySchema>;

/** POST body to add an action to an existing case. */
export const btamAddActionBodySchema = z.object({
  type: z.enum([
    "interview",
    "parent_contact",
    "counseling_referral",
    "law_enforcement_notification",
    "safety_plan_created",
    "monitoring_added",
    "note_added",
    "status_changed",
    "case_closed",
  ]),
  description: z.string().min(1).max(5_000),
  safetyPlanSummary: z.string().max(2_000).optional(),
});
export type BtamAddActionBody = z.infer<typeof btamAddActionBodySchema>;

/** PATCH body to update case status or assignment. */
export const btamPatchCaseBodySchema = z.object({
  status: btamCaseStatusSchema.optional(),
  assignedTo: z.string().optional(),
  assignedToName: z.string().optional(),
  safetyPlanSummary: z.string().max(2_000).optional(),
  notes: z.string().max(10_000).optional(),
});
export type BtamPatchCaseBody = z.infer<typeof btamPatchCaseBodySchema>;

/** Query params for listing BTAM cases. */
export const btamListQuerySchema = z.object({
  campusCode: z.string().min(1),
  status: btamCaseStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
export type BtamListQuery = z.infer<typeof btamListQuerySchema>;

// ─── RBAC Helpers ─────────────────────────────────────────────────────────────

/** Roles permitted to read BTAM cases.
 *  campus_admin_k12, campus_supervisor_k12, campus_counselor_k12 only. */
export const BTAM_READ_ROLE_FAMILIES = new Set(["admin", "supervisor", "counselor"]);

/** Roles permitted to open/update/close BTAM cases. */
export const BTAM_WRITE_ROLE_FAMILIES = new Set(["admin", "supervisor", "counselor"]);

// ─── Status display helpers ───────────────────────────────────────────────────

export const BTAM_STATUS_LABELS: Record<BtamCaseStatus, string> = {
  open: "Open",
  gathering: "Gathering Info",
  assessing: "TAT Review",
  monitoring: "Monitoring",
  closed: "Closed",
  referred: "Referred",
  escalated: "Escalated",
};

export const BTAM_CONCERN_TYPE_LABELS: Record<string, string> = {
  violent_ideation: "Violent Ideation",
  threatening_communication: "Threatening Communication",
  fixation: "Fixation / Grievance",
  weapons_access: "Weapons Access Concern",
  social_isolation: "Social Isolation",
  behavioral_change: "Behavioral Change",
  self_harm_risk: "Self-Harm Risk",
  harassment_stalking: "Harassment / Stalking",
  substance_abuse: "Substance Abuse",
  other: "Other",
};

export const BTAM_ACTION_TYPE_LABELS: Record<string, string> = {
  interview: "Interview Conducted",
  parent_contact: "Parent / Guardian Contacted",
  counseling_referral: "Counseling Referral",
  law_enforcement_notification: "Law Enforcement Notified",
  safety_plan_created: "Safety Plan Created",
  monitoring_added: "Monitoring Added",
  note_added: "Note Added",
  status_changed: "Status Changed",
  case_closed: "Case Closed",
};
