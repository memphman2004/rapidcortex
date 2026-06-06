import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import bcrypt from "bcryptjs";
import { ringRevokeCameraAccessBodySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { env } from "../../lib/env.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { RingEmergencyRepository } from "../../repositories/ringEmergencyRepository.js";
import { isRingAuthorizedRole } from "./ring-auth.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { ringJson } from "./ring-api-response.js";
import { configureRingEmergencyTables } from "./ring-tables.js";

const emergencyRepo = new RingEmergencyRepository();

const TERMINAL_STATUSES = new Set(["STOPPED", "EXPIRED", "ERROR"]);

function emitStreamTeardownMetric(agencyId: string, sessionId: string, streamReference: string): void {
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: "RapidCortex/Ring",
            Dimensions: [["Stage", "AgencyId"]],
            Metrics: [{ MetricName: "RingStreamTeardownRequired", Unit: "Count" }],
          },
        ],
      },
      RingStreamTeardownRequired: 1,
      Stage: env.deploymentStage,
      AgencyId: agencyId,
      sessionId,
      streamReference,
      msg: "ring_stream_teardown_required",
    }),
  );
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    configureRingEmergencyTables();

    const sessionId = event.pathParameters?.sessionId?.trim() ?? "";
    if (!sessionId) {
      return ringJson({ success: false, error: "sessionId is required." }, 400);
    }

    const session = await emergencyRepo.getSessionById(sessionId);
    if (!session) {
      return ringJson({ success: false, error: "Session not found." }, 404);
    }
    if (TERMINAL_STATUSES.has(session.streamStatus)) {
      return ringJson({ success: false, error: "Session is not active." }, 400);
    }

    let stoppedBy: string | null = null;
    const authHeader =
      event.headers?.authorization ?? event.headers?.Authorization ?? "";
    const hasJwt = authHeader.toLowerCase().startsWith("bearer ");

    if (hasJwt) {
      const user = await getUserContext(event);
      if (!user) return ringJson({ success: false, error: "Unauthorized" }, 401);
      if (!isUserAccountActive(user)) {
        return ringJson({ success: false, error: ACCOUNT_INACTIVE_MESSAGE }, 403);
      }
      const pwd = operationalPasswordBlock(user);
      if (pwd) {
        return ringJson({ success: false, error: "Password update is required before continuing." }, 403);
      }
      if (!isRingAuthorizedRole(user)) {
        return ringJson({ success: false, error: "Forbidden" }, 403);
      }
      if (session.agencyId !== user.agencyId) {
        return ringJson({ success: false, error: "Forbidden" }, 403);
      }
      stoppedBy = user.userId;
    } else {
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return ringJson({ success: false, error: "Unauthorized" }, 401);
      }
      const parsed = ringRevokeCameraAccessBodySchema.safeParse(body);
      const revokeToken = parsed.success ? parsed.data.revokeToken : undefined;
      if (!revokeToken || !session.revokeTokenHash) {
        return ringJson({ success: false, error: "Unauthorized" }, 401);
      }
      const match = await bcrypt.compare(revokeToken, session.revokeTokenHash);
      if (!match) return ringJson({ success: false, error: "Unauthorized" }, 401);
      stoppedBy = "OWNER";
    }

    const nowIso = new Date().toISOString();

    if (session.streamReference) {
      console.log(
        JSON.stringify({
          msg: "ring_stream_teardown_intent",
          streamReference: session.streamReference,
          sessionId,
        }),
      );
      emitStreamTeardownMetric(session.agencyId, sessionId, session.streamReference);
    }

    await emergencyRepo.updateSession(sessionId, session.createdAt, {
      streamStatus: "STOPPED",
      stoppedAt: nowIso,
      stoppedBy,
      updatedAt: nowIso,
    });

    const request = await emergencyRepo.findRequestByIdAcrossIncident(session.requestId);
    if (request) {
      await emergencyRepo.updateRequest(request.agencyId, request.incidentId, request.requestId, {
        requestStatus: "REVOKED",
        revokedAt: nowIso,
      });
    }

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_CAMERA_SESSION_REVOKED,
      agencyId: session.agencyId,
      actorId: stoppedBy ?? "unknown",
      details: {
        incidentId: session.incidentId,
        deviceId: session.deviceId,
        sessionId,
        stoppedBy,
      },
      resourceId: sessionId,
    });

    return ringJson({
      success: true,
      data: { sessionId, streamStatus: "STOPPED" },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_revoke_camera_access_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to revoke Ring camera access." }, 500);
  }
};
