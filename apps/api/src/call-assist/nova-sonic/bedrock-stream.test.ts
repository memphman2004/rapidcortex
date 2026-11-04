import { describe, expect, it } from "vitest";
import { mockTextAudioChunk, runNovaSonicStreamMock } from "./bedrock-stream.js";

async function* chunks(...texts: string[]) {
  for (const t of texts) yield mockTextAudioChunk(t);
}

describe("Nova Sonic stream mock", () => {
  it("issues a report number for an abandoned vehicle", async () => {
    const result = await runNovaSonicStreamMock({
      agencyId: "kcpd",
      contactId: "c1",
      promptName: "nexcortiq-kcpd",
      systemPrompt: "ASSISTANT IDENTITY\nYou are Nexiq.",
      config: { confirmationPrefix: "KC" } as never,
      audioSource: chunks(
        "There's a car been sitting on my street for three days.",
        "4500 Warwick",
        "That's all, can I get my report number?",
      ),
    });
    expect(result.handoff.callerDone).toBe("true");
    expect(result.handoff.novaSessionStatus).toBe("COMPLETED");
    expect(result.intake.confirmationNumber).toMatch(/^KC-/);
    expect(result.fallbackReason).toBeNull();
  });

  it("transfers on emergency keywords", async () => {
    const result = await runNovaSonicStreamMock({
      agencyId: "kcpd",
      contactId: "c2",
      promptName: "nexcortiq-kcpd",
      systemPrompt: "ASSISTANT IDENTITY",
      audioSource: chunks("there's a fire in my kitchen"),
    });
    expect(result.handoff.emergencyEscalation).toBe("true");
    expect(result.handoff.novaSessionStatus).toBe("EMERGENCY");
  });

  it("falls back to Lex when caller asks for a human", async () => {
    const result = await runNovaSonicStreamMock({
      agencyId: "kcpd",
      contactId: "c3",
      promptName: "nexcortiq-kcpd",
      systemPrompt: "ASSISTANT IDENTITY",
      audioSource: chunks("I need to speak to a real person"),
    });
    expect(result.handoff.novaSonicFallbackToLex).toBe("true");
    expect(result.handoff.novaSessionStatus).toBe("HUMAN");
  });
});
