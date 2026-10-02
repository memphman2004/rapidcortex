import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/env.js", () => ({
  env: { sopIntelligenceClaudeMock: true },
}));

vi.mock("../lib/runtimeSecrets.js", () => ({
  resolvePlainOrSecretArn: async () => "",
}));
import { mockSopSuggestion } from "./claude.js";

describe("mockSopSuggestion", () => {
  it("keeps current language and adds an operational rule", () => {
    const out = mockSopSuggestion({
      currentLanguage: "Confirm ANI/ALI.",
      gapDescription: "Stay with stated location.",
      evidenceCount: 3,
    });
    expect(out.suggestedLanguage).toContain("Confirm ANI/ALI.");
    expect(out.suggestedLanguage).toContain("Stay with stated location.");
    expect(out.confidence).toBeGreaterThan(0);
    expect(out.evidence.length).toBeGreaterThan(0);
  });
});
