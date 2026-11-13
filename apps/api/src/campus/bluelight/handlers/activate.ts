/**
 * Campus Blue-Light Connect — POST /api/campus/bluelight/activate
 *
 * Vendor / machine ingest endpoint. Authenticated with a shared API key
 * (x-bluelight-token header). No Cognito JWT — this is machine-to-machine.
 *
 * The failsafe constraint is enforced here:
 *   - NexCort iQ is a parallel observer; it never touches the SIP/PSTN voice path.
 *   - Simulation events are hard-blocked unless BLUELIGHT_ALLOW_SIMULATION === "true".
 *
 * Campus vertical only.
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type { RawActivationPayload } from "rapid-cortex-shared";
import { rawActivationPayloadSchema } from "rapid-cortex-shared";
import { ActivationAdapter, ActivationAdapterError } from "../activation-adapter.js";
import { BlueLightIncidentService } from "../blue-light-incident-service.js";
import { BlueLightRegistry } from "../blue-light-registry.js";
import { broadcastToAgency } from "../../../lib/websocket/send-message.js";
import { withCorrelationHeaders } from "../../../lib/correlation.js";
import { badRequestFromZod, forbidden, ok, serverError, unauthorized } from "../../../lib/response.js";
import { BLUE_LIGHT_WS_EVENT_ACTIVATION } from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../../../lib/runtimeSecrets.js";

const registry = new BlueLightRegistry();
const adapter = new ActivationAdapter(registry);
const incidentService = new BlueLightIncidentService();

/** Resolved once per cold start (5-min TTL via resolvePlainOrSecretArn cache). */
async function getValidApiKeys(): Promise<string[]> {
  const plain = process.env.BLUELIGHT_API_KEYS_PLAIN;
  const arn = process.env.BLUELIGHT_API_KEY_SECRET_ARN;
  const resolved = await resolvePlainOrSecretArn(plain, arn, { preferredField: "apiKey" });
  return resolved
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // ── API key auth (machine ingress — no Cognito) ────────────────────────────
  const token =
    event.headers?.["x-bluelight-token"] ?? event.headers?.["X-Bluelight-Token"];

  const validApiKeys = await getValidApiKeys();
  if (!token || !validApiKeys.includes(token)) {
    console.warn(
      JSON.stringify({
        msg: "bluelight_activate_unauthorized",
        requestId: event.requestContext.requestId,
      }),
    );
    return withCorrelationHeaders(event, unauthorized());
  }

  // ── Parse + validate body via Zod ─────────────────────────────────────────
  let raw: RawActivationPayload;
  if (!event.body) {
    return withCorrelationHeaders(event, ok({ error: "Empty body", code: "INVALID_BODY" }, 400));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(event.body);
  } catch {
    return withCorrelationHeaders(event, ok({ error: "Invalid JSON body", code: "INVALID_BODY" }, 400));
  }

  const result = rawActivationPayloadSchema.safeParse(parsed);
  if (!result.success) {
    return withCorrelationHeaders(event, badRequestFromZod(result.error));
  }
  raw = result.data;

  // ── Failsafe: simulation hard-block in production ─────────────────────────
  if (raw.event === "simulated" && process.env.BLUELIGHT_ALLOW_SIMULATION !== "true") {
    return withCorrelationHeaders(
      event,
      forbidden("Simulation events are disabled in this environment"),
    );
  }

  console.log(
    JSON.stringify({
      msg: "bluelight_activate_received",
      event: raw.event,
      requestId: event.requestContext.requestId,
    }),
  );

  // ── Normalize payload ──────────────────────────────────────────────────────
  let normalized;
  try {
    normalized = await adapter.normalize(raw);
  } catch (err) {
    if (err instanceof ActivationAdapterError) {
      console.error(
        JSON.stringify({
          msg: "bluelight_adapter_error",
          code: err.code,
          error: err.message,
        }),
      );
      return withCorrelationHeaders(event, ok({ success: false, error: err.message, code: err.code }, 422));
    }
    throw err;
  }

  // ── Re-fetch pole for incident creation ───────────────────────────────────
  const pole = await registry.getPoleById(normalized.poleId);
  if (!pole) {
    return withCorrelationHeaders(
      event,
      ok({ success: false, error: `Pole not found: ${normalized.poleId}`, code: "POLE_NOT_FOUND" }, 404),
    );
  }

  // ── Create incident ────────────────────────────────────────────────────────
  let incident;
  try {
    incident = await incidentService.createFromActivation(normalized, pole);
  } catch (err) {
    console.error(JSON.stringify({ msg: "bluelight_incident_create_failed", error: String(err) }));
    return withCorrelationHeaders(event, serverError("Failed to create incident"));
  }

  // ── Push to campus consoles (non-blocking) ─────────────────────────────────
  broadcastToAgency({
    agencyId: pole.campusId,
    message: {
      type: BLUE_LIGHT_WS_EVENT_ACTIVATION,
      data: { incident },
    },
  }).catch((err) => {
    console.error(
      JSON.stringify({
        msg: "bluelight_ws_broadcast_failed",
        incidentId: incident.incidentId,
        error: String(err),
      }),
    );
  });

  console.log(
    JSON.stringify({
      msg: "bluelight_activate_ok",
      incidentId: incident.incidentId,
      poleId: pole.poleId,
      poleLabel: pole.label,
    }),
  );

  return withCorrelationHeaders(
    event,
    ok({
      success: true,
      eventId: normalized.eventId,
      incidentId: incident.incidentId,
      poleId: pole.poleId,
      message: `Incident ${incident.incidentId} created for ${pole.label}`,
    }),
  );
};
