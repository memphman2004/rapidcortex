import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { SopPatternThresholdDetail } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { analyzeSopPattern } from "./pattern-analyzer.js";

const lambda = new LambdaClient({});

/** Fire the pattern analyzer asynchronously; inline when the function name is unset (local/tests). */
export async function triggerSopPatternAnalyzer(detail: SopPatternThresholdDetail): Promise<void> {
  const fn = env.sopIntelligencePatternAnalyzerFunctionName;
  const payload = {
    source: "rapid-cortex.sop-intelligence",
    "detail-type": "SopGapPatternThresholdReached",
    detail,
  };
  if (!fn) {
    await analyzeSopPattern(detail);
    return;
  }
  await lambda.send(
    new InvokeCommand({
      FunctionName: fn,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify(payload)),
    }),
  );
}
