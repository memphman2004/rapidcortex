import { createHmac, timingSafeEqual } from "node:crypto";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const CACHE_TTL_MS = 5 * 60 * 1000;

export interface RingCredentials {
  clientId: string;
  clientSecret: string;
  hmacKey: string;
}

let cachedCredentials: RingCredentials | undefined;
let cacheExpiry = 0;

function secretsManager(): SecretsManagerClient {
  return new SecretsManagerClient({});
}

export function resolveRingCredentialsSecretArn(): string {
  const arn =
    process.env.RING_CREDENTIALS_SECRET_ARN?.trim() ||
    process.env.RING_PARTNER_TOKEN_SECRET_ARN?.trim() ||
    "";
  return arn;
}

export function clearRingCredentialsCache(): void {
  cachedCredentials = undefined;
  cacheExpiry = 0;
}

export async function getRingCredentials(): Promise<RingCredentials> {
  if (cachedCredentials && Date.now() < cacheExpiry) {
    return cachedCredentials;
  }

  const secretArn = resolveRingCredentialsSecretArn();
  if (!secretArn) {
    throw new Error("RING_CREDENTIALS_SECRET_ARN is not configured");
  }

  const result = await secretsManager().send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );

  if (!result.SecretString) {
    throw new Error("Ring credentials secret has no SecretString");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.SecretString);
  } catch {
    throw new Error("Ring credentials secret is not valid JSON");
  }

  const record = parsed as Record<string, unknown>;
  const clientId = String(record.clientId ?? "").trim();
  const clientSecret = String(record.clientSecret ?? "").trim();
  const hmacKey = String(record.hmacKey ?? "").trim();

  if (!clientId || !clientSecret || !hmacKey) {
    throw new Error("Ring credentials secret is missing clientId, clientSecret, or hmacKey");
  }

  cachedCredentials = { clientId, clientSecret, hmacKey };
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return cachedCredentials;
}

/** HMAC verification for inbound Ring webhook payloads. */
export async function verifyRingWebhookSignature(
  payload: string,
  signatureHeader: string,
): Promise<boolean> {
  const { hmacKey } = await getRingCredentials();
  const expected = createHmac("sha256", hmacKey).update(payload).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();

  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}

export class RingAdapter {
  getCredentials(): Promise<RingCredentials> {
    return getRingCredentials();
  }

  verifyWebhookSignature(payload: string, signatureHeader: string): Promise<boolean> {
    return verifyRingWebhookSignature(payload, signatureHeader);
  }
}
