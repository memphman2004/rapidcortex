import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lex/runtime-store.js", () => ({
  getLexTenantConfig: vi.fn(async () => ({
    agencyId: "kcpd",
    agencyDisplayName: "Kansas City Police",
    novaSonicEnabled: true,
    confirmationPrefix: "KC",
    updatedAt: new Date().toISOString(),
  })),
}));

vi.mock("./session-record.js", () => ({
  loadTenantForNova: vi.fn(async () => ({
    agencyId: "kcpd",
    agencyDisplayName: "Kansas City Police",
    novaSonicEnabled: true,
    confirmationPrefix: "KC",
    updatedAt: new Date().toISOString(),
  })),
  putNovaSonicSession: vi.fn(async () => undefined),
  novaSonicSessionId: (contactId: string) => `nova#${contactId}`,
  novaSonicSessionSk: (contactId: string) => `SESSION#nova#${contactId}`,
}));

import { buildNovaSessionStartResult } from "./session-start-handler.js";
import { putNovaSonicSession } from "./session-record.js";

describe("NovaSessionStart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes SESSION#nova#{contactId} and returns NOVA_SONIC attrs", async () => {
    const result = await buildNovaSessionStartResult({
      Details: {
        Parameters: { agencyId: "kcpd" },
        ContactData: { ContactId: "contact-abc" },
      },
    });
    expect(result.voiceEngine).toBe("NOVA_SONIC");
    expect(result.agencyVoiceName).toBe("Kansas City Police");
    expect(result.novaSessionId).toBe("nova#contact-abc");
    expect(result.systemPromptReady).toBe("true");
    expect(putNovaSonicSession).toHaveBeenCalled();
    const row = vi.mocked(putNovaSonicSession).mock.calls[0]?.[0];
    expect(row?.sk).toBe("SESSION#nova#contact-abc");
    expect(row?.systemPrompt).toContain("ASSISTANT IDENTITY");
    expect(row?.systemPrompt).toContain("Kansas City Police");
  });

  it("falls back when agency or contact missing", async () => {
    const result = await buildNovaSessionStartResult({ Details: { Parameters: {} } });
    expect(result.novaSonicFallbackToLex).toBe("true");
    expect(result.voiceEngine).toBe("LEX_POLLY");
  });
});
