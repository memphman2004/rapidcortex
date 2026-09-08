import { createHash, timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { callAssistConnectWebhookSchema, callAssistSelfServiceCompleteBodySchema, sentimentFromLex } from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";
import {
  badRequest,
  badRequestFromZod,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { callAssistStore } from "../../call-assist/store.js";
import { getOrCreateConfig, isWithinOperatingHours } from "../../call-assist/config-service.js";
import { completeSession, initiateSession, processUtterance } from "../../call-assist/session-pipeline.js";
import { closeOpenTransferAttempts } from "../../call-assist/transfer-ledger.js";
import { completeSelfService, markSelfServiceOpened } from "../../call-assist/sms-self-service.js";
import { decideCallbackOffer } from "../../call-assist/callback-campaign.js";

function lexSentimentFromConnect(attrs?: Record<string, string>) {
  const label = (attrs?.LexSentiment ?? attrs?.sentiment ?? "").toUpperCase();
  if (label !== "POSITIVE" && label !== "NEGATIVE" && label !== "NEUTRAL" && label !== "MIXED") {
    return undefined;
  }
  return sentimentFromLex({
    sentiment: label,
    sentimentScore: {
      positive: Number(attrs?.sentimentPositive ?? (label === "POSITIVE" ? 0.8 : 0.05)),
      negative: Number(attrs?.sentimentNegative ?? (label === "NEGATIVE" ? 0.8 : 0.05)),
      mixed: Number(attrs?.sentimentMixed ?? (label === "MIXED" ? 0.8 : 0.05)),
      neutral: Number(attrs?.sentimentNeutral ?? (label === "NEUTRAL" ? 0.8 : 0.05)),
    },
  });
}
function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

function header(event: Parameters<APIGatewayProxyHandlerV2>[0], name: string): string | undefined {
  const headers = event.headers ?? {};
  const needle = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === needle && typeof v === "string") return v;
  }
  return undefined;
}

function secretsEqual(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableCallAssist || !env.callAssistTable) {
      return withCorrelationHeaders(event, serviceUnavailable("Call Assist is not enabled"));
    }

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";

    if (path.includes("/self-service/")) {
      const token = decodeURIComponent(path.split("/self-service/").pop()?.split("/")[0] ?? "").trim();
      if (!token) return withCorrelationHeaders(event, badRequest("token required"));
      if (method === "GET") {
        const session = await markSelfServiceOpened(token);
        if (!session) return withCorrelationHeaders(event, unauthorized("Invalid or expired link"));
        return withCorrelationHeaders(
          event,
          ok({
            agencyId: session.agencyId,
            sessionId: session.sessionId,
            portalUrl: session.smsSelfService?.portalUrl ?? "",
            status: session.smsSelfService?.status ?? "SENT",
            caseNumber: session.caseNumber,
          }),
        );
      }
      if (method === "POST") {
        const raw = parseBody(event.body);
        const parsed = callAssistSelfServiceCompleteBodySchema.safeParse(raw ?? {});
        if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
        const session = await completeSelfService({
          token,
          disposition: parsed.data.disposition,
          notes: parsed.data.notes,
        });
        return withCorrelationHeaders(
          event,
          ok({
            sessionId: session.sessionId,
            status: session.smsSelfService?.status,
            portalUrl: session.smsSelfService?.portalUrl,
          }),
        );
      }
    }

    const expected = await resolvePlainOrSecretArn(
      env.callAssistConnectWebhookSecret,
      env.callAssistConnectWebhookSecretArn,
      { preferredField: "webhookSecret" },
    );
    const provided = header(event, "x-call-assist-secret") ?? header(event, "x-amazon-connect-signature") ?? "";
    if (!env.callAssistConnectMock) {
      if (!expected) return withCorrelationHeaders(event, unauthorized("Connect webhook secret is not configured"));
      if (!provided || !secretsEqual(provided, expected)) {
        return withCorrelationHeaders(event, unauthorized("Invalid Connect webhook secret"));
      }
    }

    if (method === "GET" && path.includes("/schedule")) {
      const agencyId = event.queryStringParameters?.agencyId?.trim();
      if (!agencyId) return withCorrelationHeaders(event, badRequest("agencyId required"));
      const config = await getOrCreateConfig(agencyId);
      return withCorrelationHeaders(
        event,
        ok({ open: isWithinOperatingHours(config), hours: config.operatingHours, disclosure: config.disclosureText }),
      );
    }

    const body = parseBody(event.body);
    if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    const parsed = callAssistConnectWebhookSchema.safeParse(body);
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    const msg = parsed.data;
    const actorId = "connect-webhook";

    if (msg.eventType === "INITIATED") {
      const session = await initiateSession({
        agencyId: msg.agencyId,
        actorId,
        source: "CONNECT",
        ani: msg.ani,
        connectContactId: msg.contactId,
        connectAttributes: msg.attributes,
        mediaType: msg.mediaType,
      });
      const config = await getOrCreateConfig(msg.agencyId);
      return withCorrelationHeaders(
        event,
        ok({
          session,
          telephony: {
            action: "CONTINUE",
            continueAiConversation: true,
            spokenCallerScript: config.disclosureText,
          },
        }),
      );
    }

    if (msg.eventType === "UTTERANCE") {
      if (!msg.text) return withCorrelationHeaders(event, badRequest("text required"));
      const open = await callAssistStore.listSessions(msg.agencyId, true, 50);
      const session =
        open.find((s) => s.connectContactId === msg.contactId) ??
        (await callAssistStore.getSession(msg.agencyId, msg.contactId));
      const sessionId = session?.sessionId;
      if (!sessionId) {
        const created = await initiateSession({
          agencyId: msg.agencyId,
          actorId,
          source: "CONNECT",
          ani: msg.ani,
          connectContactId: msg.contactId,
          connectAttributes: msg.attributes,
          mediaType: msg.mediaType,
        });
        const result = await processUtterance({
          agencyId: msg.agencyId,
          actorId,
          sessionId: created.sessionId,
          text: msg.text,
          participantRole: msg.participantRole ?? msg.attributes?.ParticipantRole ?? msg.attributes?.participantRole,
          speakerId: msg.speakerLabel,
          contactLensTone: msg.attributes?.VoiceTone,
          lexSentiment: lexSentimentFromConnect(msg.attributes),
        });
        return withCorrelationHeaders(event, ok(result));
      }
      const result = await processUtterance({
        agencyId: msg.agencyId,
        actorId,
        sessionId,
        text: msg.text,
        participantRole: msg.participantRole ?? msg.attributes?.ParticipantRole ?? msg.attributes?.participantRole,
        speakerId: msg.speakerLabel,
        contactLensTone: msg.attributes?.VoiceTone,
        lexSentiment: lexSentimentFromConnect(msg.attributes),
      });
      return withCorrelationHeaders(event, ok(result));
    }

    if (msg.eventType === "DTMF") {
      const digit = Number.parseInt(msg.dtmf ?? "", 10);
      const open = await callAssistStore.listSessions(msg.agencyId, true, 50);
      const session = open.find((s) => s.connectContactId === msg.contactId);
      if (session?.state === "CALLBACK_OFFERED" && (digit === 1 || digit === 2)) {
        await decideCallbackOffer({
          session,
          actorId,
          accept: digit === 1,
          nowIso: new Date().toISOString(),
        });
        return withCorrelationHeaders(event, ok({ ok: true, callback: digit === 1 ? "queued" : "declined" }));
      }
      if (digit >= 1 && digit <= 5 && session) {
        await callAssistStore.putSurvey({
          agencyId: msg.agencyId,
          sessionId: session.sessionId,
          score: digit,
          channel: "DTMF",
          createdAt: new Date().toISOString(),
        });
      }
      return withCorrelationHeaders(event, ok({ ok: true }));
    }

    if (msg.eventType === "TRANSFER_RESULT") {
      const open = await callAssistStore.listSessions(msg.agencyId, true, 50);
      const session =
        open.find((s) => s.connectContactId === msg.contactId) ??
        (await callAssistStore.getSession(msg.agencyId, msg.contactId));
      if (!session) return withCorrelationHeaders(event, ok({ ok: true, ignored: true }));
      const outcome = msg.transferOutcome ?? "FAILED";
      await closeOpenTransferAttempts({
        agencyId: msg.agencyId,
        sessionId: session.sessionId,
        actorId,
        outcome,
        failureReason: outcome === "ANSWERED" || outcome === "COMPLETED" ? undefined : "connect_transfer_result",
      });
      session.lastTransferOutcome = outcome;
      session.updatedAt = new Date().toISOString();
      await callAssistStore.putSession(session);
      return withCorrelationHeaders(event, ok({ ok: true, outcome }));
    }

    if (msg.eventType === "DISCONNECT") {
      const open = await callAssistStore.listSessions(msg.agencyId, true, 50);
      const session = open.find((s) => s.connectContactId === msg.contactId);
      if (session) await completeSession(msg.agencyId, session.sessionId, actorId);
      return withCorrelationHeaders(event, ok({ ok: true }));
    }

    return withCorrelationHeaders(event, badRequest("Unsupported eventType"));
  } catch (error) {
    console.error("[call-assist.connectWebhook]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
