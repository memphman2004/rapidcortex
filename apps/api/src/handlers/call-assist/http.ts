import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  BOT_TEMPLATE_VERSION,
  callAssistBotNeedsRebuild,
  CALL_ASSIST_BID_LINE_MATRIX,
  CALL_ASSIST_VERTICAL_LABELS,
  callAssistAdminConfigPatchSchema,
  callAssistCadPushBodySchema,
  callAssistDidClaimSchema,
  callAssistDemoRunSchema,
  callAssistExternalAgencyUpsertSchema,
  callAssistForceTransferBodySchema,
  callAssistKnowledgeUpsertSchema,
  callAssistLegalHoldBodySchema,
  callAssistOnboardingInputSchema,
  callAssistRecordsRequestSchema,
  callAssistShiftPatchSchema,
  callAssistSurveySubmitSchema,
  callAssistUtteranceBodySchema,
  callAssistVoiceConfigPatchSchema,
  callAssistUiVerticalFromAgency,
  estimatedLexBotRebuildMinutes,
  initiateCallAssistSessionSchema,
  isCallAssistOnboardingComplete,
  isLexBotQuotaBlocking,
  LEX_BOT_QUOTA_CONSOLE_URL,
  isRcInternalOperator,
  resolveAgencyTaxonomy,
  resolveCadPushLabel,
  buildPsapAvailabilityNotice,
  withExternalRouteDefaults,
} from "rapid-cortex-shared";
import { AuthorizationService, AUDIT_EVENT_TYPES, type Permission } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { requireAddon } from "../../middleware/requireAddon.js";
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
import { AuditRepository } from "../../repositories/auditRepository.js";
import { callAssistStore } from "../../call-assist/store.js";
import { getOrCreateConfig, isWithinOperatingHours, patchConfig, CALL_ASSIST_SHIFT_TTL_MS } from "../../call-assist/config-service.js";
import { buildCallAssistAnalyticsDashboard } from "../../call-assist/analytics.js";
import {
  completeSession,
  initiateSession,
  processUtterance,
} from "../../call-assist/session-pipeline.js";
import { recordTransferAttempt } from "../../call-assist/transfer-ledger.js";
import { listDemoScenariosForAgency, runDemoScenario } from "../../call-assist/demo-runner.js";
import { callAssistOnboardingService } from "../../call-assist/onboarding/call-assist-onboarding-service.js";
import { enqueueAllAgencyRebuilds, enqueueBotRebuild } from "../../call-assist/lex/bot-rebuild-queue.js";
import { checkLexBotQuota, LexBotQuotaExhaustedError, readLexBotQuota } from "../../call-assist/lex/lex-quota.js";
import { tenantToVoiceConfig } from "../../call-assist/voice-config-map.js";
import { resolveCadProvider } from "../../call-assist/cad/resolve-provider.js";
import { evaluateRmsDraftGate } from "../../call-assist/rms/rms-draft.js";
import { loadCallAssistUiProfile } from "../../call-assist/build-ui-profile.js";
import {
  callAssistAgencyQueryForbidden,
  isPlatformCallAssistTenant,
  requestedCallAssistAgencyId,
  resolveCallAssistTenantAgencyId,
} from "../../call-assist/tenant-agency.js";
import { handleCallAssistP2 } from "./p2.js";
import { handleCallAssistP3 } from "./p3.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();
const requireCallAssistAddon = requireAddon("call_assist.module");

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

function rest(path: string): string[] {
  const idx = path.indexOf("/api/call-assist/");
  const tail = idx >= 0 ? path.slice(idx + "/api/call-assist/".length) : "";
  return tail.split("/").filter(Boolean);
}

function requirePerm(user: { role: string; agencyId: string; userId: string }, perm: Permission) {
  if (!authz.canPerform(user, perm)) {
    const err = new Error("FORBIDDEN");
    throw err;
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableCallAssist || !env.callAssistTable) {
      return withCorrelationHeaders(event, serviceUnavailable("Call Assist is not enabled for this deployment"));
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }

    if (!isRcInternalOperator(user.role)) {
      const addonGate = await requireCallAssistAddon(event, user);
      if (addonGate) return withCorrelationHeaders(event, addonGate);
    }

    const requestedAgencyId = requestedCallAssistAgencyId(event);
    if (callAssistAgencyQueryForbidden(user, requestedAgencyId)) {
      return withCorrelationHeaders(event, forbidden());
    }
    const agencyId = resolveCallAssistTenantAgencyId(user, requestedAgencyId);

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";
    const parts = rest(path);
    const body = parseBody(event.body);
    if (event.body && body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));

    if (method === "GET" && parts[0] === "bid-matrix") {
      requirePerm(user, "call_assist.session.view");
      return withCorrelationHeaders(event, ok({ items: CALL_ASSIST_BID_LINE_MATRIX }));
    }

    if (method === "GET" && parts[0] === "bots" && parts[1] === "quota") {
      requirePerm(user, "call_assist.bots.manage");
      const quota = await readLexBotQuota();
      return withCorrelationHeaders(
        event,
        ok({
          quota,
          templateVersion: BOT_TEMPLATE_VERSION,
          quotaBlocking: isLexBotQuotaBlocking(quota.currentBotCount, quota.limit),
          quotaConsoleUrl: LEX_BOT_QUOTA_CONSOLE_URL,
        }),
      );
    }

    if (method === "GET" && parts[0] === "bots" && parts.length === 1) {
      requirePerm(user, "call_assist.bots.manage");
      const [configs, quota] = await Promise.all([callAssistStore.listTenantConfigs(), readLexBotQuota()]);
      const bots = configs.map((config) => ({
        agencyId: config.agencyId,
        agencyDisplayName: config.agencyDisplayName || config.agencyName || config.agencyId,
        botName: config.lexBotName || null,
        status: config.lexBotStatus || "NOT_CREATED",
        templateVersion: config.lexBotTemplateVersion || null,
        current: config.lexBotTemplateVersion === BOT_TEMPLATE_VERSION,
        onboardingStatus: config.onboardingStatus || null,
      }));
      const provisioned = bots.filter((bot) => bot.botName || bot.status !== "NOT_CREATED").length;
      const currentBotCount = Math.max(quota.currentBotCount, provisioned);
      const fleetQuota = {
        ...quota,
        currentBotCount,
        headroom: Math.max(0, quota.limit - currentBotCount),
      };
      const pendingRebuilds = bots.filter((bot) => callAssistBotNeedsRebuild(bot)).length;
      return withCorrelationHeaders(
        event,
        ok({
          bots,
          quota: fleetQuota,
          templateVersion: BOT_TEMPLATE_VERSION,
          outdatedCount: bots.filter((bot) => bot.current === false && bot.status !== "NOT_CREATED").length,
          pendingRebuilds,
          estimatedRebuildMinutes: estimatedLexBotRebuildMinutes(pendingRebuilds),
          quotaBlocking: isLexBotQuotaBlocking(currentBotCount, quota.limit),
          quotaConsoleUrl: LEX_BOT_QUOTA_CONSOLE_URL,
        }),
      );
    }

    if (method === "POST" && parts[0] === "bots" && parts[1] === "rebuild-all-outdated") {
      requirePerm(user, "call_assist.bots.manage");
      const enqueued = await enqueueAllAgencyRebuilds();
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CALL_ASSIST_BOTS_REBUILD_ENQUEUED,
        details: { enqueued },
        createdAt: new Date().toISOString(),
        resourceType: "call_assist",
        resourceId: "fleet",
      });
      return withCorrelationHeaders(event, ok({ enqueued }));
    }

    if (method === "POST" && parts[0] === "bots" && parts[2] === "rebuild" && parts[1]) {
      requirePerm(user, "call_assist.bots.manage");
      await enqueueBotRebuild(parts[1], BOT_TEMPLATE_VERSION, "MANUAL");
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: parts[1],
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CALL_ASSIST_BOTS_REBUILD_ENQUEUED,
        details: { agencyId: parts[1], reason: "MANUAL" },
        createdAt: new Date().toISOString(),
        resourceType: "call_assist",
        resourceId: parts[1],
      });
      return withCorrelationHeaders(event, ok({ queued: true, agencyId: parts[1] }));
    }

    if (method === "POST" && parts[0] === "onboarding" && parts.length === 1) {
      requirePerm(user, "call_assist.bots.manage");
      const parsed = callAssistOnboardingInputSchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      try {
        await checkLexBotQuota();
        await callAssistOnboardingService.onboardAgency({ ...parsed.data, createdBy: user.userId });
      } catch (err) {
        if (err instanceof LexBotQuotaExhaustedError) {
          return withCorrelationHeaders(event, serviceUnavailable(err.message));
        }
        throw err;
      }
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: parsed.data.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CALL_ASSIST_ONBOARDING_STARTED,
        details: { agencyDisplayName: parsed.data.agencyDisplayName },
        createdAt: new Date().toISOString(),
        resourceType: "call_assist",
        resourceId: parsed.data.agencyId,
      });
      return withCorrelationHeaders(event, ok({ agencyId: parsed.data.agencyId, status: "DID_PENDING" }));
    }

    if (method === "GET" && parts[0] === "onboarding" && parts[1] && parts.length === 2) {
      requirePerm(user, "call_assist.bots.manage");
      const config = await callAssistStore.getConfig(parts[1]);
      if (!config) return withCorrelationHeaders(event, notFound("Onboarding not found"));
      return withCorrelationHeaders(
        event,
        ok({
          agencyId: parts[1],
          onboardingStatus: config.onboardingStatus ?? "PENDING",
          onboardingSteps: config.onboardingSteps ?? [],
          lexBotStatus: config.lexBotStatus ?? "NOT_CREATED",
          templateVersion: config.lexBotTemplateVersion ?? null,
        }),
      );
    }

    if (method === "POST" && parts[0] === "onboarding" && parts[2] === "did" && parts[1]) {
      requirePerm(user, "call_assist.bots.manage");
      const parsed = callAssistDidClaimSchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      await callAssistOnboardingService.claimDid(parts[1], parsed.data.phoneNumber);
      return withCorrelationHeaders(event, ok({ agencyId: parts[1], onboardingStatus: "SMOKE_TEST_PENDING" }));
    }

    if (method === "POST" && parts[0] === "onboarding" && parts[2] === "retry" && parts[1]) {
      requirePerm(user, "call_assist.bots.manage");
      await callAssistOnboardingService.retry(parts[1], user.userId);
      return withCorrelationHeaders(event, ok({ agencyId: parts[1] }));
    }

    if (method === "GET" && parts[0] === "voice-config" && parts[1]) {
      requirePerm(user, "call_assist.admin.config");
      const config = await callAssistStore.getConfig(parts[1]);
      if (!config) return withCorrelationHeaders(event, notFound("Voice config not found"));
      if (!isRcInternalOperator(user.role) && user.agencyId !== parts[1]) {
        return withCorrelationHeaders(event, forbidden());
      }
      return withCorrelationHeaders(event, ok({ config: tenantToVoiceConfig(config) }));
    }

    if (method === "PATCH" && parts[0] === "voice-config" && parts[1]) {
      requirePerm(user, "call_assist.admin.config");
      if (!isRcInternalOperator(user.role) && user.agencyId !== parts[1]) {
        return withCorrelationHeaders(event, forbidden());
      }
      const parsed = callAssistVoiceConfigPatchSchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const current = await getOrCreateConfig(parts[1]);
      const localesChanged = Boolean(parsed.data.supportedLocales);
      await callAssistStore.putConfig({
        ...current,
        agencyDisplayName: parsed.data.agencyDisplayName ?? current.agencyDisplayName,
        agencyName: parsed.data.agencyDisplayName ?? current.agencyName,
        agencyShortName: parsed.data.agencyShortName ?? current.agencyShortName,
        shortName: parsed.data.agencyShortName ?? current.shortName,
        agencyTypeLabel: parsed.data.agencyTypeLabel ?? current.agencyTypeLabel,
        officerLabel: parsed.data.officerLabel ?? current.officerLabel,
        nonEmergencyWebsite: parsed.data.nonEmergencyWebsite ?? current.nonEmergencyWebsite,
        onlineReportUrl: parsed.data.onlineReportPortalUrl ?? current.onlineReportUrl,
        carfaxPortalUrl: parsed.data.carfaxPortalUrl ?? current.carfaxPortalUrl,
        disclosureText: parsed.data.disclosureText ?? current.disclosureText,
        supportedLocales: parsed.data.supportedLocales ?? current.supportedLocales,
        updatedAt: new Date().toISOString(),
      });
      if (localesChanged) {
        await enqueueBotRebuild(parts[1], BOT_TEMPLATE_VERSION, "LOCALE_ADDED");
      }
      return withCorrelationHeaders(event, ok({ updated: true, rebuildQueued: localesChanged }));
    }

    if (isPlatformCallAssistTenant(agencyId)) {
      return withCorrelationHeaders(event, badRequest("Select an agency"));
    }

    if (method === "GET" && parts[0] === "ui-profile") {
      requirePerm(user, "call_assist.session.view");
      const profile = await loadCallAssistUiProfile(user, agencyId);
      return withCorrelationHeaders(event, ok({ profile }));
    }

    if (method === "GET" && parts[0] === "config" && parts.length === 1) {
      requirePerm(user, "call_assist.session.view");
      const config = await getOrCreateConfig(agencyId);
      const shift = await callAssistStore.getShift(agencyId);
      const vertical = callAssistUiVerticalFromAgency({
        vertical: config.vertical ?? config.uiVertical,
        uiVertical: config.uiVertical,
        agencyId,
      });
      const labels = CALL_ASSIST_VERTICAL_LABELS[vertical];
      return withCorrelationHeaders(
        event,
        ok({
          agencyId,
          config,
          taxonomy: resolveAgencyTaxonomy(config),
          currentShift: shift?.currentShift ?? null,
          onboardingComplete: isCallAssistOnboardingComplete(config),
          agencyName: config.agencyName ?? null,
          agencyShortName: config.agencyShortName ?? config.shortName ?? null,
          callerIdLabel: labels.callerIdLabel,
          locationLabel: labels.locationLabel,
          escalationLabel: labels.escalationLabel,
          transferTarget: labels.transferTarget,
          statLabel2: labels.statLabel2,
          cadProviderLabel: resolveCadPushLabel(config.cadProviderId, config.cadProviderLabel),
        }),
      );
    }

    if (method === "GET" && parts[0] === "shift") {
      requirePerm(user, "call_assist.session.view");
      const shift = await callAssistStore.getShift(agencyId);
      return withCorrelationHeaders(event, ok({ currentShift: shift?.currentShift ?? null, shift }));
    }

    if (method === "PATCH" && parts[0] === "shift") {
      requirePerm(user, "call_assist.session.takeover");
      const parsed = callAssistShiftPatchSchema.safeParse(body ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const now = Date.now();
      const row = {
        agencyId: agencyId,
        currentShift: parsed.data.currentShift.trim(),
        setBy: user.userId,
        setAt: new Date(now).toISOString(),
        expiresAt: new Date(now + CALL_ASSIST_SHIFT_TTL_MS).toISOString(),
      };
      await callAssistStore.putShift(row);
      return withCorrelationHeaders(event, ok({ currentShift: row.currentShift, shift: row }));
    }

    if (method === "GET" && parts[0] === "schedule") {
      requirePerm(user, "call_assist.session.view");
      const config = await getOrCreateConfig(agencyId);
      const open = isWithinOperatingHours(config);
      const onboarded = config.onboardingComplete !== false;
      return withCorrelationHeaders(
        event,
        ok({
          open,
          hours: config.operatingHours,
          onboardingComplete: onboarded,
          notice: buildPsapAvailabilityNotice({
            product: "psap",
            callAssistOnboarded: onboarded,
            withinHours: open,
            agencyName: config.agencyDisplayName ?? config.agencyName ?? config.shortName,
          }),
        }),
      );
    }

    if (method === "GET" && parts[0] === "sessions" && parts.length === 1) {
      requirePerm(user, "call_assist.session.view");
      const openOnly = event.queryStringParameters?.status !== "done";
      const items = await callAssistStore.listSessions(agencyId, openOnly, 100);
      return withCorrelationHeaders(event, ok({ items, count: items.length }));
    }

    if (method === "POST" && parts[0] === "sessions" && parts.length === 1) {
      requirePerm(user, "call_assist.session.view");
      const parsed = initiateCallAssistSessionSchema.safeParse(body ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const session = await initiateSession({
        agencyId: agencyId,
        actorId: user.userId,
        ...parsed.data,
      });
      return withCorrelationHeaders(event, ok({ session }));
    }

    if (method === "GET" && parts[0] === "sessions" && parts.length === 2 && parts[1]) {
      requirePerm(user, "call_assist.session.view");
      const session = await callAssistStore.getSession(agencyId, parts[1]);
      if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
      return withCorrelationHeaders(event, ok({ session, handoff: session.transfer }));
    }

    if (method === "POST" && parts[0] === "sessions" && parts[2] === "utterances") {
      requirePerm(user, "call_assist.session.view");
      const parsed = callAssistUtteranceBodySchema.safeParse({
        ...(typeof body === "object" && body ? body : {}),
        sessionId: parts[1],
      });
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await processUtterance({
        agencyId: agencyId,
        actorId: user.userId,
        sessionId: parsed.data.sessionId,
        text: parsed.data.text,
        speaker: parsed.data.speaker,
        speakerId: parsed.data.speakerId,
        participantRole: parsed.data.participantRole,
      });
      return withCorrelationHeaders(event, ok(result));
    }

    if (method === "POST" && parts[0] === "sessions" && parts[2] === "complete") {
      requirePerm(user, "call_assist.session.view");
      const session = await completeSession(agencyId, parts[1], user.userId);
      return withCorrelationHeaders(event, ok({ session }));
    }

    if (method === "POST" && parts[0] === "sessions" && parts[2] === "transfer") {
      requirePerm(user, "call_assist.transfer.force");
      const parsed = callAssistForceTransferBodySchema.safeParse({
        ...(typeof body === "object" && body ? body : {}),
        sessionId: parts[1],
      });
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const session = await callAssistStore.getSession(agencyId, parsed.data.sessionId);
      if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
      const dest = parsed.data.destinationType;
      if (dest === "EMERGENCY_911") session.state = "TRANSFERRING_911";
      else if (dest === "EXTERNAL_AGENCY" || dest === "PHONE_NUMBER") session.state = "TRANSFERRING_EXTERNAL";
      else session.state = "TRANSFERRING_HUMAN";
      session.continueAiConversation = false;
      session.updatedAt = new Date().toISOString();
      const destType = dest ?? "CALL_TAKER";
      const xfer = await recordTransferAttempt({
        agencyId,
        sessionId: session.sessionId,
        actorId: user.userId,
        destinationType: destType,
        destinationId: destType,
        destinationDisplay: destType,
        channel: destType === "PHONE_NUMBER" ? "PSTN" : "QUEUE",
        outcome: "INITIATED",
        failureReason: parsed.data.reason,
      });
      session.lastTransferOutcome = xfer.outcome;
      await callAssistStore.putSession(session);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: agencyId,
        actorId: user.userId,
        type:
          dest === "EMERGENCY_911"
            ? AUDIT_EVENT_TYPES.CALL_ASSIST_EMERGENCY_TRANSFER
            : dest === "EXTERNAL_AGENCY" || dest === "PHONE_NUMBER"
              ? AUDIT_EVENT_TYPES.CALL_ASSIST_EXTERNAL_TRANSFER
              : AUDIT_EVENT_TYPES.CALL_ASSIST_HUMAN_TRANSFER,
        details: { reason: parsed.data.reason, destinationType: dest ?? "CALL_TAKER" },
        createdAt: session.updatedAt,
        resourceType: "session",
        resourceId: session.sessionId,
      });
      return withCorrelationHeaders(event, ok({ session }));
    }

    if (method === "POST" && parts[0] === "sessions" && parts[2] === "cad-push") {
      requirePerm(user, "call_assist.cad.push");
      const parsed = callAssistCadPushBodySchema.safeParse({
        ...(typeof body === "object" && body ? body : {}),
        sessionId: parts[1],
      });
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const session = await callAssistStore.getSession(agencyId, parsed.data.sessionId);
      if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
      const config = await getOrCreateConfig(agencyId);
      const cad = resolveCadProvider(config.cadProviderId, config.cadNatureMapping);
      const result = await cad.createIncident(
        {
          agencyId: agencyId,
          intake: session.intake,
          classification: session.triage?.primaryClassification ?? "UNKNOWN",
          location: { text: session.intake.locationText, lat: session.intake.locationLat, lng: session.intake.locationLng },
        },
        {
          humanReviewApproved: true,
          actorId: user.userId,
          demo: session.source === "DEMO",
        },
      );
      session.cadPushStatus = result.reason;
      session.cadIncidentId = result.cadIncidentId;
      session.updatedAt = new Date().toISOString();
      await callAssistStore.putSession(session);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: agencyId,
        actorId: user.userId,
        type: result.blocked
          ? AUDIT_EVENT_TYPES.CALL_ASSIST_CAD_PUSH_BLOCKED
          : AUDIT_EVENT_TYPES.CALL_ASSIST_CAD_PUSH_SUBMITTED,
        details: { ...result, sessionId: session.sessionId },
        createdAt: session.updatedAt,
        resourceType: "session",
        resourceId: session.sessionId,
      });
      return withCorrelationHeaders(event, ok({ result, session }));
    }

    if (method === "POST" && parts[0] === "sessions" && parts[2] === "rms-draft") {
      requirePerm(user, "call_assist.cad.push");
      const session = await callAssistStore.getSession(agencyId, parts[1]);
      if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
      const result = evaluateRmsDraftGate({
        rmsDraftEnabled: env.enableCallAssistRmsDraft,
        humanReviewApproved: true,
        demo: session.source === "DEMO",
      });
      session.rmsDraftStatus = result.reason;
      session.updatedAt = new Date().toISOString();
      await callAssistStore.putSession(session);
      return withCorrelationHeaders(event, ok({ result, session }));
    }

    if (method === "POST" && parts[0] === "sessions" && parts[2] === "survey") {
      requirePerm(user, "call_assist.session.view");
      const parsed = callAssistSurveySubmitSchema.safeParse({
        ...(typeof body === "object" && body ? body : {}),
        sessionId: parts[1],
      });
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const now = new Date().toISOString();
      await callAssistStore.putSurvey({
        agencyId: agencyId,
        sessionId: parsed.data.sessionId,
        score: parsed.data.score,
        channel: parsed.data.channel,
        comment: parsed.data.comment,
        createdAt: now,
      });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CALL_ASSIST_SURVEY_RECORDED,
        details: { score: parsed.data.score, channel: parsed.data.channel },
        createdAt: now,
        resourceType: "session",
        resourceId: parsed.data.sessionId,
      });
      return withCorrelationHeaders(event, ok({ ok: true }));
    }

    if (method === "POST" && parts[0] === "sessions" && parts[2] === "legal-hold") {
      requirePerm(user, "call_assist.legal_hold.manage");
      const parsed = callAssistLegalHoldBodySchema.safeParse({
        ...(typeof body === "object" && body ? body : {}),
        sessionId: parts[1],
      });
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const session = await callAssistStore.getSession(agencyId, parsed.data.sessionId);
      if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
      session.legalHold = parsed.data.hold;
      session.updatedAt = new Date().toISOString();
      await callAssistStore.putSession(session);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CALL_ASSIST_LEGAL_HOLD,
        details: { hold: parsed.data.hold, reason: parsed.data.reason },
        createdAt: session.updatedAt,
        resourceType: "session",
        resourceId: session.sessionId,
      });
      return withCorrelationHeaders(event, ok({ session }));
    }

    if (method === "GET" && parts[0] === "handoff" && parts[1]) {
      requirePerm(user, "call_assist.session.view");
      const session = await callAssistStore.getSession(agencyId, parts[1]);
      if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
      return withCorrelationHeaders(event, ok({ handoff: session.transfer, session }));
    }

    if (method === "GET" && parts[0] === "admin" && parts[1] === "config") {
      requirePerm(user, "call_assist.admin.config");
      const config = await getOrCreateConfig(agencyId);
      return withCorrelationHeaders(event, ok({ config }));
    }

    if (method === "PATCH" && parts[0] === "admin" && parts[1] === "config") {
      requirePerm(user, "call_assist.admin.config");
      const parsed = callAssistAdminConfigPatchSchema.safeParse(body ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const { externalTransferList, ...configPatchIn } = parsed.data;
      const verticalRequested = configPatchIn.vertical ?? configPatchIn.uiVertical;
      const canSetVertical = isRcInternalOperator(user.role);
      const configPatch = { ...configPatchIn };
      if (!canSetVertical) {
        delete configPatch.vertical;
        delete configPatch.uiVertical;
      }
      let config;
      try {
        config = await patchConfig(agencyId, {
          ...configPatch,
          carfaxPortalUrl: configPatch.carfaxPortalUrl ?? undefined,
          onlineReportUrl: configPatch.onlineReportUrl ?? undefined,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith("TAXONOMY_LOCK:")) {
          return withCorrelationHeaders(event, badRequest(message.replace("TAXONOMY_LOCK:", "")));
        }
        throw err;
      }
      if (externalTransferList !== undefined) {
        const existing = await callAssistStore.listExternal(agencyId);
        const keep = new Set(externalTransferList.map((e) => e.id));
        for (const row of existing) {
          if (!keep.has(row.externalAgencyId)) {
            await callAssistStore.deleteExternal(agencyId, row.externalAgencyId);
          }
        }
        for (const entry of externalTransferList) {
          await callAssistStore.putExternal(
            withExternalRouteDefaults({
              agencyId: agencyId,
              externalAgencyId: entry.id,
              externalAgencyName: entry.name,
              phoneNumber: entry.number ?? "",
              sipUri: entry.sipUri ?? undefined,
              description: "",
              transferType: "WARM",
              afterHoursMessage: entry.afterHoursMessage ?? undefined,
              callerExperienceScript:
                entry.warmTransferScript?.trim() || `I'm transferring you to ${entry.name} now.`,
              transferSummaryTemplate:
                "Warm transfer. Issue: {issue}. Callback: {callback}. Location: {location}.",
              enabled: true,
              triageClassifications: entry.acceptedCallTypes ?? [],
              acceptedCallTypes: entry.acceptedCallTypes,
              fallbackPhoneNumber: entry.fallbackNumber ?? undefined,
              hoursAllDay: true,
              afterHoursPolicy: "human",
              transferFailurePolicy: entry.fallbackNumber?.trim() ? "fallback" : "human",
              maxAttempts: 2,
            }),
          );
        }
      }
      let cognitoSynced = 0;
      if (canSetVertical && verticalRequested) {
        try {
          cognitoSynced = await syncAgencyVerticalClaims(agencyId, verticalRequested);
        } catch (err) {
          console.error("call-assist agencyVertical cognito sync", err);
        }
      }
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CALL_ASSIST_CONFIG_UPDATED,
        details: {
          keys: Object.keys(parsed.data),
          ...(verticalRequested && canSetVertical
            ? { agencyVertical: verticalRequested, cognitoSynced }
            : {}),
        },
        createdAt: new Date().toISOString(),
        resourceType: "agency",
        resourceId: agencyId,
      });
      return withCorrelationHeaders(event, ok({ config }));
    }

    if (method === "GET" && parts[0] === "external-agencies") {
      requirePerm(user, "call_assist.admin.config");
      const items = await callAssistStore.listExternal(agencyId);
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (method === "POST" && parts[0] === "external-agencies") {
      requirePerm(user, "call_assist.admin.config");
      const parsed = callAssistExternalAgencyUpsertSchema.safeParse(body ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const row = withExternalRouteDefaults({
        agencyId: agencyId,
        externalAgencyId: parsed.data.externalAgencyId ?? makeId("ext"),
        externalAgencyName: parsed.data.externalAgencyName,
        phoneNumber: parsed.data.phoneNumber,
        sipUri: parsed.data.sipUri,
        description: parsed.data.description,
        transferType: parsed.data.transferType,
        afterHoursMessage: parsed.data.afterHoursMessage,
        afterHoursAlternative: parsed.data.afterHoursAlternative,
        callerExperienceScript: parsed.data.callerExperienceScript,
        transferSummaryTemplate: parsed.data.transferSummaryTemplate,
        enabled: parsed.data.enabled,
        triageClassifications: parsed.data.triageClassifications,
        acceptedCallTypes: parsed.data.acceptedCallTypes ?? parsed.data.triageClassifications,
        hoursTimezone: parsed.data.hoursTimezone,
        hoursAllDay: parsed.data.hoursAllDay,
        afterHoursPolicy: parsed.data.afterHoursPolicy,
        fallbackPhoneNumber: parsed.data.fallbackPhoneNumber,
        fallbackSipUri: parsed.data.fallbackSipUri,
        transferFailurePolicy: parsed.data.transferFailurePolicy,
        maxAttempts: parsed.data.maxAttempts,
      });
      await callAssistStore.putExternal(row);
      return withCorrelationHeaders(event, ok({ agency: row }));
    }

    if (method === "DELETE" && parts[0] === "external-agencies" && parts[1]) {
      requirePerm(user, "call_assist.admin.config");
      await callAssistStore.deleteExternal(agencyId, parts[1]);
      return withCorrelationHeaders(event, ok({ ok: true }));
    }

    if (method === "GET" && parts[0] === "knowledge") {
      requirePerm(user, "call_assist.knowledge.manage");
      const items = await callAssistStore.listAllKnowledge(agencyId);
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (method === "POST" && parts[0] === "knowledge") {
      requirePerm(user, "call_assist.knowledge.manage");
      const parsed = callAssistKnowledgeUpsertSchema.safeParse(body ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const row = await callAssistStore.putKnowledge({
        agencyId: agencyId,
        articleId: parsed.data.articleId ?? makeId("kb"),
        title: parsed.data.title,
        body: parsed.data.body,
        tags: parsed.data.tags,
        enabled: parsed.data.enabled,
        source: parsed.data.source,
        sourceType: parsed.data.sourceType ?? "manual",
        updatedAt: new Date().toISOString(),
      });
      return withCorrelationHeaders(event, ok({ article: row }));
    }

    if (method === "DELETE" && parts[0] === "knowledge" && parts[1]) {
      requirePerm(user, "call_assist.knowledge.manage");
      await callAssistStore.deleteKnowledge(agencyId, parts[1]);
      return withCorrelationHeaders(event, ok({ ok: true }));
    }

    if (method === "GET" && parts[0] === "retention") {
      requirePerm(user, "call_assist.retention.manage");
      const config = await getOrCreateConfig(agencyId);
      return withCorrelationHeaders(
        event,
        ok({ retention: config.retention, lastRun: config.retentionLastRun ?? null }),
      );
    }

    if (method === "GET" && parts[0] === "records-requests") {
      requirePerm(user, "call_assist.records.request");
      const items = await callAssistStore.listRecordsRequests(agencyId);
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (method === "POST" && parts[0] === "records-requests") {
      requirePerm(user, "call_assist.records.request");
      const parsed = callAssistRecordsRequestSchema.safeParse(body ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const now = new Date().toISOString();
      const row = {
        agencyId: agencyId,
        requestId: makeId("prr"),
        requestorName: parsed.data.requestorName,
        requestorEmail: parsed.data.requestorEmail,
        dateFrom: parsed.data.dateFrom,
        dateTo: parsed.data.dateTo,
        notes: parsed.data.notes,
        sessionIds: parsed.data.sessionIds,
        status: "OPEN" as const,
        createdAt: now,
        updatedAt: now,
        actorId: user.userId,
      };
      await callAssistStore.putRecordsRequest(row);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CALL_ASSIST_RECORDS_REQUEST,
        details: { requestId: row.requestId },
        createdAt: now,
        resourceType: "agency",
        resourceId: row.requestId,
      });
      return withCorrelationHeaders(event, ok({ request: row }));
    }

    if (method === "GET" && parts[0] === "demo" && parts[1] === "scenarios") {
      requirePerm(user, "call_assist.demo.run");
      const items = await listDemoScenariosForAgency(agencyId);
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (method === "POST" && parts[0] === "demo" && parts[1] === "run") {
      requirePerm(user, "call_assist.demo.run");
      const parsed = callAssistDemoRunSchema.safeParse(body ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await runDemoScenario({
        agencyId: agencyId,
        actorId: user.userId,
        scenarioId: parsed.data.scenarioId,
      });
      return withCorrelationHeaders(event, ok({ result }));
    }

    if (method === "GET" && parts[0] === "analytics" && parts.length === 1) {
      requirePerm(user, "call_assist.analytics.view");
      const open = await callAssistStore.listSessions(agencyId, true, 200);
      const surveys = await callAssistStore.listSurveys(agencyId, 200);
      const avg =
        surveys.length === 0 ? null : surveys.reduce((sum, s) => sum + s.score, 0) / surveys.length;
      const emergencyTransfers = open.filter((s) => s.state === "TRANSFERRING_911").length;
      const dashboard = await buildCallAssistAnalyticsDashboard(agencyId, {});
      return withCorrelationHeaders(
        event,
        ok({
          openSessions: open.length,
          emergencyTransfers,
          surveyCount: surveys.length,
          surveyAverage: avg,
          dashboard,
        }),
      );
    }

    const p3 = await handleCallAssistP3(event, { user, agencyId, method, parts, body });
    if (p3) return p3;
    const p2 = await handleCallAssistP2(event, { user, agencyId, method, parts, body });
    if (p2) return p2;

    return withCorrelationHeaders(event, notFound("Unknown route"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "FORBIDDEN") return withCorrelationHeaders(event, forbidden());
    if (error instanceof LexBotQuotaExhaustedError) {
      return withCorrelationHeaders(event, serviceUnavailable(error.message));
    }
    if (message === "SESSION_NOT_FOUND") return withCorrelationHeaders(event, notFound("Session not found"));
    if (message === "PROPOSAL_NOT_FOUND") return withCorrelationHeaders(event, notFound("Proposal not found"));
    if (message === "PROPOSAL_NOT_ACTIONABLE") return withCorrelationHeaders(event, badRequest("Proposal cannot be decided in its current status"));
    if (message === "DEMO_MODE_DISABLED") {
      return withCorrelationHeaders(event, serviceUnavailable("Call Assist demo mode is not enabled"));
    }
    if (message === "SCENARIO_NOT_FOUND") return withCorrelationHeaders(event, notFound("Scenario not found"));
    console.error("[call-assist.http]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
