import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";
import { env } from "../../lib/env.js";

async function hmacSecret(): Promise<string> {
  const secret = await resolvePlainOrSecretArn(
    env.campusAlertsPhoneHmacSecret,
    env.campusAlertsPhoneHmacSecretArn,
  );
  if (secret.length >= 16) return secret;
  // Local/CI fallback — never use unsalted SHA-256 alone for lookup digests.
  const fallback = await resolvePlainOrSecretArn(
    env.externalApiEncryptionKeyInline,
    env.externalApiEncryptionKeyArn,
  );
  if (fallback.length >= 16) return `casub-hmac:${fallback}`;
  if (process.env.NODE_ENV === "test" || env.deploymentStage === "staging") {
    return "campus-alerts-test-hmac-secret-do-not-use-prod";
  }
  throw new Error("CAMPUS_ALERTS_HMAC_NOT_CONFIGURED");
}

async function dataKey(): Promise<Buffer> {
  const plain = await resolvePlainOrSecretArn(
    env.campusAlertsPhoneEncSecret,
    env.campusAlertsPhoneEncSecretArn,
  );
  const passphrase =
    plain.length >= 16
      ? plain
      : (await resolvePlainOrSecretArn(
          env.externalApiEncryptionKeyInline,
          env.externalApiEncryptionKeyArn,
        )) ||
        (process.env.NODE_ENV === "test" || env.deploymentStage === "staging"
          ? "campus-alerts-test-enc-secret-do-not-use-prod"
          : "");
  if (!passphrase || passphrase.length < 16) {
    throw new Error("CAMPUS_ALERTS_ENCRYPTION_NOT_CONFIGURED");
  }
  return scryptSync(passphrase, "rc-casub-phone-v1", 32);
}

/** Tenant-scoped HMAC digest for phone lookup (not unsalted SHA-256). */
export async function campusAlertsPhoneLookupDigest(
  agencyId: string,
  phoneE164: string,
): Promise<string> {
  const secret = await hmacSecret();
  return createHmac("sha256", secret)
    .update(`${agencyId}|${phoneE164}`, "utf8")
    .digest("hex");
}

export async function encryptCampusAlertsPhone(phoneE164: string): Promise<string> {
  const key = await dataKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(phoneE164, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export async function decryptCampusAlertsPhone(stored: string): Promise<string> {
  const key = await dataKey();
  const buf = Buffer.from(stored, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function hashCampusAlertsOtp(code: string, challengeId: string, pepper: string): string {
  return createHash("sha256").update(`${code}:${challengeId}:${pepper}`, "utf8").digest("hex");
}

export async function otpPepper(): Promise<string> {
  return hmacSecret();
}

export function generateSixDigitOtp(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, "0");
}
