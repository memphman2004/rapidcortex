import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import {
  clinicianConsultPatchBodySchema,
  crisisAgencyConfigUpsertBodySchema,
  crisisAssessmentAnswerBodySchema,
  crisisAssessmentStartBodySchema,
  crisisCompleteBodySchema,
  crisisDestinationUpsertBodySchema,
  crisisProtocolUpsertBodySchema,
  crisisSelectDestinationBodySchema,
  crisisWarmTransferBodySchema,
  partnerEidoHandoffBodySchema,
} from "rapid-cortex-shared";
import {
  isAgencyAdmin,
  isAgencyIt,
  isDispatcherOrAbove,
  isRcStaff,
  isSupervisorOrAbove,
} from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import {
  answerCrisisStep,
  completeCrisisAssessment,
  createClinicianConsult,
  deleteCrisisDestination,
  deleteCrisisProtocol,
  getCrisisAssessment,
  getCrisisConfig,
  listClinicianConsults,
  listCrisisAssessments,
  listCrisisDestinations,
  listCrisisProtocols,
  partnerEidoHandoff,
  patchClinicianConsult,
  requestWarmTransfer,
  selectCrisisDestination,
  startCrisisAssessment,
  upsertCrisisConfig,
  upsertCrisisDestination,
  upsertCrisisProtocol,
} from "../../services/ng911/crisisDiversionService.js";

const consultCreateBodySchema = z.object({
  assessmentId: z.string().min(1).max(64),
  summary: z.string().max(2000).optional(),
});

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

function canManageCrisisConfig(role: string): boolean {
  return isAgencyAdmin(role) || isAgencyIt(role) || isRcStaff(role);
}

function canOperateCrisis(role: string): boolean {
  return canManageCrisisConfig(role) || isDispatcherOrAbove(role);
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableNg911Assist || !env.ng911AssistTable) {
      return withCorrelationHeaders(
        event,
        serviceUnavailable("NG9-1-1 assist is not enabled for this deployment"),
      );
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    if (!canOperateCrisis(user.role)) {
      return withCorrelationHeaders(event, forbidden());
    }

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";
    const protocolId = event.pathParameters?.protocolId?.trim();
    const destinationId = event.pathParameters?.destinationId?.trim();
    const assessmentId = event.pathParameters?.assessmentId?.trim();
    const consultId = event.pathParameters?.consultId?.trim();

    // ── Config ────────────────────────────────────────────────────────────
    if (method === "GET" && path.endsWith("/crisis/config")) {
      const config = await getCrisisConfig(user.agencyId);
      return withCorrelationHeaders(event, ok({ config }));
    }
    if (method === "POST" && path.endsWith("/crisis/config")) {
      if (!canManageCrisisConfig(user.role)) return withCorrelationHeaders(event, forbidden());
      const body = parseBody(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = crisisAgencyConfigUpsertBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const config = await upsertCrisisConfig(user.agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ config }));
    }

    // ── Protocols ─────────────────────────────────────────────────────────
    if (method === "GET" && path.endsWith("/crisis/protocols")) {
      const items = await listCrisisProtocols(user.agencyId);
      return withCorrelationHeaders(event, ok({ items }));
    }
    if (method === "POST" && path.endsWith("/crisis/protocols")) {
      if (!canManageCrisisConfig(user.role)) return withCorrelationHeaders(event, forbidden());
      const body = parseBody(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = crisisProtocolUpsertBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const protocol = await upsertCrisisProtocol(user.agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ protocol }));
    }
    if (method === "DELETE" && protocolId && path.includes("/crisis/protocols/")) {
      if (!canManageCrisisConfig(user.role)) return withCorrelationHeaders(event, forbidden());
      await deleteCrisisProtocol(user.agencyId, user.userId, protocolId);
      return withCorrelationHeaders(event, ok({ ok: true }));
    }

    // ── Destinations ──────────────────────────────────────────────────────
    if (method === "GET" && path.endsWith("/crisis/destinations")) {
      const items = await listCrisisDestinations(user.agencyId);
      return withCorrelationHeaders(event, ok({ items }));
    }
    if (method === "POST" && path.endsWith("/crisis/destinations")) {
      if (!canManageCrisisConfig(user.role)) return withCorrelationHeaders(event, forbidden());
      const body = parseBody(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = crisisDestinationUpsertBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const destination = await upsertCrisisDestination(user.agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ destination }));
    }
    if (method === "DELETE" && destinationId && path.includes("/crisis/destinations/")) {
      if (!canManageCrisisConfig(user.role)) return withCorrelationHeaders(event, forbidden());
      await deleteCrisisDestination(user.agencyId, user.userId, destinationId);
      return withCorrelationHeaders(event, ok({ ok: true }));
    }

    // ── Assessments ───────────────────────────────────────────────────────
    if (method === "GET" && path.endsWith("/crisis/assessments")) {
      const limitParam = event.queryStringParameters?.limit;
      const limit = limitParam
        ? Math.max(1, Math.min(500, Number.parseInt(limitParam, 10) || 100))
        : 100;
      const items = await listCrisisAssessments(user.agencyId, limit);
      return withCorrelationHeaders(event, ok({ items, count: items.length }));
    }
    if (method === "GET" && assessmentId && path.includes("/crisis/assessments/")) {
      const assessment = await getCrisisAssessment(user.agencyId, assessmentId);
      if (!assessment) return withCorrelationHeaders(event, notFound("Assessment not found"));
      return withCorrelationHeaders(event, ok({ assessment }));
    }
    if (method === "POST" && path.endsWith("/crisis/assessments/start")) {
      const body = parseBody(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = crisisAssessmentStartBodySchema.safeParse(body ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await startCrisisAssessment(user.agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok(result));
    }
    if (method === "POST" && path.endsWith("/crisis/assessments/answer")) {
      const body = parseBody(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = crisisAssessmentAnswerBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const assessment = await answerCrisisStep(user.agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ assessment }));
    }
    if (method === "POST" && path.endsWith("/crisis/assessments/select-destination")) {
      const body = parseBody(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = crisisSelectDestinationBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const assessment = await selectCrisisDestination(user.agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ assessment }));
    }
    if (method === "POST" && path.endsWith("/crisis/assessments/warm-transfer")) {
      const body = parseBody(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = crisisWarmTransferBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const assessment = await requestWarmTransfer(user.agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ assessment }));
    }
    if (method === "POST" && path.endsWith("/crisis/assessments/complete")) {
      const body = parseBody(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = crisisCompleteBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const assessment = await completeCrisisAssessment(user.agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ assessment }));
    }

    // ── Clinician queue ───────────────────────────────────────────────────
    if (method === "GET" && path.endsWith("/crisis/clinician-queue")) {
      const items = await listClinicianConsults(user.agencyId);
      return withCorrelationHeaders(event, ok({ items }));
    }
    if (method === "POST" && path.endsWith("/crisis/clinician-consult")) {
      const body = parseBody(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = consultCreateBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await createClinicianConsult(
        user.agencyId,
        user.userId,
        parsed.data.assessmentId,
        parsed.data.summary,
      );
      return withCorrelationHeaders(event, ok(result));
    }
    if (method === "PATCH" && consultId && path.includes("/crisis/clinician-queue/")) {
      if (!isSupervisorOrAbove(user.role) && !canManageCrisisConfig(user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const body = parseBody(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = clinicianConsultPatchBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const consult = await patchClinicianConsult(
        user.agencyId,
        user.userId,
        consultId,
        parsed.data,
      );
      return withCorrelationHeaders(event, ok({ consult }));
    }

    // ── Partner EIDO handoff ──────────────────────────────────────────────
    if (method === "POST" && path.endsWith("/eido/partner-handoff")) {
      const body = parseBody(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = partnerEidoHandoffBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await partnerEidoHandoff(user.agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok(result));
    }

    return withCorrelationHeaders(event, notFound("Unknown route"));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN") return withCorrelationHeaders(event, forbidden());
      if (error.message === "NOT_FOUND") return withCorrelationHeaders(event, notFound());
      if (
        error.message === "CRISIS_DISABLED" ||
        error.message === "PROTOCOL_DISABLED" ||
        error.message === "ASSESSMENT_NOT_OPEN" ||
        error.message === "ASSESSMENT_CLOSED" ||
        error.message === "HARD_STOP_REQUIRES_LE_EMS" ||
        error.message === "DESTINATION_REQUIRED" ||
        error.message === "DESTINATION_MISMATCH" ||
        error.message === "STEP_NOT_FOUND" ||
        error.message === "PROTOCOL_NOT_FOUND"
      ) {
        return withCorrelationHeaders(event, badRequest(error.message));
      }
    }
    console.error("[ng911.crisisDiversion]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
