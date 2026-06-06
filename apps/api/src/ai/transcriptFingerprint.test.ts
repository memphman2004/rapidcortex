import { describe, expect, it } from "vitest";
import { fingerprintTranscript } from "./transcriptFingerprint.js";
import type { TranscriptSegment } from "rapid-cortex-shared";

describe("fingerprintTranscript", () => {
  it("changes when segment text changes", () => {
    const a: TranscriptSegment[] = [
      {
        segmentId: "s1",
        incidentId: "i",
        agencyId: "ag",
        speaker: "caller",
        text: "hello",
        timestamp: "t",
      },
    ];
    const b = [{ ...a[0]!, text: "hello2" }];
    expect(fingerprintTranscript(a)).not.toBe(fingerprintTranscript(b));
  });
});
