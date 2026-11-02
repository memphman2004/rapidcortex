import { describe, expect, it } from "vitest";
import {
  applyReviewDecision,
  gapFromApproved,
  planDatasetBatch,
  connectTrainingJob,
  prepareSageMakerTraining,
  submitDatasetForTraining,
  syntheticVarietyFailures,
  type DatasetVersion,
  type StudioReviewRecord,
} from "./studio-dataset";

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

  it("passes a synthetic-only set when firearm and blade each have three angles and three lights", () => {
    const angles = ["overhead", "doorway", "corridor"];
    const lights = ["day", "night", "low"];
    const records: StudioReviewRecord[] = [];
    for (const category of ["firearm_like", "blade_like"]) {
      for (let index = 0; index < 3; index += 1) {
        records.push({
          ...commons,
          id: `${category}-${index}`,
          category,
          synthetic: true,
          cameraAngle: angles[index],
          lighting: lights[index],
          trainingLabel: true,
          status: "APPROVED",
          approved: true,
        });
      }
    }
    expect(syntheticVarietyFailures(records, records.map((item) => item.id))).toEqual([]);
    const thin = records.filter((item) => item.id !== "blade_like-2");
    expect(syntheticVarietyFailures(thin, thin.map((item) => item.id)).join(" ")).toContain("knife_visible: only 2 camera angle");
  });

  it("records a synthetic bypass and still does not launch a job", () => {
    const version: DatasetVersion = {
      id: "dataset-test-v1",
      version: 1,
      createdAt: "2026-10-31T00:00:00.000Z",
      reviewer: "ada@nexcortiq.us",
      assetIds: Array.from({ length: 50 }, (_unused, index) => `id-${index}`),
      positiveIds: ["id-0"],
      negativeIds: ["id-1"],
      syntheticIds: Array.from({ length: 50 }, (_unused, index) => `id-${index}`),
      realIds: [],
    };
    const angles = ["overhead", "doorway", "corridor"];
    const lights = ["day", "night", "low"];
    const records: StudioReviewRecord[] = version.assetIds.map((id, index) => ({
      ...commons,
      id,
      category: index < 25 ? "firearm_like" : "blade_like",
      synthetic: true,
      cameraAngle: angles[index % 3],
      lighting: lights[index % 3],
      role: index % 2 === 0 ? "positive" : "negative",
    }));
    const prepared = prepareSageMakerTraining({ version, costApproved: false, records });
    expect(prepared.launched).toBe(false);
    expect(prepared.auditEvent).toBe("SYNTHETIC_ONLY_BYPASS");
    expect(prepared.reason).toContain("Training cost is not approved");
    const waiting = connectTrainingJob({ version: null, costApproved: false });
    expect(waiting.connected).toBe(true);
    expect(waiting.launched).toBe(false);
    expect(waiting.status).toBe("WAITING_FOR_STILLS");
    const armed = connectTrainingJob({ version, records, costApproved: false });
    expect(armed.status).toBe("READY");
    expect(armed.launched).toBe(false);
  });
});
