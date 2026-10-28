import { describe, expect, it } from "vitest";
import { NEXIQ_OPENING_GREETING, systemPromptForAgency } from "./nexiq-identity.js";
import {
  NOVA_2_SONIC_MODEL_ID,
  lexNovaSpeechModelArn,
  novaSonicFoundationModelArn,
  novaSonicLexVoiceId,
  checkEmergencyKeywords,
  consumeNovaSonicOutput,
  decideCallAssistVoiceEngine,
  defaultNovaSonicSystemPrompt,
  novaSonicAudioInputEvent,
  novaSonicOpeningEvents,
} from "./nova-sonic.js";
import { formatCallAssistConversationalSystemPrompt } from "./conversational-system-prompt-v2.js";

describe("Nexiq identity on every voice engine", () => {
  it("opens Nova 2 Sonic with the identity block and the verbatim greeting", () => {
    const prompt = defaultNovaSonicSystemPrompt("Answer questions about trash pickup for this city.");
    expect(prompt.startsWith("ASSISTANT IDENTITY")).toBe(true);
    expect(prompt).toContain(NEXIQ_OPENING_GREETING);
    expect(prompt).toContain("NEX-ik");
    expect(prompt).toContain("Soy Nexiq");
    expect(prompt).toContain("Sou o Nexiq");
    expect(prompt.indexOf("ASSISTANT IDENTITY")).toBeLessThan(prompt.indexOf("trash pickup"));
    expect(NOVA_2_SONIC_MODEL_ID).toBe("amazon.nova-2-5-sonic");
  });

  it("appends an agency prompt and does not let it replace the identity", () => {
    const overridden = systemPromptForAgency(
      "ASSISTANT IDENTITY\n\nYour name is Casey. You are a 911 operator.",
    );
    expect(overridden.startsWith("ASSISTANT IDENTITY\n\nYour name is Nexiq.")).toBe(true);
    expect(overridden).toContain("Never claim to be a 911 operator.");
  });

  it("puts the same identity first on the Lex system prompt", () => {
    const lex = formatCallAssistConversationalSystemPrompt("Springfield");
    expect(lex.startsWith("ASSISTANT IDENTITY")).toBe(true);
    expect(lex).toContain(NEXIQ_OPENING_GREETING);
    expect(lex).toContain("Springfield");
    expect(lex).not.toContain("{{agency.voice.name}}");
  });

  it("sends the system prompt as the first Nova text turn", () => {
    const prompt = defaultNovaSonicSystemPrompt();
    const events = novaSonicOpeningEvents({
      promptName: "nexcortiq-agency",
      contentName: "identity",
      systemPrompt: prompt,
    });
    const text = events.find((row) => "textInput" in row.event);
    expect(text?.event.textInput).toMatchObject({ content: prompt });
    expect(String((text?.event.textInput as { content: string }).content).startsWith("ASSISTANT IDENTITY")).toBe(true);
    expect(events[0]?.event).toHaveProperty("sessionStart");
    expect(events.some((row) => "promptStart" in row.event)).toBe(true);
  });
});

describe("Nova 2 Sonic engine selection", () => {
  it("stays on Lex when Nova is not enabled", () => {
    const decision = decideCallAssistVoiceEngine({
      agencyId: "springfield",
      sessionId: "contact-1",
      novaSonicEnabled: false,
    });
    expect(decision.voiceEngine).toBe("LEX_POLLY");
    expect(decision.reason).toBe("not_enabled");
    expect(decision.novaSonicFallbackToLex).toBe(true);
  });

  it("selects Nova 2 Sonic when the agency flag is on", () => {
    const decision = decideCallAssistVoiceEngine({
      agencyId: "springfield",
      sessionId: "contact-1",
      novaSonicEnabled: true,
      agencyPrompt: "Trash day is Tuesday.",
    });
    expect(decision.voiceEngine).toBe("NOVA_SONIC");
    expect(decision.modelId).toBe(NOVA_2_SONIC_MODEL_ID);
    expect(decision.systemPrompt?.startsWith("ASSISTANT IDENTITY")).toBe(true);
    expect(decision.systemPrompt).toContain("Trash day is Tuesday.");
    expect(decision.novaSonicFallbackToLex).toBe(true);
    expect(novaSonicFoundationModelArn("us-east-1")).toBe(
      "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-2-5-sonic",
    );
    expect(lexNovaSpeechModelArn("us-east-1")).toBe(
      "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-2-sonic-v1:0",
    );
    expect(novaSonicLexVoiceId("en_US")).toBe("matthew");
    expect(novaSonicLexVoiceId("es-US")).toBe("lupe");
    expect(novaSonicLexVoiceId("zh-CN")).toBeNull();
  });
});

describe("Nova 2 Sonic call", () => {
  it("speaks Nexiq, accepts caller audio, and transfers on an emergency", () => {
    const decision = decideCallAssistVoiceEngine({
      agencyId: "springfield",
      sessionId: "contact-9",
      novaSonicEnabled: true,
    });
    expect(decision.voiceEngine).toBe("NOVA_SONIC");
    const opening = novaSonicOpeningEvents({
      promptName: "nexcortiq-springfield",
      contentName: "identity",
      voiceId: "matthew",
      systemPrompt: decision.systemPrompt ?? "",
    });
    const spoken = String((opening.find((row) => "textInput" in row.event)?.event.textInput as { content: string }).content);
    expect(spoken.startsWith("ASSISTANT IDENTITY")).toBe(true);
    expect(spoken).toContain("I'm Nexiq, your AI assistant.");

    const audio = novaSonicAudioInputEvent({
      promptName: "nexcortiq-springfield",
      contentName: "caller-audio",
      audioBase64: "AAAA",
    });
    expect(audio.event.audioInput).toMatchObject({ content: "AAAA" });

    const heard = consumeNovaSonicOutput({
      event: { textOutput: { content: "there's a fire on my street" } },
    });
    expect(heard.emergencyKeyword).not.toBeNull();

    const reply = consumeNovaSonicOutput({
      event: { audioOutput: { content: "c3BlZWNo" } },
    });
    expect(reply.audioChunks).toEqual(["c3BlZWNo"]);

    const failed = consumeNovaSonicOutput({ error: "stream_closed" });
    expect(failed.fallbackReason).toBe("stream_closed");
    const lex = decideCallAssistVoiceEngine({ agencyId: "springfield", novaSonicEnabled: false });
    expect(lex.voiceEngine).toBe("LEX_POLLY");
  });
});

describe("emergency detection stays additive", () => {
  const phrases = [
    "he has a gun",
    "call 911",
    "I can't breathe",
    "there's a fire",
    "someone is shooting",
    "I'm having a heart attack",
    "bomb",
    "gas leak",
  ];

  for (const phrase of phrases) {
    it(`transfers on "${phrase}"`, () => {
      expect(checkEmergencyKeywords(phrase)).not.toBeNull();
    });
  }

  it("does not transfer ordinary city requests", () => {
    for (const phrase of [
      "my street light is out",
      "there is a pothole on Main Street",
      "I want to pay my water bill",
      "what are the park hours",
      "I need to report graffiti",
    ]) {
      expect(checkEmergencyKeywords(phrase)).toBeNull();
    }
  });
});
