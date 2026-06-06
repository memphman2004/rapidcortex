import { createHmac } from "node:crypto";
import { env } from "../lib/env.js";
import { decryptWebhookSigningSecret } from "../lib/webhookSecretEncryption.js";
import { makeId } from "../lib/ids.js";
import type { WebhookRecord } from "../repositories/webhookRepository.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function signBody(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

export type WebhookDeliverResult = {
  ok: boolean;
  httpStatus?: number;
  errorCode?: string;
  attempts: number;
};

/**
 * POST JSON to webhook with HMAC signature. Retries with simple backoff (same invocation).
 * Set `EXTERNAL_API_MOCK=true` to skip network (tests).
 */
export async function deliverSignedWebhook(
  row: WebhookRecord,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<WebhookDeliverResult> {
  const secret = await decryptWebhookSigningSecret(row.signingSecretEnc);
  const ts = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    id: makeId("whd"),
    event: eventType,
    agencyId: row.agencyId,
    webhookId: row.webhookId,
    timestamp: new Date().toISOString(),
    apiVersion: "v1",
    data: payload,
  });
  const sig = signBody(secret, ts, body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Rapid-Cortex-Signature": `v1=${sig}`,
    "X-Rapid-Cortex-Timestamp": ts,
    "X-Rapid-Cortex-Event": eventType,
  };

  if (env.externalApiMock) {
    return { ok: true, httpStatus: 202, attempts: 0 };
  }

  const maxAttempts = 3;
  let lastStatus: number | undefined;
  let lastErr: string | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(row.targetUrl, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(15_000),
      });
      lastStatus = res.status;
      if (res.ok) return { ok: true, httpStatus: res.status, attempts: attempt };
      lastErr = `http_${res.status}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "network_error";
    }
    if (attempt < maxAttempts) await sleep(200 * 2 ** (attempt - 1));
  }
  return { ok: false, httpStatus: lastStatus, errorCode: lastErr, attempts: maxAttempts };
}
