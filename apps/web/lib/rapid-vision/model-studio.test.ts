import { describe, expect, it } from "vitest";
import {
  blockedDiscoveryUrl,
  canEnterProduction,
  licenseAllowsTraining,
  reviewDiscoveryCandidate,
  startTrainingJob,
  type DiscoveryCandidate,
} from "./model-studio";

const candidate: DiscoveryCandidate = {
  id: "ov-1",
  title: "Example",
  mediaType: "image",
  source: "openverse",
  sourceUrl: "https://openverse.org/image/1",
  previewUrl: null,
  creator: "Example creator",
  license: "by",
  trainable: true,
  review: "pending",
};

describe("model studio safeguards", () => {
  it("treats an open license as reviewable and a non-commercial license as ineligible", () => {
    expect(licenseAllowsTraining("by")).toBe(true);
    expect(licenseAllowsTraining("cc0")).toBe(true);
    expect(licenseAllowsTraining("by-nc")).toBe(false);
    expect(licenseAllowsTraining("by-nd")).toBe(false);
    expect(licenseAllowsTraining("")).toBe(false);
  });

  it("blocks video sites and private hosts", () => {
    expect(blockedDiscoveryUrl("https://www.youtube.com/watch?v=abc")).toMatch(/not an approved/);
    expect(blockedDiscoveryUrl("https://127.0.0.1/secret")).toMatch(/Private/);
    expect(blockedDiscoveryUrl("http://commons.wikimedia.org/wiki/File:A")).toMatch(/HTTPS/);
  });

  it("does not turn a web result into a scene incident or a training file", () => {
    const approved = reviewDiscoveryCandidate(candidate, "approve");
    expect(approved.createsSceneIncident).toBe(false);
    expect(approved.trainingEligible).toBe(false);
    expect(approved.ok).toBe(true);
    const blocked = reviewDiscoveryCandidate({ ...candidate, license: "by-nc", trainable: false }, "approve");
    expect(blocked.ok).toBe(false);
    expect(blocked.createsSceneIncident).toBe(false);
  });

  it("does not start training or production without a connected backend and an approval", () => {
    expect(startTrainingJob({ datasetReady: true, backendConnected: false }).progress).toBeNull();
    expect(startTrainingJob({ datasetReady: true, backendConnected: false }).status).toBe("NOT_STARTED");
    expect(canEnterProduction({ phase: "TRAINING", evaluationAccepted: false, artifactUri: null }).ok).toBe(false);
    expect(canEnterProduction({ phase: "APPROVED", evaluationAccepted: true, artifactUri: "s3://models/v1" }).reason).toMatch(/closed/);
  });
});
