import type { TranscriptSegment } from "rapid-cortex-shared";
import type { ValidatedAnalysisOutput } from "./analysisOutputSchema.js";

export interface AnalysisInput {
  incidentId: string;
  agencyId: string;
  transcript: TranscriptSegment[];
}

/** Validated triage fields before persistence metadata is attached. */
export type AnalysisResult = ValidatedAnalysisOutput;

/** @deprecated Use `IAIProvider` from `./iaiProvider.js`. */
export type { IAIProvider as AIProvider } from "./iaiProvider.js";
