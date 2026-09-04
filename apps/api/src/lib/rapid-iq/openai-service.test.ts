import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RapidIqIntelSourceDocument } from "rapid-cortex-shared";

const createJsonResponse = vi.fn();

vi.mock("./openai-client.js", () => ({
  createJsonResponse: (...args: unknown[]) => createJsonResponse(...args),
}));

vi.mock("./agenda-finder.js", () => ({
  isCollectorsMockEnabled: () => false,
}));

describe("openai-service malformed output", () => {
  beforeEach(() => {
    createJsonResponse.mockReset();
    process.env.RAPID_IQ_AI_ENABLED = "true";
    process.env.RAPID_IQ_COLLECTORS_MOCK = "false";
  });

  it("falls back to heuristics when structured output is invalid", async () => {
    createJsonResponse.mockResolvedValue({ text: "not-json", model: "gpt-4o-mini" });
    vi.resetModules();
    const { classifyProcurementSignal } = await import("./openai-service.js");
    const doc: RapidIqIntelSourceDocument = {
      sourceId: "s",
      url: "https://example.com/agenda",
      title: "Transit police CAD modernization board agenda",
      text: "Budget discussion for public safety communications and rider reporting",
      retrievedAt: "2026-09-02T00:00:00.000Z",
      sourceType: "web_page",
      sourceName: "CTA",
      metadata: { agency: "CTA" },
    };
    const out = await classifyProcurementSignal(doc, "TRANSIT");
    expect(out.heuristic).toBe(true);
    expect(out.result.market).toBe("TRANSIT");
    expect(typeof out.result.estimatedFit).toBe("number");
  });

  it("does not call OpenAI when AI is disabled", async () => {
    process.env.RAPIDIQ_AI_ENABLED = "false";
    vi.resetModules();
    const { analyzeOpportunity } = await import("./openai-service.js");
    const doc: RapidIqIntelSourceDocument = {
      sourceId: "s",
      url: "https://example.com",
      title: "NG911 RFP",
      text: "Request for proposal CAD dispatch interoperability",
      retrievedAt: "2026-09-02T00:00:00.000Z",
      sourceType: "web_page",
    };
    const out = await analyzeOpportunity(doc, "PSAP");
    expect(out.heuristic).toBe(true);
    expect(createJsonResponse).not.toHaveBeenCalled();
  });
});
