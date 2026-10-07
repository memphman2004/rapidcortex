import { describe, expect, it } from "vitest";
import { detectSmsLanguage, fromEnglishToCitizen, toEnglishForLex } from "./translate.js";

describe("SMS language detect/translate (mock)", () => {
  it("detects Spanish and translates both directions", async () => {
    process.env.CALL_ASSIST_SMS_TRANSLATE_MOCK = "true";
    expect(await detectSmsLanguage("Hay un bache en la calle")).toBe("es");
    expect(await toEnglishForLex("Hay un bache en la calle", "es")).toMatch(/pothole/i);
    expect(await fromEnglishToCitizen("What's the address or nearest intersection?", "es")).toMatch(
      /direcci[oó]n/i,
    );
  });

  it("keeps English unchanged", async () => {
    process.env.CALL_ASSIST_SMS_TRANSLATE_MOCK = "true";
    expect(await detectSmsLanguage("There is a pothole on Oak Street")).toBe("en");
    expect(await toEnglishForLex("There is a pothole on Oak Street", "en")).toBe(
      "There is a pothole on Oak Street",
    );
  });

  it("keeps prior language on short yes/no", async () => {
    process.env.CALL_ASSIST_SMS_TRANSLATE_MOCK = "true";
    expect(await detectSmsLanguage("yes", "es")).toBe("es");
  });
});
