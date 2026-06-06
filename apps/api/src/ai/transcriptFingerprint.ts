import { createHash } from "node:crypto";
import type { TranscriptSegment } from "rapid-cortex-shared";

/** Stable fingerprint of transcript content + ordering for debounce / skip-if-unchanged. */
export function fingerprintTranscript(segments: TranscriptSegment[]): string {
  const h = createHash("sha256");
  for (const s of segments) {
    h.update(s.segmentId);
    h.update("\n");
    h.update(s.text);
    h.update("\n");
  }
  return h.digest("hex");
}
