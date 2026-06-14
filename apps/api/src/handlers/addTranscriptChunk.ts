import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { transcriptSegmentSchema } from "rapid-cortex-shared";
import {
  badRequest,
  forbidden,
  jsonStatus,
  ok,
  serverError,
  unauthorized,
  badRequestFromZod,
} from "../lib/response.js";
import { getMultilingualConfigBlockResponse } from "../voice/multilingualLambdaEnv.js";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { TranscriptRepository } from "../repositories/transcriptRepository.js";
import { AnalysisService } from "../services/analysisService.js";
import { SopService } from "../services/sopService.js";
import { TriageService } from "../services/triageService.js";
import { FieldConfidenceService } from "../services/fieldConfidenceService.js";
import { WellnessService } from "../services/wellnessService.js";
import { TranscriptService } from "../services/transcriptService.js";

const service = new TranscriptService();
const transcriptRepo = new TranscriptRepository();
const analysisService = new AnalysisService();
const sopService = new SopService();
const triageService = new TriageService();
const fieldConfidenceService = new FieldConfidenceService();
const wellnessService = new WellnessService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const incidentId = event.pathParameters?.id;
    if (!incidentId) return badRequest("Incident ID required");

    const parsed = transcriptSegmentSchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const cfgBlock = getMultilingualConfigBlockResponse();
    if (cfgBlock) {
      return jsonStatus(
        {
          error: "Multilingual transcript path is misconfigured",
          code: cfgBlock.code,
          issues: cfgBlock.issues,
        },
        503,
      );
    }

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const segment = await service.add(incidentId, parsed.data, user);

    const segmentCount = (segment.segmentIndex ?? 0) + 1;

    if (env.enableDispatcherWellness && env.traumaFlagsTable) {
      try {
        await wellnessService.scanNewSegment(segment, user);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          JSON.stringify({ type: "transcript.wellness_scan_failed", incidentId, message }),
        );
      }
    }

    const sopN = env.sopDetectEveryNSegments;
    if (env.enableSopProtocolAi && sopN > 0 && segmentCount % sopN === 0) {
      try {
        await sopService.runDetectionAndPersist(incidentId, user, { manual: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          JSON.stringify({ type: "transcript.sop_detect_failed", incidentId, message }),
        );
      }
    }

    try {
      await triageService.runAutoIfNeeded(incidentId, user, segmentCount);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ type: "transcript.triage_failed", incidentId, message }));
    }

    try {
      await fieldConfidenceService.runAutoIfNeeded(incidentId, user, segmentCount);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({ type: "transcript.field_confidence_failed", incidentId, message }),
      );
    }

    const n = env.autoAnalyzeEveryNSegments;
    if (n > 0) {
      const list = await transcriptRepo.listByIncident(incidentId);
      if (list.length > 0 && list.length % n === 0) {
        try {
          await analysisService.analyze(incidentId, user, { triggerType: "auto" });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(
            JSON.stringify({
              type: "transcript.auto_analyze_failed",
              incidentId,
              message,
            }),
          );
        }
      }
    }

    return ok(segment, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    return serverError();
  }
};
