/**
 * ring-neighbors-worker.ts
 * Receives webhook pushes from Ring Neighbors Agency API.
 *
 * Setup required:
 * 1. Apply for Ring Neighbors Public Safety at ring.com/public-safety
 * 2. Configure webhook: POST /api/webhooks/ring-neighbors
 * 3. Store webhook secret in Secrets Manager:
 *    rapid-cortex/social/ring-neighbors-webhook-secret
 *    (ARN passed via RING_NEIGHBORS_WEBHOOK_SECRET_ARN)
 *
 * Ring sends JSON with title, description, location (geojson), category,
 * posted_at, and a sanitized URL. Response must return in <5s.
 *
 * Twitter/X is intentionally excluded from social ingestion.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { isFeaturesSuiteEnabled } from "../../feature-suite/tables.js";
import { ingestSocialSignal } from "../../feature-suite/training-predictive-safety.js";
import {
  distanceKm,
  resolveAgencySocialConfigs,
  type AgencySocialConfig,
} from "./agency-social-config.js";

const secrets = new SecretsManagerClient({});

type RingPayload = {
  title?: string;
  description?: string;
  body?: string;
  category?: string;
  posted_at?: string;
  url?: string;
  source_url?: string;
  agency_id?: string;
  agencyId?: string;
  location?: {
    type?: string;
    coordinates?: number[];
    lat?: number;
    lon?: number;
    longitude?: number;
    latitude?: number;
  };
};

function header(
  event: Parameters<APIGatewayProxyHandlerV2>[0],
  name: string,
): string | undefined {
  const headers = event.headers ?? {};
  const needle = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === needle && typeof v === "string") return v;
  }
  return undefined;
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function safeEqualUtf8(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

async function loadWebhookSecret(): Promise<string | undefined> {
  const arn = process.env.RING_NEIGHBORS_WEBHOOK_SECRET_ARN?.trim();
  const plain = process.env.RING_NEIGHBORS_WEBHOOK_SECRET?.trim();
  if (plain) return plain;
  if (!arn) return undefined;
  try {
    const res = await secrets.send(new GetSecretValueCommand({ SecretId: arn }));
    const raw = res.SecretString?.trim();
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as { webhookSecret?: string; secret?: string };
      return parsed.webhookSecret ?? parsed.secret ?? raw;
    } catch {
      return raw;
    }
  } catch (err) {
    console.warn("[ring-neighbors] secret load failed", err);
    return undefined;
  }
}

/**
 * Validate Ring signature. Accepts:
 * - X-Ring-Signature: hex HMAC-SHA256 of raw body
 * - X-Ring-Signature: sha256=<hex>
 * - Dev bypass when RING_NEIGHBORS_WEBHOOK_MOCK=1
 */
function validateSignature(
  rawBody: string,
  provided: string | undefined,
  secret: string,
): boolean {
  if (!provided) return false;
  const normalized = provided.replace(/^sha256=/i, "").trim();
  const expectedHex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  if (safeEqualHex(normalized.toLowerCase(), expectedHex.toLowerCase())) return true;
  // Some portals send the raw HMAC as base64 — compare utf8 digests of hex vs provided.
  const expectedB64 = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  return safeEqualUtf8(normalized, expectedB64);
}

function extractLatLon(payload: RingPayload): { lat: number; lon: number } | undefined {
  const loc = payload.location;
  if (!loc) return undefined;
  if (typeof loc.lat === "number" && typeof loc.lon === "number") {
    return { lat: loc.lat, lon: loc.lon };
  }
  if (typeof loc.latitude === "number" && typeof loc.longitude === "number") {
    return { lat: loc.latitude, lon: loc.longitude };
  }
  if (
    Array.isArray(loc.coordinates) &&
    loc.coordinates.length >= 2 &&
    typeof loc.coordinates[0] === "number" &&
    typeof loc.coordinates[1] === "number"
  ) {
    // GeoJSON: [lon, lat]
    return { lat: loc.coordinates[1], lon: loc.coordinates[0] };
  }
  return undefined;
}

function matchAgency(
  payload: RingPayload,
  configs: AgencySocialConfig[],
): AgencySocialConfig | undefined {
  const explicit = (payload.agencyId ?? payload.agency_id)?.trim();
  if (explicit) {
    return configs.find((c) => c.agencyId === explicit) ?? { agencyId: explicit, cityHints: [] };
  }
  const point = extractLatLon(payload);
  if (!point) {
    // No geo + no agencyId — fall back to single configured agency if only one.
    return configs.length === 1 ? configs[0] : undefined;
  }
  let best: { config: AgencySocialConfig; dist: number } | undefined;
  for (const config of configs) {
    if (typeof config.lat !== "number" || typeof config.lon !== "number") continue;
    const dist = distanceKm(point.lat, point.lon, config.lat, config.lon);
    const radius = config.radiusKm ?? 40;
    if (dist <= radius && (!best || dist < best.dist)) {
      best = { config, dist };
    }
  }
  return best?.config;
}

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const ringNeighborsWebhookHandler: APIGatewayProxyHandlerV2 = async (event) => {
  // Always aim for <5s — validate, ingest, return quickly.
  if (!isFeaturesSuiteEnabled()) {
    return json(503, { error: "features suite disabled" });
  }

  const mock = process.env.RING_NEIGHBORS_WEBHOOK_MOCK === "1" || process.env.RING_NEIGHBORS_WEBHOOK_MOCK === "true";
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64").toString("utf8")
    : (event.body ?? "");

  if (!mock) {
    const secret = await loadWebhookSecret();
    if (!secret) {
      return json(503, { error: "Ring webhook secret is not configured" });
    }
    const sig =
      header(event, "x-ring-signature") ??
      header(event, "x-ring-neighbors-signature") ??
      header(event, "x-hub-signature-256");
    if (!validateSignature(rawBody, sig, secret)) {
      return json(401, { error: "Invalid Ring webhook signature" });
    }
  }

  let payload: RingPayload;
  try {
    payload = JSON.parse(rawBody || "{}") as RingPayload;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const configs = resolveAgencySocialConfigs();
  const agency = matchAgency(payload, configs);
  if (!agency) {
    console.warn("[ring-neighbors] no matching agency for payload — acknowledging");
    return json(200, { received: true, ingested: false, reason: "no_matching_agency" });
  }

  const text = [payload.title, payload.description ?? payload.body, payload.category]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" — ")
    .slice(0, 8000);
  if (!text) {
    return json(200, { received: true, ingested: false, reason: "empty_payload" });
  }

  const point = extractLatLon(payload);
  const rawUrl = payload.url ?? payload.source_url;
  let sourceUrl: string | undefined;
  if (typeof rawUrl === "string" && rawUrl.trim()) {
    try {
      sourceUrl = new URL(rawUrl.trim()).toString();
    } catch {
      sourceUrl = undefined;
    }
  }

  try {
    const result = await ingestSocialSignal({
      agencyId: agency.agencyId,
      actorId: "system:ring-neighbors-webhook",
      source: "ring_neighbors",
      rawText: text,
      sourceUrl,
      location: point
        ? { lat: point.lat, lon: point.lon, address: payload.title }
        : undefined,
    });
    return json(200, {
      received: true,
      ingested: Boolean(result.signalId),
      signalId: result.signalId,
      confidence: result.confidence,
      agencyId: agency.agencyId,
    });
  } catch (err) {
    console.warn("[ring-neighbors] ingest failed — returning 200 to avoid retries storm", err);
    return json(200, { received: true, ingested: false, reason: "ingest_error" });
  }
};

/** Alias for SAM Handler naming flexibility. */
export const handler = ringNeighborsWebhookHandler;
