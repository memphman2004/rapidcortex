import { describe, expect, it } from "vitest";
import { isRcStaff } from "rapid-cortex-security";
import {
  assembleDatasetVersion,
  confirmBatchPlan,
  prepareSageMakerTraining,
  type StudioReviewRecord,
} from "./studio-dataset";
import { adjustStudioBox, clearStudioBox, verifyMediaRights, verifyTrainingLabel } from "./studio-review-gates";

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
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Glock_17_MOD_45154998.jpg",
};

describe("studio review gates", () => {
  it("keeps the Commons photograph blocked until rights fields are complete", () => {
    const result = verifyMediaRights(commons, { author: "Andrew Linnett" }, "ada@nexcortiq.us", "2026-10-30T16:00:00.000Z");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("stays blocked");
  });

  it("records rights without turning the row into a training label", () => {
    const result = verifyMediaRights(
      commons,
      {
        author: "Andrew Linnett/MOD",
        license: "Open Government Licence v1.0",
        privacy: "No person is identifiable.",
        commercialUse: "permitted",
        sourceUrl: commons.sourceUrl,
      },
      "ada@nexcortiq.us",
      "2026-10-30T16:00:00.000Z",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.rightsStatus).toBe("LICENSE_VERIFIED");
      expect(result.record.trainingLabel).toBe(false);
      expect(result.record.approved).toBe(false);
    }
  });

  it("refuses a label verification before the candidate is accepted", () => {
    const result = verifyTrainingLabel(commons, "ada@nexcortiq.us", "2026-10-30T16:00:00.000Z");
    expect(result.ok).toBe(false);
  });

  it("rejects a box that leaves the image", () => {
    const result = adjustStudioBox(commons, { x: 0.8, y: 0.8, width: 0.4, height: 0.4 }, "ada@nexcortiq.us", "2026-10-30T16:00:00.000Z");
    expect(result.ok).toBe(false);
  });

  it("does not create a dataset version from unverified rows", () => {
    const built = assembleDatasetVersion([commons], { reviewer: "ada@nexcortiq.us", now: "2026-10-30T16:00:00.000Z", version: 1 });
    expect(built.ok).toBe(false);
  });

  it("asks for confirmation before a 10-image batch and does not launch training", () => {
    const plan = confirmBatchPlan({
      category: "firearm_like",
      count: 10,
      spentUsd: 0,
      capUsd: 5,
      batchEnabled: true,
      confirmed: false,
      activeJob: false,
    });
    expect(plan.ok).toBe(false);
    expect(plan.estimatedUsd).toBe(0.4);
    const training = prepareSageMakerTraining({ version: null, costApproved: true });
    expect(training.launched).toBe(false);
  });

  it("refuses label verification without a box, and when the object cannot be identified", () => {
    const accepted: StudioReviewRecord = {
      ...commons,
      synthetic: true,
      status: "APPROVED",
      approved: true,
      rightsStatus: "synthetic_internal",
      rightsVerifiedAt: "2026-10-30T16:00:00.000Z",
    };
    const missing = verifyTrainingLabel(accepted, "ada@nexcortiq.us", "2026-10-30T16:10:00.000Z");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toContain("Draw a box");
    const boxed = { ...accepted, box: { x: 0.2, y: 0.2, width: 0.3, height: 0.25 } };
    const hidden = verifyTrainingLabel(boxed, "ada@nexcortiq.us", "2026-10-30T16:10:00.000Z", undefined, { identifiable: false });
    expect(hidden.ok).toBe(false);
    if (!hidden.ok) expect(hidden.reason).toContain("cannot be identified");
    const verified = verifyTrainingLabel(boxed, "ada@nexcortiq.us", "2026-10-30T16:10:00.000Z");
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.record.trainingLabel).toBe(true);
  });

  it("clears a box without turning the row into a training label", () => {
    const cleared = clearStudioBox({ ...commons, box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, trainingLabel: true }, "ada@nexcortiq.us", "2026-10-30T16:10:00.000Z");
    expect(cleared.record.box).toBeNull();
    expect(cleared.record.trainingLabel).toBe(false);
  });

  it("hides the studio from a dispatcher and allows RC staff", () => {
    expect(isRcStaff("dispatcher")).toBe(false);
    expect(isRcStaff("rcadmin")).toBe(true);
    expect(isRcStaff("rcitadmin")).toBe(true);
    expect(isRcStaff("rcsuperadmin")).toBe(true);
  });
});
