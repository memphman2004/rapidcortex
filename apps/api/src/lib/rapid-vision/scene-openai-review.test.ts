import { afterEach, describe, expect, it, vi } from "vitest";

const createVisionJsonResponse = vi.fn();

vi.mock("../rapid-iq/openai-client.js", () => ({
  createVisionJsonResponse: (...args: unknown[]) => createVisionJsonResponse(...args),
}));

describe("reviewSceneFrames", () => {
  afterEach(() => {
    createVisionJsonResponse.mockReset();
    delete process.env.SCENE_OPENAI_REVIEW_ENABLED;
  });

  it("does not call OpenAI while review is closed", async () => {
    const { reviewSceneFrames } = await import("./scene-openai-review.js");
    const result = await reviewSceneFrames({
      eventId: "evt",
      cameraId: "cam",
      frames: ["https://upload.wikimedia.org/wikipedia/commons/example.jpg"],
      agencyTransferApproved: true,
    });
    expect(result).toMatchObject({ ok: false, sent: false });
    expect(createVisionJsonResponse).not.toHaveBeenCalled();
  });

  it("rejects a response that clears human review", async () => {
    const { parseSceneVisualReview } = await import("./scene-openai-review.js");
    const result = parseSceneVisualReview({
      eventId: "evt",
      cameraId: "cam",
      category: "FIREARM_LIKE_OBJECT",
      possibleObjectPresent: true,
      description: "A handgun shape is visible in the camera wearer's hand.",
      visibleEvidence: ["slide", "grip"],
      alternativeExplanations: [],
      uncertainty: "LOW",
      requiresHumanReview: false,
      modelId: "gpt-6.1-terra",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a schema-valid review", async () => {
    const { parseSceneVisualReview } = await import("./scene-openai-review.js");
    const result = parseSceneVisualReview({
      eventId: "evt",
      cameraId: "cam",
      category: "FIREARM_LIKE_OBJECT",
      possibleObjectPresent: true,
      description: "A handgun shape is visible in the camera wearer's hand.",
      visibleEvidence: ["slide", "grip", "trigger guard"],
      alternativeExplanations: ["The object is held by the person wearing the camera."],
      uncertainty: "LOW",
      requiresHumanReview: true,
      modelId: "gpt-6.1-terra",
    });
    expect(result.ok).toBe(true);
  });
});