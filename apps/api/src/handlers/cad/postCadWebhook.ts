import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { env } from "../../lib/env.js";
import { CadIntegrationRepository } from "../../repositories/cadIntegrationRepository.js";
import { verifyCadWebhookSignature, verifyCadWebhookToken } from "../../services/cad/cadWebhookSecret.js";
import type { CadWebhookIngressMessage } from "../../services/cad/cadWebhookProcessService.js";

const integrationRepo = new CadIntegrationRepository();
const sns = new SNSClient({ region: env.region });

function headerCi(h: Record<string, string | undefined> | undefined, name: string): string | undefined {
  if (!h) return undefined;
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(h)) {
    if (k.toLowerCase() === want && typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

function ack200(body: unknown) {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function unauthorized401(body: unknown) {
  return {
    statusCode: 401,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method;
  if (method !== "POST") {
    return ack200({ ok: false, error: "method_not_allowed" });
  }

  const agencyId = event.pathParameters?.agencyId?.trim();
  const integrationId = event.pathParameters?.integrationId?.trim();
  if (!agencyId || !integrationId) {
    return ack200({ ok: false, error: "not_found" });
  }

  const rawBody = event.body ?? "";
  const receivedAt = new Date().toISOString();

  if (!env.cadIntegrationsTable) {
    return ack200({ ok: false, error: "service_unconfigured" });
  }

  const integration = await integrationRepo.getById(agencyId, integrationId);
  if (!integration) {
    return ack200({ ok: true, received: true, accepted: false, reason: "integration_not_found" });
  }

  const h = event.headers ?? {};
  const contentType = headerCi(h as Record<string, string | undefined>, "content-type");
  const authz = h.authorization ?? h.Authorization ?? "";
  const headerToken =
    h["x-rc-token"] ??
    h["X-RC-Token"] ??
    (typeof authz === "string" && authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : undefined);
  const qs = event.queryStringParameters ?? {};
  const token = headerToken ?? qs.token ?? "";
  const salt = env.cadWebhookSecretSalt;
  if (!salt || !verifyCadWebhookToken(salt, token, integration.webhookSecretHash)) {
    return ack200({ ok: true, received: true, accepted: false, reason: "unauthorized" });
  }

  const sig = h["x-rc-signature"] ?? h["X-RC-Signature"];
  const sigStr = typeof sig === "string" ? sig : undefined;
  if (sigStr?.trim() && !verifyCadWebhookSignature(rawBody, token, sigStr)) {
    return unauthorized401({ ok: false, error: "invalid_signature" });
  }

  const ingressArn = env.cadWebhookIngressTopicArn;
  if (!ingressArn) {
    return ack200({ ok: true, received: true, accepted: false, reason: "ingress_unconfigured" });
  }

  const idem =
    h["idempotency-key"] ?? h["Idempotency-Key"] ?? (typeof h["IDEMPOTENCY-KEY"] === "string" ? h["IDEMPOTENCY-KEY"] : undefined);
  const idempotencyKey = typeof idem === "string" ? idem.trim() : undefined;

  const msg: CadWebhookIngressMessage = {
    v: 1,
    agencyId,
    integrationId,
    rawBody,
    receivedAt,
    ...(contentType ? { contentType } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };

  void sns
    .send(
      new PublishCommand({
        TopicArn: ingressArn,
        Message: JSON.stringify(msg),
      }),
    )
    .catch((err: unknown) => {
      console.error(
        JSON.stringify({
          type: "cad.webhook.ingress_publish_failed",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    });

  return ack200({ ok: true, received: true, accepted: true, queued: true });
};
