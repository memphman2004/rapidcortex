import { describe, expect, it } from "vitest";
import {
  blockedDiscoveryUrl,
  applyRightsDecision,
  assessTrainingRights,
  buildDatasetVersion,
  canEnterProduction,
  candidateFromHuggingFace,
  candidateFromInternetArchive,
  candidateFromOpenverse,
  candidateFromWikimediaPage,
  datasetGapAnalysis,
  discoverySourceRefusal,
  licenseAllowsTraining,
  planVideoClip,
  requestMediaImport,
  reviewDiscoveryCandidate,
  sceneFitForText,
  startTrainingJob,
  titleMatchesDiscoveryFilter,
  trainingReadiness,
  withinMediaBounds,
  type DiscoveryCandidate,
} from "./model-studio";

const candidate: DiscoveryCandidate = {
  id: "ov-1",
  title: "Example",
  mediaType: "image",
  source: "openverse",
  sourceUrl: "https://openverse.org/image/1",
  previewUrl: null,
  playbackUrl: null,
  creator: "Example creator",
  license: "by",
  trainable: true,
  review: "pending",
  width: 1200,
  height: 800,
  durationSeconds: null,
  sceneFit: "unknown",
  fitNote: "Scene fit is unknown from the title.",
  attribution: null,
  hasVideo: false,
  exampleRole: "unspecified",
};

describe("model studio safeguards", () => {
  it("treats an open license as reviewable and a non-commercial license as ineligible", () => {
    expect(licenseAllowsTraining("by")).toBe(true);
    expect(licenseAllowsTraining("cc0")).toBe(true);
    expect(licenseAllowsTraining("CC BY 4.0")).toBe(true);
    expect(licenseAllowsTraining("CC BY-SA 4.0")).toBe(true);
    expect(licenseAllowsTraining("Open Government Licence v1.0")).toBe(true);
    expect(licenseAllowsTraining("Public domain")).toBe(true);
    expect(licenseAllowsTraining("by-nc")).toBe(false);
    expect(licenseAllowsTraining("CC BY-NC-SA 4.0")).toBe(false);
    expect(licenseAllowsTraining("by-nd")).toBe(false);
    expect(licenseAllowsTraining("")).toBe(false);
    expect(licenseAllowsTraining("unspecified")).toBe(false);
  });

  it("reads a Commons license and drops a non-image file", () => {
    const glock = candidateFromWikimediaPage({
      pageid: 45154998,
      title: "File:Glock 17 MOD 45154998.jpg",
      imageinfo: [{
        descriptionurl: "https://commons.wikimedia.org/wiki/File:Glock_17_MOD_45154998.jpg",
        thumburl: "https://upload.wikimedia.org/thumb/glock.jpg",
        mime: "image/jpeg",
        width: 3000,
        height: 1934,
        extmetadata: {
          LicenseShortName: { value: "Open Government Licence v1.0" },
          Artist: { value: "<a href=\"https://example.test\">Andrew Linnett</a>" },
          Attribution: { value: "Photo: Andrew Linnett/MOD" },
        },
      }],
    });
    expect(glock?.trainable).toBe(true);
    expect(glock?.license).toBe("Open Government Licence v1.0");
    expect(glock?.creator).toBe("Andrew Linnett");
    expect(glock?.attribution).toBe("Photo: Andrew Linnett/MOD");
    expect(glock?.previewUrl).toContain("https://");
    expect(candidateFromWikimediaPage({
      title: "File:Manual.pdf",
      imageinfo: [{ descriptionurl: "https://commons.wikimedia.org/wiki/File:Manual.pdf", mime: "application/pdf" }],
    })).toBeNull();
  });

  it("marks a product photo as a shape reference and a non-commercial hit as ineligible", () => {
    expect(sceneFitForText("handgun product photo", "image").sceneFit).toBe("studio");
    expect(sceneFitForText("CCTV platform footage", "image").sceneFit).toBe("scene");
    const product = candidateFromOpenverse({
      id: "1",
      title: "handgun product photo",
      license: "by",
      license_version: "4.0",
      foreign_landing_url: "https://openverse.org/image/1",
      creator: "Example",
      width: 800,
      height: 600,
    });
    expect(product?.trainable).toBe(true);
    expect(product?.sceneFit).toBe("studio");
    expect(product?.license).toBe("CC BY 4.0");
    const blocked = candidateFromOpenverse({
      id: "2",
      title: "handgun",
      license: "by-nc",
      foreign_landing_url: "https://openverse.org/image/2",
    });
    expect(blocked?.trainable).toBe(false);
    const dataset = candidateFromHuggingFace({ id: "org/guns", author: "org", tags: ["license:cc-by-4.0"] });
    expect(dataset?.trainable).toBe(true);
    expect(dataset?.sceneFit).toBe("dataset");
    expect(candidateFromHuggingFace({ id: "../secret" })).toBeNull();
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
    const studio = reviewDiscoveryCandidate({ ...candidate, sceneFit: "studio", title: "handgun product photo" }, "approve");
    expect(studio.ok).toBe(true);
    expect(studio.reason).toMatch(/shape reference/);
    expect(studio.trainingEligible).toBe(false);
    const offHost = reviewDiscoveryCandidate({ ...candidate, sourceUrl: "https://www.youtube.com/watch?v=abc" }, "approve");
    expect(offHost.ok).toBe(false);
  });

  it("does not start training or production without a connected backend and an approval", () => {
    expect(startTrainingJob({ datasetReady: true, backendConnected: false }).progress).toBeNull();
    expect(startTrainingJob({ datasetReady: true, backendConnected: false }).status).toBe("NOT_STARTED");
    expect(canEnterProduction({ phase: "TRAINING", evaluationAccepted: false, artifactUri: null }).ok).toBe(false);
    expect(canEnterProduction({ phase: "APPROVED", evaluationAccepted: true, artifactUri: "s3://models/v1" }).reason).toMatch(/closed/);
  });

  it("plays a Commons video from Wikimedia and links Internet Archive without downloading it", () => {
    const video = candidateFromWikimediaPage({
      pageid: 9,
      title: "File:Garage camera.webm",
      imageinfo: [{
        descriptionurl: "https://commons.wikimedia.org/wiki/File:Garage_camera.webm",
        url: "https://upload.wikimedia.org/wikipedia/commons/garage.webm",
        thumburl: "https://upload.wikimedia.org/wikipedia/commons/thumb/garage.jpg",
        mime: "video/webm",
        duration: 45,
        width: 1280,
        height: 720,
        extmetadata: { LicenseShortName: { value: "CC BY 4.0" } },
      }],
    }, { media: "video" });
    expect(video?.mediaType).toBe("video");
    expect(video?.playbackUrl).toContain("upload.wikimedia.org");
    expect(video?.durationSeconds).toBe(45);
    expect(candidateFromWikimediaPage({
      title: "File:Offsite.webm",
      imageinfo: [{
        descriptionurl: "https://commons.wikimedia.org/wiki/File:Offsite.webm",
        url: "https://evil.example/video.webm",
        mime: "video/webm",
        extmetadata: { LicenseShortName: { value: "CC BY 4.0" } },
      }],
    }, { media: "video" })?.playbackUrl).toBeNull();
    const archive = candidateFromInternetArchive({
      identifier: "garage-film",
      title: "Garage film",
      licenseurl: "https://creativecommons.org/licenses/by/4.0/",
    });
    expect(archive?.playbackUrl).toBeNull();
    expect(archive?.trainable).toBe(true);
    expect(archive?.sourceUrl).toBe("https://archive.org/details/garage-film");
    expect(candidateFromInternetArchive({ identifier: "../secret", title: "no" })).toBeNull();
    expect(discoverySourceRefusal("pexels")).toMatch(/not used/);
    expect(discoverySourceRefusal("youtube")).toMatch(/disabled/i);
  });

  it("notes a clip interval without writing a file and reports missing video examples", () => {
    expect(planVideoClip({ durationSeconds: 45, startSeconds: 12, endSeconds: 22 }).reason).toMatch(/not connected/);
    expect(planVideoClip({ durationSeconds: 45, startSeconds: 40, endSeconds: 50 }).reason).toMatch(/after the recording/);
    expect(buildDatasetVersion({ approvedForTraining: 0 }).ok).toBe(false);
    const gaps = datasetGapAnalysis([{
      category: "person_down",
      sceneFit: "scene",
      title: "person on the floor",
      mediaType: "image",
      role: "positive",
    }]);
    expect(gaps.some((gap) => gap.need.includes("video interval"))).toBe(true);
    expect(gaps.some((gap) => gap.category === "Firearm-like object")).toBe(true);
    expect(titleMatchesDiscoveryFilter("south garage night", { environment: "parking garage", lighting: "night" })).toBe(true);
    expect(titleMatchesDiscoveryFilter("studio product photo", { environment: "parking garage" })).toBe(false);
    expect(gaps.some((gap) => gap.need.includes("coverage unknown"))).toBe(true);
  });

  it("requires a person to approve an open license and blocks a restricted one", () => {
    const open = assessTrainingRights({ license: "CC BY 4.0", source: "wikimedia" });
    expect(open.status).toBe("REVIEW_REQUIRED");
    expect(open.legalGuarantee).toBe(false);
    const verified = applyRightsDecision({ current: open, decision: "verify-license", reviewerId: "admin", at: "2026-10-29T00:00:00.000Z" });
    expect(verified.record.status).toBe("LICENSE_VERIFIED");
    const skipped = applyRightsDecision({ current: open, decision: "approve-training", reviewerId: "admin", at: "2026-10-29T00:00:00.000Z" });
    expect(skipped.ok).toBe(false);
    const restricted = assessTrainingRights({ license: "CC BY-NC 4.0", source: "openverse" });
    expect(restricted.status).toBe("RESTRICTED");
    expect(applyRightsDecision({ current: restricted, decision: "verify-license", reviewerId: "admin", at: "2026-10-29T00:00:00.000Z" }).ok).toBe(false);
    expect(requestMediaImport({ status: "REVIEW_REQUIRED", storageConnected: true }).reason).toMatch(/refused/);
    expect(requestMediaImport({ status: "APPROVED_FOR_TRAINING", storageConnected: false }).reason).toMatch(/not connected/);
    expect(assessTrainingRights({ license: "unspecified", source: "youtube" }).status).toBe("RESTRICTED");
    const card = trainingReadiness("person_down", [], false);
    expect(card.headline).toBe("Needs review");
    expect(card.factors.find((factor) => factor.name === "Held-out model evaluation")?.state).toBe("not_completed");
    expect(card.search.media).toBe("video");
    expect(withinMediaBounds({ durationSeconds: null, width: 1920 }, { minDuration: 5 }).toString()).toBe("missing");
  });
});
