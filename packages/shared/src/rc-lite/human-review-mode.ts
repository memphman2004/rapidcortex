/** Human-in-the-loop safety gate for AI-backed incident/CAD/QA outputs. */

export const RC_LITE_HUMAN_REVIEW_STATUSES = [
  "auto_mode",
  "manual_review_required",
  "supervisor_review_required",
  "blocked_due_to_confidence",
] as const;

export type RcLiteHumanReviewStatus = (typeof RC_LITE_HUMAN_REVIEW_STATUSES)[number];

export type RcLiteHumanReviewDirective = {
  status: RcLiteHumanReviewStatus;
  reason: string;
  confidence?: number;
  recommendedReviewerRole?: "dispatcher" | "supervisor" | "qa_analyst" | "compliance";
};
