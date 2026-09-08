import { createHash, timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { callAssistConnectWebhookSchema } from "rapid-cortex-shared";
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

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";

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
        });
        return withCorrelationHeaders(event, ok(result));
      }
      const result = await processUtterance({
        agencyId: msg.agencyId,
        actorId,
        sessionId,
        text: msg.text,
      });
      return withCorrelationHeaders(event, ok(result));
    }

    if (msg.eventType === "DTMF") {
      const digit = Number.parseInt(msg.dtmf ?? "", 10);
      if (digit >= 1 && digit <= 5) {
        const open = await callAssistStore.listSessions(msg.agencyId, true, 50);
        const session = open.find((s) => s.connectContactId === msg.contactId);
        if (session) {
          await callAssistStore.putSurvey({
            agencyId: msg.agencyId,
            sessionId: session.sessionId,
            score: digit,
            channel: "DTMF",
            createdAt: new Date().toISOString(),
          });
        }
      }
      return withCorrelationHeaders(event, ok({ ok: true }));
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
