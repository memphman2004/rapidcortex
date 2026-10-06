import { describe, expect, it } from "vitest";
import { buildWelcomeMessage, classifyKeyword, isSessionResetRequest } from "./compliance.js";
import { buildSmsConfirmation, extractConfirmationFromText, formatForSms } from "./message-formatter.js";

describe("311 SMS compliance keywords", () => {
  it("treats STOP variants as opt-out and does not treat YES as START", () => {
    expect(classifyKeyword("stop")).toBe("STOP");
    expect(classifyKeyword("UNSUBSCRIBE")).toBe("STOP");
    expect(classifyKeyword("yes")).toBe("NONE");
    expect(classifyKeyword("START")).toBe("START");
    expect(classifyKeyword("help")).toBe("HELP");
  });

  it("resets on start over without treating cancel as STOP", () => {
    expect(isSessionResetRequest("start over")).toBe(true);
    expect(classifyKeyword("cancel")).toBe("NONE");
  });
});

describe("311 SMS message formatter", () => {
  it("strips SSML and voice filler", () => {
    expect(formatForSms([{ content: "<speak>Please hold while I look. What is the address?</speak>" }])).toBe(
      "What is the address?",
    );
  });

  it("strips voice IVR greeting so SMS only asks the next question", () => {
    expect(
      formatForSms([
        {
          content:
            "You've reached the non-emergency service line for Kansas City. If this is a life-threatening emergency, hang up and dial 9-1-1. For all other requests, stay on the line. What's the location — address or nearest intersection?",
        },
      ]),
    ).toBe("What's the location — address or nearest intersection?");
  });

  it("does not leave For all other requests fragments after stripping stay on the line", () => {
    expect(
      formatForSms([
        {
          content:
            "You've reached the non-emergency service line for Kansas City. If this is a life-threatening emergency, hang up and dial 9-1-1. For all other requests, stay on the line. You can also text us at (319) 835-8230.",
        },
      ]),
    ).toMatch(/What non-emergency issue/i);
  });

  it("strips voice transfer filler used on fallback intents", () => {
    expect(
      formatForSms([{ content: "Having trouble with that — connecting you to someone who can help." }]),
    ).toMatch(/What non-emergency issue|HELP for options/i);
  });

  it("exports reserved compliance keywords that keyword table must not serve", async () => {
    const { RESERVED_COMPLIANCE_KEYWORDS } = await import("./compliance.js");
    expect(RESERVED_COMPLIANCE_KEYWORDS.has("HELP")).toBe(true);
    expect(RESERVED_COMPLIANCE_KEYWORDS.has("STOP")).toBe(true);
    expect(RESERVED_COMPLIANCE_KEYWORDS.has("TRASH")).toBe(false);
  });

  it("builds the agency-branded welcome as one SMS segment", async () => {
    const { splitIntoSegments, SMS_MAX_MESSAGE_CHARS } = await import("./message-formatter.js");
    const welcome = buildWelcomeMessage({
      agencyDisplayName: "Kansas City",
      voiceDidE164: "+18165550100",
    });
    expect(welcome).toContain("Kansas City Non-Emergency");
    expect(welcome).not.toContain("Non-Emergency and Services");
    expect(welcome).toContain("Prefer to speak with someone? Call (816) 555-0100.");
    expect(welcome).toContain('Example: "There\'s a large pothole on Oak Street');
    expect(welcome).toContain("Reply STOP to unsubscribe · HELP for options.");
    expect(welcome.length).toBeLessThan(SMS_MAX_MESSAGE_CHARS);
    expect(splitIntoSegments(welcome)).toEqual([welcome]);
  });

  it("extracts Call Assist confirmation numbers", () => {
    expect(extractConfirmationFromText("Your report number is KC-1001-7M4R.")).toBe("KC-1001-7M4R");
  });

  it("builds the same confirmation a voice caller gets by SMS", () => {
    expect(
      buildSmsConfirmation({
        confirmationNumber: "KC-1001-7M4R",
        agencyDisplayName: "Kansas City",
        department: "public_works",
        mediaCount: 2,
      }),
    ).toContain("Media: 2 file(s) attached");
  });
});

describe("311 SMS media labels", () => {
  it("maps road damage labels to pothole", async () => {
    const { inferCategoryFromSceneLabels } = await import("../media-labels.js");
    expect(inferCategoryFromSceneLabels(["Road", "Damage", "Asphalt"])).toBe("POTHOLE");
    expect(inferCategoryFromSceneLabels(["Fire", "Smoke"])).toBeNull();
  });
});
