import { describe, expect, it } from "vitest";
import { combineVoiceEmotion, mergeVoiceDistressIntoSafety, scoreDistressFromTranscript } from "./voice-emotion.js";
import { evaluateSafety } from "./safety.js";

describe("voice emotion / distress", () => {
  it("scores panic lexicon as critical and merge escalates non-emergency safety", () => {
    const lexical = scoreDistressFromTranscript("please help me he's going to kill me");
    expect(lexical.distressLevel).toBe("CRITICAL");
    const emotion = combineVoiceEmotion({
      transcript: "please help me he's going to kill me",
      source: "lexicon",
    });
    expect(emotion.escalateToEmergency).toBe(true);
    const merged = mergeVoiceDistressIntoSafety(evaluateSafety("the music is loud"), emotion);
    expect(merged.action).toBe("TRANSFER_911");
    expect(merged.triggers).toContain("VOICE_DISTRESS");
  });

  it("never removes an existing 911 decision", () => {
    const gun = evaluateSafety("he has a gun");
    const calm = combineVoiceEmotion({ transcript: "thanks", source: "mock" });
    const merged = mergeVoiceDistressIntoSafety(gun, calm);
    expect(merged.action).toBe("TRANSFER_911");
  });
});
