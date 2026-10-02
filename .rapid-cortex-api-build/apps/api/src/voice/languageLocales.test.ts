import { describe, expect, it } from "vitest";
import { toAzureTtsVoice } from "./languageLocales.js";

describe("toAzureTtsVoice", () => {
  it("picks Jenny for English female default", () => {
    expect(toAzureTtsVoice("en")).toEqual({ locale: "en-US", voiceName: "en-US-JennyNeural" });
  });

  it("picks Alonso for Spanish male", () => {
    expect(toAzureTtsVoice("es-US", "MALE")).toEqual({ locale: "es-US", voiceName: "es-US-AlonsoNeural" });
  });

  it("maps Tagalog to Filipino neural voices", () => {
    expect(toAzureTtsVoice("tl").voiceName).toBe("fil-PH-BlessicaNeural");
  });
});
