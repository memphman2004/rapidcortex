import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { RC_BRIDGE_SOURCE_HEADER, type CADSlot } from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../lib/correlation.js";
import { env } from "../lib/env.js";
import { ok, serverError, serviceUnavailable, unauthorized } from "../lib/response.js";
import { AdapterParseError, getCadBridgeAdapter } from "./adapters/index.js";
import { headerValue, pickSignatureHeader } from "./adapters/hmac.js";
import { checkForLoop } from "./loop-guard.js";
import { resolveCadBridgeSecret } from "./secrets.js";
import { emitCadBridgeMetrics } from "./metrics.js";
import { cadBridgeStore, isCadBridgeStoreConfigured } from "./store.js";

const sqs = new SQSClient({ region: env.region });

export async function handleCadBridgeWebhook(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  if (!env.enableCadBridge || !isCadBridgeStoreConfigured()) {
    return withCorrelationHeaders(event, serviceUnavailable("CAD bridge is not enabled"));
  }
  if (!env.cadBridgeQueueUrl) {
    return withCorrelationHeaders(event, serviceUnavailable("CAD bridge queue is not configured"));
  }

  const parsed = parsePath(event);
  if (!parsed) return withCorrelationHeaders(event, ok({ error: "Missing path parameters" }, 400));
  const { agencyId, cadSlot } = parsed;
  const rawBody = event.body ?? "";
  if (!rawBody) return withCorrelationHeaders(event, ok({ error: "Empty body" }, 400));

  const config = await cadBridgeStore.getConfig(agencyId);
  if (!config) return withCorrelationHeaders(event, ok({ error: "Not Found" }, 404));
  if (!config.enabled) return withCorrelationHeaders(event, ok({ status: "OK" }));

  const slotConfig = cadSlot === "CAD_A" ? config.cadA : config.cadB;
  if (!slotConfig.inboundEnabled) return withCorrelationHeaders(event, ok({ status: "OK" }));

  const sourceHeader = headerValue(event.headers ?? {}, "x-rc-bridge-source");
  if (sourceHeader === RC_BRIDGE_SOURCE_HEADER) {
    await emitCadBridgeMetrics({ agencyId, cadSlot, loopDetected: 1 });
    return withCorrelationHeaders(event, ok({ status: "OK", outcome: "LOOP_DETECTED" }));
  }

  const signingSecret = await resolveCadBridgeSecret(slotConfig.webhookSigningSecretArn, "webhookSecret");
  const adapter = getCadBridgeAdapter(slotConfig.vendor);
  const signatureHeader = pickSignatureHeader(event.headers ?? {});
  if (!adapter.validateSignature(rawBody, signatureHeader, signingSecret)) {
    return withCorrelationHeaders(event, unauthorized());
  }

  const inboundEventId = headerValue(event.headers ?? {}, "x-event-id");
  const loopCheck = await checkForLoop(agencyId, rawBody, inboundEventId || undefined);
  if (loopCheck.isLoop) {
    await emitCadBridgeMetrics({ agencyId, cadSlot, loopDetected: 1 });
    return withCorrelationHeaders(event, ok({ status: "OK", outcome: "LOOP_DETECTED" }));
  }

  let bridgeEvent;
  try {
    bridgeEvent = await adapter.parseInbound(rawBody, event.headers ?? {}, agencyId);
    bridgeEvent.sourceSlot = cadSlot;
  } catch (err) {
    if (err instanceof AdapterParseError) {
      return withCorrelationHeaders(event, ok({ status: "OK" }));
    }
    console.error("[cad-bridge.webhook] parse failed", { agencyId });
    return withCorrelationHeaders(event, serverError());
  }

  try {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: env.cadBridgeQueueUrl,
        MessageBody: JSON.stringify(bridgeEvent),
        MessageGroupId: `${agencyId}#${bridgeEvent.sourceIncidentId}`,
        MessageDeduplicationId: bridgeEvent.eventId,
        MessageAttributes: {
          agencyId: { DataType: "String", StringValue: agencyId },
          cadSlot: { DataType: "String", StringValue: cadSlot },
          eventType: { DataType: "String", StringValue: bridgeEvent.eventType },
        },
      }),
    );
  } catch (err) {
    console.error("[cad-bridge.webhook] SQS enqueue failed", {
      agencyId,
      eventId: bridgeEvent.eventId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return withCorrelationHeaders(event, serverError());
  }

  return withCorrelationHeaders(event, ok({ status: "OK" }));
}

function parsePath(event: APIGatewayProxyEventV2): { agencyId: string; cadSlot: CADSlot } | null {
  const agencyId = event.pathParameters?.agencyId;
  const slotParam = (event.pathParameters?.slot ?? "").toLowerCase();
  const path = event.rawPath ?? "";
  const fromPath = path.match(/\/api\/public\/cad-bridge\/([^/]+)\/(cad-a|cad-b)\/events/i);
  const id = agencyId || fromPath?.[1];
  const slot = slotParam || fromPath?.[2] || "";
  if (!id || (slot !== "cad-a" && slot !== "cad-b")) return null;
  return { agencyId: decodeURIComponent(id), cadSlot: slot === "cad-a" ? "CAD_A" : "CAD_B" };
}
