/**
 * API key auth for ChatGPT Watch ingest (Secrets Manager ARN).
 * Header: x-nexcort-watch-key or Authorization: Bearer <key>
 */

import { timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { resolvePlainOrSecretArn } from "../../runtimeSecrets.js";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function extractWatchIngestApiKey(event: APIGatewayProxyEventV2): string {
  const headers = event.headers ?? {};
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === "string") lower[k.toLowerCase()] = v;
  }
  const dedicated = lower["x-nexcort-watch-key"]?.trim();
  if (dedicated) return dedicated;
  const auth = lower.authorization?.trim() ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

export async function assertWatchIngestApiKey(
  event: APIGatewayProxyEventV2,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const presented = extractWatchIngestApiKey(event);
  if (!presented) return { ok: false, reason: "missing_api_key" };

  const arn = process.env.RAPID_IQ_WATCH_INGEST_API_KEY_SECRET_ARN?.trim() ?? "";
  const inline = process.env.RAPID_IQ_WATCH_INGEST_API_KEY?.trim() ?? "";

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
