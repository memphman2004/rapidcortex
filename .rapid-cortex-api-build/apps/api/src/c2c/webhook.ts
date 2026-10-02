import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { parseCadSlotPathToken, type CADSlot } from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../lib/correlation.js";
import { env } from "../lib/env.js";
import { ok, serverError, serviceUnavailable, unauthorized } from "../lib/response.js";
import { pickSignatureHeader, validateHmacSha256 } from "../cad-bridge/adapters/hmac.js";
import { GenericRestCadAdapter, loadSlotCredentials } from "./cad-adapters/generic-rest.adapter.js";
import { getAgencySlots, isSlotAcceptingInbound } from "./slots.js";
import { getC2cRuntime, resetC2cRuntime } from "./runtime.js";
import { validateEido } from "./eido/validator.js";

export async function handleC2cWebhook(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (!env.enableC2cHub) {
    return withCorrelationHeaders(event, serviceUnavailable("C2C hub is not enabled"));
  }
  const parsed = parsePath(event);
  if (!parsed) return withCorrelationHeaders(event, ok({ error: "Missing path parameters" }, 400));
  const { agencyId, cadSlot } = parsed;
  const rawBody = event.body ?? "";
  if (!rawBody) return withCorrelationHeaders(event, ok({ error: "Empty body" }, 400));

  const config = await getAgencySlots(agencyId);
  const slot = config.slots.find((s) => s.slot === cadSlot);
  if (!slot) return withCorrelationHeaders(event, ok({ error: "Unknown CAD slot" }, 404));
  if (!isSlotAcceptingInbound(slot)) return withCorrelationHeaders(event, ok({ status: "OK", outcome: "SLOT_OFF" }));

  const creds = await loadSlotCredentials(slot);
  if (!creds.webhookSecret) {
    return withCorrelationHeaders(
      event,
      ok({ status: "OK", outcome: "WAITING_FOR_WEBHOOK_SECRET", secret: slot.credentialsSecretArn }, 503),
    );
  }
  const signatureHeader = pickSignatureHeader(event.headers ?? {});
  if (!validateHmacSha256(rawBody, signatureHeader, creds.webhookSecret)) {
    return withCorrelationHeaders(event, unauthorized());
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return withCorrelationHeaders(event, ok({ error: "Invalid JSON" }, 400));
  }

  const adapter = new GenericRestCadAdapter(agencyId, slot);
  const eido = adapter.ingestWebhookPayload(payload);
  eido.header.SenderAgencyId = `${agencyId}:${cadSlot}`;
  eido.header.SenderAgencyName = slot.label;
  const valid = validateEido(eido);
  if (!valid.ok) {
    console.warn(JSON.stringify({ type: "c2c.webhook.invalid_eido", agencyId, cadSlot, errors: valid.error }));
    return withCorrelationHeaders(event, ok({ status: "OK", outcome: "INVALID_EIDO" }));
  }

  try {
    resetC2cRuntime(agencyId);
    const runtime = await getC2cRuntime(agencyId);
    const result = await runtime.router.routeNewIncident(valid.value);
    return withCorrelationHeaders(event, ok({ status: "OK", routing: result }));
  } catch (err) {
    console.error("[c2c.webhook] route failed", { agencyId, message: err instanceof Error ? err.message : "unknown" });
    return withCorrelationHeaders(event, serverError());
  }
}

function parsePath(event: APIGatewayProxyEventV2): { agencyId: string; cadSlot: CADSlot } | null {
  const agencyId = event.pathParameters?.agencyId;
  const slotParam = event.pathParameters?.slot ?? "";
  const path = event.rawPath ?? "";
  const fromPath = path.match(/\/api\/public\/c2c\/([^/]+)\/(cad-[a-h])\/events/i);
  const id = agencyId || fromPath?.[1];
  const slot = slotParam || fromPath?.[2] || "";
  const cadSlot = parseCadSlotPathToken(slot);
  if (!id || !cadSlot) return null;
  return { agencyId: decodeURIComponent(id), cadSlot };
}
