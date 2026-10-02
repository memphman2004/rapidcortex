import type { EventBridgeHandler } from "aws-lambda";
import {
  sopPatternThresholdDetailSchema,
  type SopPatternThresholdDetail,
} from "rapid-cortex-shared";
import { analyzeSopPattern } from "../../sop-intelligence/pattern-analyzer.js";

type PatternEvent = {
  source?: string;
  "detail-type"?: string;
  detail?: unknown;
};

function extractDetail(event: unknown): SopPatternThresholdDetail | null {
  const raw = event as PatternEvent;
  const parsed = sopPatternThresholdDetailSchema.safeParse(raw.detail ?? event);
  return parsed.success ? parsed.data : null;
}

export const handler: EventBridgeHandler<string, unknown, void> = async (event) => {
  const detail = extractDetail(event);
  if (!detail) {
    console.warn(JSON.stringify({ msg: "sop_intel_pattern_event_invalid" }));
    return;
  }
  try {
    const { assertAIGateFeature } = await import("../../lib/ai-gate-check.js");
    const gate = await assertAIGateFeature(detail.agencyId, "patternDetection");
    if (!gate.allowed) {
      console.info(
        JSON.stringify({
          msg: "sop_intel_pattern_skipped_ai_gate",
          agencyId: detail.agencyId,
        }),
      );
      return;
    }
    await analyzeSopPattern(detail);
  } catch (err) {
    console.warn(JSON.stringify({ msg: "sop_intel_pattern_analyzer_error", err: String(err) }));
  }
};
