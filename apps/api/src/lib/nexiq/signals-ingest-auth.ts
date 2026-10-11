/**
 * API key auth for Claude scheduled-task → NexiQ Signals ingest (Secrets Manager ARN).
 * Headers: x-nexcort-signals-key | x-api-key | Authorization: Bearer <key>
 * Used as the non-SigV4 path (Claude cloud cannot natively sign AWS_IAM).
 */

import { timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function extractNexiqSignalsApiKey(event: APIGatewayProxyEventV2): string {
  const headers = event.headers ?? {};
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === "string") lower[k.toLowerCase()] = v;
  }
  const dedicated = lower["x-nexcort-signals-key"]?.trim();
  if (dedicated) return dedicated;
  const xApiKey = lower["x-api-key"]?.trim();
  if (xApiKey) return xApiKey;
  const auth = lower.authorization?.trim() ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

export async function assertNexiqSignalsApiKey(
  event: APIGatewayProxyEventV2,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const presented = extractNexiqSignalsApiKey(event);
  if (!presented) return { ok: false, reason: "missing_api_key" };

  const arn = process.env.NEXIQ_SIGNALS_INGEST_API_KEY_SECRET_ARN?.trim() ?? "";
  const inline = process.env.NEXIQ_SIGNALS_INGEST_API_KEY?.trim() ?? "";

  let expected = "";
  if (arn) {
    try {
      expected = (
        await resolvePlainOrSecretArn(undefined, arn, { preferredField: "apiKey" })
      ).trim();
    } catch {
      return { ok: false, reason: "secret_unavailable" };
    }
  } else if (inline) {
    expected = inline;
  } else {
    return { ok: false, reason: "ingest_not_configured" };
  }

  if (!expected || !safeEqual(presented, expected)) {
    return { ok: false, reason: "invalid_api_key" };
  }
  return { ok: true };
}
