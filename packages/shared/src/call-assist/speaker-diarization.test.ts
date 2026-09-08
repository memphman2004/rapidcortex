import { describe, expect, it } from "vitest";
import { assignSpeakerTurns, mapConnectParticipantRole, mapTranscribeSpeakerLabel } from "./speaker-diarization.js";

describe("multiple-speaker recognition", () => {
  it("maps Connect participant roles and Transcribe speaker labels", () => {
    expect(mapConnectParticipantRole("CUSTOMER").speaker).toBe("caller");
    expect(mapConnectParticipantRole("AGENT").speaker).toBe("assistant");
    expect(mapTranscribeSpeakerLabel("spk_1").speaker).toBe("other");
    const turns = assignSpeakerTurns(
      [{ sequence: 0, speaker: "caller", text: "hello", at: "t" }],
      [{ sequence: 0, speakerId: "spk_1" }],
    );
    expect(turns[0]?.speaker).toBe("other");
    expect(turns[0]?.speakerId).toBe("spk_1");
  });
});
