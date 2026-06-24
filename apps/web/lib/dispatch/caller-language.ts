import { normalizeCallLanguageCode } from "rapid-cortex-shared";
import type { Incident, TranscriptSegment } from "rapid-cortex-shared";

/** Best-effort caller language from recent transcript segments. */
export function inferCallerLanguageFromSegments(segments: TranscriptSegment[]): string | null {
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i];
    if (seg.speaker !== "caller") continue;
    const raw = seg.detectedLanguage ?? seg.originalLanguage;
    if (!raw) continue;
    const code = normalizeCallLanguageCode(raw);
    if (code && code !== "en" && code !== "und") return code;
  }
  return null;
}

export function resolveIncidentCallerLanguage(
  incident: Incident | null | undefined,
  segments: TranscriptSegment[],
): string | null {
  const stored = incident?.callerLanguage?.trim();
  if (stored) return normalizeCallLanguageCode(stored);
  return inferCallerLanguageFromSegments(segments);
}

export function callerLanguageNeedsTranslation(code: string | null | undefined): boolean {
  if (!code) return false;
  const n = normalizeCallLanguageCode(code);
  return n !== "en" && n !== "und";
}
