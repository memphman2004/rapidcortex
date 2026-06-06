import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { env } from "./env.js";

let derivedKeyMemo: Buffer | null = null;
let derivationPromise: Promise<Buffer> | null = null;

async function deriveWebhookDataKey(): Promise<Buffer> {
  if (derivedKeyMemo) return derivedKeyMemo;
  derivationPromise ??= (async () => {
    let passphrase = env.externalApiEncryptionKeyInline.trim();
    const arn = env.externalApiEncryptionKeyArn.trim();
    if ((!passphrase || passphrase.length < 16) && arn) {
      const sm = new SecretsManagerClient({});
      const out = await sm.send(new GetSecretValueCommand({ SecretId: arn }));
      passphrase = String(out.SecretString ?? "").trim();
    }
    if (!passphrase || passphrase.length < 16) {
      throw new Error("WEBHOOK_ENCRYPTION_NOT_CONFIGURED");
    }
    const key = scryptSync(passphrase, "rc-whsec-v2", 32);
    derivedKeyMemo = key;
    return key;
  })();
  return derivationPromise;
}

/** Encrypt outbound webhook HMAC secrets for DynamoDB-at-rest confidentiality. */
export async function encryptWebhookSigningSecret(plain: string): Promise<string> {
  const dk = await deriveWebhookDataKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dk, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export async function decryptWebhookSigningSecret(stored: string): Promise<string> {
  const dk = await deriveWebhookDataKey();
  const buf = Buffer.from(stored, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", dk, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
