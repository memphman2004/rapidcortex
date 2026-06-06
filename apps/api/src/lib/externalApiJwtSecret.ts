import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { env } from "./env.js";

let cachedSigningKeyBytes: Uint8Array | null = null;
let loadPromise: Promise<Uint8Array> | null = null;

async function loadSigningKey(): Promise<Uint8Array> {
  if (env.externalApiJwtSecretArn.trim()) {
    const sm = new SecretsManagerClient({});
    const out = await sm.send(new GetSecretValueCommand({ SecretId: env.externalApiJwtSecretArn.trim() }));
    const secretString = out.SecretString?.trim() ?? "";
    if (!secretString || secretString.length < 32) throw new Error("EXTERNAL_API_JWT_SECRET_INVALID");
    return new TextEncoder().encode(secretString);
  }
  const inline = env.externalApiJwtSecretInline.trim();
  if (!inline || inline.length < 32) {
    throw new Error("EXTERNAL_API_JWT_SECRET_NOT_CONFIGURED");
  }
  return new TextEncoder().encode(inline);
}

/** HS256 signing key bytes for `/api/v1` access tokens (cached). */
export function getExternalApiJwtSigningKey(): Promise<Uint8Array> {
  if (cachedSigningKeyBytes) return Promise.resolve(cachedSigningKeyBytes);
  loadPromise ??= loadSigningKey().then((k) => {
    cachedSigningKeyBytes = k;
    return k;
  });
  return loadPromise;
}
