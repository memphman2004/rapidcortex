import { describe, expect, it } from "vitest";
import { pickGoogleTtsVoiceName } from "./googleTextToSpeechRest.js";

describe("pickGoogleTtsVoiceName", () => {
  it("picks table voice for es-US and respects male preference", () => {
    const m = pickGoogleTtsVoiceName("es-US", "MALE");
    expect(m.voiceName).toBe("es-US-Neural2-B");
  });

  it("uses female Neural2 for Spanish by default", () => {
    const f = pickGoogleTtsVoiceName("es-US", "FEMALE");
    expect(f.voiceName).toBe("es-US-Neural2-A");
  });

  it("falls back to en-US for unknown script locales with invalid TTS name pattern", () => {
    const u = pickGoogleTtsVoiceName("zzz");
    expect(u.languageCode).toBe("en-US");
  });
});
