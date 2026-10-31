import { describe, expect, it } from "vitest";
import { applyReviewDecision, gapFromApproved, planDatasetBatch, submitDatasetForTraining, type StudioReviewRecord } from "./studio-dataset";

const commons: StudioReviewRecord = {
  id: "visual-glock-commons",
  kind: "visual-review",
  status: "REVIEW_REQUIRED",
  approved: false,
  trainingLabel: false,
  modelId: "gpt-6.1-terra",
  category: "firearm_like",
  createdAt: "2026-10-30T14:44:16.733Z",
  synthetic: false,
  rightsStatus: "REVIEW_REQUIRED",
  license: "Open Government Licence v1.0",
};

describe("studio dataset review", () => {
  it("refuses to approve a candidate whose license is still open", () => {
    const result = applyReviewDecision(commons, "approve");
    expect(result.ok).toBe(false);
  });

  it("rejects without creating a training label", () => {
    const result = applyReviewDecision(commons, "reject", "Wrong context");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.status).toBe("REJECTED");
      expect(result.record.trainingLabel).toBe(false);
    }
  });

  it("keeps a corrected label unapproved", () => {
    const result = applyReviewDecision(commons, "correct-label", "blade_like");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.status).toBe("CORRECTION_REQUESTED");
      expect(result.record.approved).toBe(false);
      expect(result.record.category).toBe("blade_like");
    }
  });

  it("does not spend when batch generation is closed", () => {
    const plan = planDatasetBatch({ category: "firearm_like", count: 10, spentUsd: 0, capUsd: 5, batchEnabled: false });
    expect(plan.ok).toBe(false);
  });

  it("reports coverage unknown when nothing is approved", () => {
    expect(gapFromApproved([commons])[0]?.need).toContain("Coverage Unknown");
  });

  it("does not start training from OpenAI review text", () => {
    const synthetic: StudioReviewRecord = { ...commons, id: "synthetic", synthetic: true, rightsStatus: "synthetic_internal", status: "APPROVED", approved: true };
    expect(submitDatasetForTraining([synthetic]).reason).toContain("not a verified training label");
  });
});
