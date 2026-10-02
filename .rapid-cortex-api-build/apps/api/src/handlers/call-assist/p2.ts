import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  callAssistAnalyticsFilterSchema,
  callAssistCallbackDecisionBodySchema,
  callAssistCallbackOfferBodySchema,
  callAssistCallbackTakeoverBodySchema,
  callAssistPromptRollbackSchema,
  callAssistPromptUpsertSchema,
  callAssistQaReviewBodySchema,
  callAssistQaSearchQuerySchema,
  callAssistRetentionPatchSchema,
  callAssistRmsFileBodySchema,
  callAssistSmsSendBodySchema,
  type UserContext,
} from "rapid-cortex-shared";
import type { Permission } from "rapid-cortex-security";
import { AUDIT_EVENT_TYPES, AuthorizationService } from "rapid-cortex-security";
import { makeId } from "../../lib/ids.js";
import { badRequest, badRequestFromZod, notFound, ok } from "../../lib/response.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { callAssistStore } from "../../call-assist/store.js";
import { getOrCreateConfig, isWithinOperatingHours, patchConfig } from "../../call-assist/config-service.js";
import { buildCallAssistAnalyticsDashboard } from "../../call-assist/analytics.js";
import {
  decideCallbackOffer,
  offerCallbackCampaign,
  processDueCallbacksForAgency,
  takeoverCallback,
} from "../../call-assist/callback-campaign.js";
import { sendSelfServiceSms } from "../../call-assist/sms-self-service.js";
import { fileCallAssistRms } from "../../call-assist/rms/rms-file.js";
import { callAssistQaDashboard, saveHumanQaReview, scoreCallAssistSession, searchCallAssistQa } from "../../call-assist/qa-service.js";
import { listPromptCms, rollbackPromptCms, upsertPromptCms } from "../../call-assist/prompt-cms.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();

function requirePerm(user: UserContext, perm: Permission) {
  if (!authz.canPerform(user, perm)) {
    throw new Error("FORBIDDEN");
  }
}

function canGrabCallback(user: UserContext): boolean {
  return authz.canPerform(user, "call_assist.session.takeover") || authz.canPerform(user, "call_assist.cad.push");
}

export async function handleCallAssistP2(
  event: APIGatewayProxyEventV2,
  opts: {
    user: UserContext;
    agencyId: string;
    method: string;
    parts: string[];
    body: unknown;
  },
): Promise<APIGatewayProxyResultV2 | null> {
  const { user, agencyId, method, parts, body } = opts;
  const q = event.queryStringParameters ?? {};

  if (method === "GET" && parts[0] === "callbacks" && parts[1] === "queue") {
    requirePerm(user, "call_assist.session.view");
    const [queued, inProgress, offered] = await Promise.all([
      callAssistStore.listCallbacks(agencyId, "QUEUED", 100),
      callAssistStore.listCallbacks(agencyId, "IN_PROGRESS", 50),
      callAssistStore.listCallbacks(agencyId, "OFFERED", 50),
    ]);
    return withCorrelationHeaders(event, ok({ queued, inProgress, offered }));
  }

  if (method === "POST" && parts[0] === "callbacks" && parts[1] === "process") {
    requirePerm(user, "call_assist.session.takeover");
    const result = await processDueCallbacksForAgency(agencyId, user.userId);
    return withCorrelationHeaders(event, ok(result));
  }

  if (method === "POST" && parts[0] === "sessions" && parts[2] === "callback" && parts[3] === "offer") {
    requirePerm(user, "call_assist.session.view");
    const parsed = callAssistCallbackOfferBodySchema.safeParse({ ...(typeof body === "object" && body ? body : {}), sessionId: parts[1] });
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    const session = await callAssistStore.getSession(agencyId, parsed.data.sessionId);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
    const config = await getOrCreateConfig(agencyId);
    const next = await offerCallbackCampaign({
      session,
      config,
      actorId: user.userId,
      phoneE164: parsed.data.phoneE164,
      nowIso: new Date().toISOString(),
    });
    return withCorrelationHeaders(event, ok({ session: next, hoursOpen: isWithinOperatingHours(config) }));
  }

  if (method === "POST" && parts[0] === "sessions" && parts[2] === "callback" && parts[3] === "decision") {
    requirePerm(user, "call_assist.session.view");
    const parsed = callAssistCallbackDecisionBodySchema.safeParse({ ...(typeof body === "object" && body ? body : {}), sessionId: parts[1] });
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    const session = await callAssistStore.getSession(agencyId, parsed.data.sessionId);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
    const next = await decideCallbackOffer({
      session,
      actorId: user.userId,
      accept: parsed.data.accept,
      nowIso: new Date().toISOString(),
    });
    return withCorrelationHeaders(event, ok({ session: next }));
  }

  if (method === "POST" && parts[0] === "sessions" && parts[2] === "callback" && parts[3] === "takeover") {
    if (!canGrabCallback(user)) throw new Error("FORBIDDEN");
    const parsed = callAssistCallbackTakeoverBodySchema.safeParse({ sessionId: parts[1] });
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    const session = await callAssistStore.getSession(agencyId, parsed.data.sessionId);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
    const next = await takeoverCallback({ session, actorId: user.userId, nowIso: new Date().toISOString() });
    return withCorrelationHeaders(event, ok({ session: next }));
  }

  if (method === "POST" && parts[0] === "sessions" && parts[2] === "sms-self-service") {
    requirePerm(user, "call_assist.session.view");
    const parsed = callAssistSmsSendBodySchema.safeParse({ ...(typeof body === "object" && body ? body : {}), sessionId: parts[1] });
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    const session = await callAssistStore.getSession(agencyId, parsed.data.sessionId);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
    const config = await getOrCreateConfig(agencyId);
    const next = await sendSelfServiceSms({
      session,
      config,
      actorId: user.userId,
      phoneE164: parsed.data.phoneE164,
      nowIso: new Date().toISOString(),
    });
    return withCorrelationHeaders(event, ok({ session: next }));
  }

  if (method === "POST" && parts[0] === "sessions" && parts[2] === "rms-file") {
    requirePerm(user, "call_assist.cad.push");
    const parsed = callAssistRmsFileBodySchema.safeParse({ ...(typeof body === "object" && body ? body : {}), sessionId: parts[1] });
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    const session = await callAssistStore.getSession(agencyId, parsed.data.sessionId);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
    const result = await fileCallAssistRms({
      session,
      actorId: user.userId,
      humanReviewApproved: true,
      target: parsed.data.target,
      source: "call_assist",
    });
    return withCorrelationHeaders(event, ok({ result, session }));
  }

  if (method === "GET" && parts[0] === "qa" && parts[1] === "dashboard") {
    requirePerm(user, "call_assist.qa.view");
    const dashboard = await callAssistQaDashboard(agencyId);
    return withCorrelationHeaders(event, ok({ dashboard }));
  }

  if (method === "GET" && parts[0] === "qa" && parts[1] === "search") {
    requirePerm(user, "call_assist.qa.view");
    const parsed = callAssistQaSearchQuerySchema.safeParse(q);
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    const items = await searchCallAssistQa({
      agencyId,
      q: parsed.data.q,
      falseTransfer: parsed.data.falseTransfer === "true" ? true : parsed.data.falseTransfer === "false" ? false : undefined,
      humanTakeover: parsed.data.humanTakeover === "true",
      language: parsed.data.language,
    });
    return withCorrelationHeaders(event, ok({ items }));
  }

  if (method === "GET" && parts[0] === "sessions" && parts[2] === "qa") {
    requirePerm(user, "call_assist.qa.view");
    const session = await callAssistStore.getSession(agencyId, parts[1]);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
    const review = await callAssistStore.getQaReview(agencyId, parts[1]);
    return withCorrelationHeaders(event, ok({ session, review, playback: session.utterances }));
  }

  if (method === "POST" && parts[0] === "sessions" && parts[2] === "qa" && parts[3] === "score") {
    requirePerm(user, "call_assist.qa.review");
    const session = await callAssistStore.getSession(agencyId, parts[1]);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
    const review = await scoreCallAssistSession({ session, actorId: user.userId });
    return withCorrelationHeaders(event, ok({ review }));
  }

  if (method === "POST" && parts[0] === "sessions" && parts[2] === "qa" && parts[3] === "review") {
    requirePerm(user, "call_assist.qa.review");
    const parsed = callAssistQaReviewBodySchema.safeParse({ ...(typeof body === "object" && body ? body : {}), sessionId: parts[1] });
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    const session = await callAssistStore.getSession(agencyId, parsed.data.sessionId);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
    const review = await saveHumanQaReview({
      session,
      actorId: user.userId,
      aggregateScore: parsed.data.aggregateScore,
      notes: parsed.data.notes,
      falseTransfer: parsed.data.falseTransfer,
    });
    return withCorrelationHeaders(event, ok({ review }));
  }

  if (method === "GET" && parts[0] === "analytics" && parts[1] === "dashboard") {
    requirePerm(user, "call_assist.analytics.view");
    const parsed = callAssistAnalyticsFilterSchema.safeParse(q);
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    const dashboard = await buildCallAssistAnalyticsDashboard(agencyId, parsed.data);
    return withCorrelationHeaders(event, ok({ dashboard }));
  }

  if (method === "PATCH" && parts[0] === "retention") {
    requirePerm(user, "call_assist.retention.manage");
    const parsed = callAssistRetentionPatchSchema.safeParse(body ?? {});
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    const config = await patchConfig(agencyId, { retention: parsed.data });
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.CALL_ASSIST_RETENTION_UPDATED,
      details: { keys: Object.keys(parsed.data) },
      createdAt: new Date().toISOString(),
      resourceType: "agency",
      resourceId: agencyId,
    });
    return withCorrelationHeaders(event, ok({ retention: config.retention, lastRun: config.retentionLastRun }));
  }

  if (method === "GET" && parts[0] === "prompts") {
    requirePerm(user, "call_assist.prompts.manage");
    const items = await listPromptCms(agencyId);
    return withCorrelationHeaders(event, ok({ items }));
  }

  if (method === "POST" && parts[0] === "prompts" && parts[1] === "rollback") {
    requirePerm(user, "call_assist.prompts.manage");
    const parsed = callAssistPromptRollbackSchema.safeParse(body ?? {});
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    const record = await rollbackPromptCms({
      agencyId,
      promptId: parsed.data.promptId,
      version: parsed.data.version,
      actorId: user.userId,
    });
    return withCorrelationHeaders(event, ok({ record }));
  }

  if (method === "POST" && parts[0] === "prompts") {
    requirePerm(user, "call_assist.prompts.manage");
    const parsed = callAssistPromptUpsertSchema.safeParse(body ?? {});
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    const result = await upsertPromptCms({
      agencyId,
      promptId: parsed.data.promptId,
      body: parsed.data.body,
      actorId: user.userId,
    });
    return withCorrelationHeaders(event, ok(result));
  }

  return null;
}
