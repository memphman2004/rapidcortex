import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { rcAdminProvisioningInvokeSchema } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import {
  fetchAdobeAgreementFormFields,
  getAdobeSignAccessToken,
  getAdobeSignClientId,
  verifyAdobeSignWebhookToken,
} from "../services/adobeSignClient.js";
import { generateAgencyIdFromAdobeSign } from "../services/rcAdminAdobeProvisioningService.js";
import { PendingProvisionRepository } from "../repositories/pendingProvisionRepository.js";

const pendingRepo = new PendingProvisionRepository();
const lambda = new LambdaClient({ region: env.region });

const COMPLETED_EVENTS = new Set([
  "AGREEMENT_WORKFLOW_COMPLETED",
  "AGREEMENT_ALL_COMPLETE",
]);

function json(statusCode: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    statusCode,
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

/** Adobe Sign account registration handshake (GET). */
async function handleVerification(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const clientId = await getAdobeSignClientId();
  const headerClient =
    event.headers?.["x-adobesign-clientid"] ?? event.headers?.["X-AdobeSign-ClientId"];
  if (!clientId || headerClient !== clientId) {
    return json(401, { error: "Unauthorized" });
  }
  return json(
    200,
    { xAdobeSignClientId: clientId },
    { "x-adobesign-clientid": clientId },
  );
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!env.adobeSignWebhookEnabled) {
    return json(503, { error: "Adobe Sign webhook disabled" });
  }

  const method = event.requestContext.http.method;
  if (method === "GET") {
    return handleVerification(event);
  }

  if (method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const clientId = await getAdobeSignClientId();
  const headerClient =
    event.headers?.["x-adobesign-clientid"] ?? event.headers?.["X-AdobeSign-ClientId"];
  if (!clientId || headerClient !== clientId) {
    console.warn("[adobe-sign-webhook] invalid client id");
    return json(401, { error: "Unauthorized" });
  }

  const webhookToken =
    event.headers?.["x-adobesign-webhook-token"] ??
    event.headers?.["X-AdobeSign-Webhook-Token"];
  if (!(await verifyAdobeSignWebhookToken(webhookToken))) {
    return json(401, { error: "Unauthorized" });
  }

  let payload: { event?: string; agreementId?: string };
  try {
    payload = JSON.parse(event.body ?? "{}") as { event?: string; agreementId?: string };
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const eventType = payload.event ?? "";
  const agreementId = payload.agreementId?.trim();
  if (!agreementId) {
    return json(200, { ok: true, skipped: true, reason: "no_agreement_id" });
  }

  if (!COMPLETED_EVENTS.has(eventType)) {
    return json(200, { ok: true, skipped: true, eventType });
  }

  const existing = await pendingRepo.get(agreementId);
  if (existing?.status === "completed") {
    return json(200, { ok: true, skipped: true, reason: "already_completed" });
  }

  const token = await getAdobeSignAccessToken();
  const fields = await fetchAdobeAgreementFormFields(agreementId, token);
  const contactEmail =
    fields.technical_contact_email ?? fields.signer_email ?? "";
  if (!contactEmail) {
    return json(200, { ok: true, error: "missing_contact_email" });
  }

  const agencyId = generateAgencyIdFromAdobeSign(fields.customer_legal_name);
  const invokeBody = rcAdminProvisioningInvokeSchema.parse({
    source: "adobe_sign_webhook",
    action: fields.agreement_type === "rc_lite" ? "auto_provision" : "platform_notify",
    agreementId,
    agencyId,
    agreementType: fields.agreement_type,
    customerName: fields.customer_legal_name,
    contactName: fields.technical_contact_name,
    contactEmail,
    tier: fields.service_tier,
    useCaseDesc: fields.use_case_description,
  });

  const fn = env.rcAdminProvisioningFunctionName;
  if (!fn) {
    return json(503, { error: "provisioning_function_not_configured" });
  }

  await lambda.send(
    new InvokeCommand({
      FunctionName: fn,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify(invokeBody)),
    }),
  );

  return json(200, {
    ok: true,
    action: invokeBody.action,
    agencyId,
    agreementType: fields.agreement_type,
  });
};
