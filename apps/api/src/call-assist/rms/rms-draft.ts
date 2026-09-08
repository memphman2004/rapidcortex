export type RmsDraftResult = {
  ok: boolean;
  blocked: boolean;
  draftId?: string;
  reason: string;
};

export function evaluateRmsDraftGate(opts: {
  rmsDraftEnabled: boolean;
  humanReviewApproved: boolean;
  demo: boolean;
}): RmsDraftResult {
  if (opts.demo) {
    return { ok: true, blocked: false, draftId: "demo_rms_not_filed", reason: "demo_mock_rms" };
  }
  if (!opts.rmsDraftEnabled) {
    return { ok: false, blocked: true, reason: "call_assist_rms_draft_disabled" };
  }
  if (!opts.humanReviewApproved) {
    return { ok: false, blocked: true, reason: "human_review_required" };
  }
  return { ok: true, blocked: false, draftId: "pending_records_adapter", reason: "draft_held_for_review" };
}
