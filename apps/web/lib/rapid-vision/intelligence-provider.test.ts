import { describe, expect, it } from "vitest";
import { intelligenceProviderStatus, refuseFrameExport, type StudioDiagnostic } from "./intelligence-provider";

const diagnostic: StudioDiagnostic = {
  checkedAt: "2026-10-30T14:44:07.714Z",
  secretRetrieval: "PASS",
  secretFormat: "json fields: apiKey",
  executionRole: "PASS",
  authentication: "PASS",
  authenticationDetail: "ready",
  models: [
    { id: "gpt-6.1-sol", listed: true, request: "PASS", detail: "retrieve succeeded" },
    { id: "gpt-6.1-terra", listed: true, request: "PASS", detail: "retrieve succeeded" },
    { id: "gpt-6-luna", listed: true, request: "PASS", detail: "retrieve succeeded" },
    { id: "gpt-image-2.5-flare", listed: true, request: "PASS", detail: "retrieve succeeded" },
    { id: "gpt-image-2.5-sunburst", listed: true, request: "PASS", detail: "retrieve succeeded" },
  ],
  visualAnalysis: "PASS",
  visualDetail: "Structured review returned.",
  imageGeneration: "PASS",
  imageDetail: "Image written.",
  lastSuccessAt: "2026-10-30T14:44:26.121Z",
  lastError: null,
  usage: { inputTokens: 342, outputTokens: 155, totalTokens: 744, imageOutputTokens: 196 },
  queue: [
    {
      id: "visual-glock-commons",
      kind: "visual-review",
      status: "REVIEW_REQUIRED",
      approved: false,
      modelId: "gpt-6.1-terra",
      createdAt: "2026-10-30T14:44:16.733Z",
      objects: ["Handgun"],
    },
  ],
};

describe("intelligenceProviderStatus", () => {
  it("keeps the existing secret name and does not expose a key", () => {
    const status = intelligenceProviderStatus();
    expect(status.secretName).toBe("rapid-cortex/ai/openai");
    expect(status.keyExposedToBrowser).toBe(false);
    expect(status.frameReview).toBe("closed");
    expect(status.detector).toBe("NOT_CONFIGURED");
    expect(status.connection).toBe("NOT_RUN");
    expect(status.estimatedCostUsd).toBeNull();
  });

  it("shows a saved diagnostic without approving the queue", () => {
    const status = intelligenceProviderStatus(diagnostic);
    expect(status.connection).toBe("PASS");
    expect(status.visualAnalysis).toBe("PASS");
    expect(status.imageGeneration).toBe("PASS");
    expect(status.models.every((item) => item.availability === "accessible")).toBe(true);
    expect(status.queue.every((item) => item.approved === false && item.status === "REVIEW_REQUIRED")).toBe(true);
  });

  it("refuses to export a frame", () => {
    expect(refuseFrameExport().sent).toBe(false);
  });
});
