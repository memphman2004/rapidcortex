import { describe, expect, it } from "vitest";
import { ResponseGenerator } from "./response-generator.js";
import {
  CALL_ASSIST_CONVERSATIONAL_SYSTEM_PROMPT_V2,
  formatCallAssistConversationalSystemPrompt,
} from "./conversational-system-prompt-v2.js";
import { DEFAULT_CALL_ASSIST_PROMPTS } from "./prompt-cms.js";

const BANNED = [
  "Of course",
  "Thank you for calling",
  "I appreciate you sharing",
  "Is there anything else I can help",
  "Have a great day",
];

describe("ResponseGenerator", () => {
  const spoken = new ResponseGenerator({
    agencyDisplayName: "Fulton County 911",
    agencyShortName: "Fulton County",
    officerLabel: "officer",
    emergencyLine: "911",
  });

  it("uses short speech-rule closings and emergency line", () => {
    expect(spoken.incidentCreated("FC-1001-7M4R")).toContain("Your report number is FC-1001-7M4R");
    expect(spoken.incidentCreated("FC-1001-7M4R")).toContain("We've got it");
    expect(spoken.humanTransfer()).toContain("Connecting you to a Fulton County officer");
    expect(spoken.humanTransfer()).not.toContain("Of course");
    expect(spoken.emergencyTransfer()).toBe("This sounds like an emergency — let me connect you now.");
    expect(spoken.opening()).toBe("How can I help you today?");
  });

  it("never speaks banned corporate phrases in defaults", () => {
    const blob = [
      spoken.incidentCreated("FC-1001"),
      spoken.humanTransfer(),
      spoken.opening(),
      spoken.emergencyTransfer(),
      spoken.fallbackTransfer(),
      ...Object.values(DEFAULT_CALL_ASSIST_PROMPTS),
    ].join(" ");
    for (const phrase of BANNED) {
      expect(blob).not.toContain(phrase);
    }
    expect(blob).not.toMatch(/Kansas City|KCPD|kcpd\.org|Troost/i);
  });

  it("interpolates disclosure placeholders from config", () => {
    const withDisclosure = new ResponseGenerator({
      agencyDisplayName: "Fulton County 911",
      agencyShortName: "Fulton County",
      officerLabel: "officer",
      emergencyLine: "911",
      disclosureText: "You are speaking with an AI assistant for {{agencyShortName}}.",
    });
    expect(withDisclosure.opening()).toBe("You are speaking with an AI assistant for Fulton County.");
    expect(withDisclosure.opening()).not.toMatch(/\{\{/);
  });
});

describe("conversational system prompt v2", () => {
  it("interpolates agency voice name and keeps absolute speech rules", () => {
    const body = formatCallAssistConversationalSystemPrompt("Kansas City non-emergency");
    expect(body).toContain("Kansas City non-emergency");
    expect(body).not.toContain("{{agency.voice.name}}");
    expect(body).toContain("ABSOLUTE SPEECH RULES");
    expect(body).toContain("ONE QUESTION PER TURN");
    expect(CALL_ASSIST_CONVERSATIONAL_SYSTEM_PROMPT_V2).toContain("{{agency.voice.name}}");
  });
});
