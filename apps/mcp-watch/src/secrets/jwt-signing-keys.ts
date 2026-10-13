import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { importPKCS8, importSPKI, type KeyLike } from "jose";

/**
 * Secret JSON shape for rotation:
 * {
 *   "activeKid": "2026-10",
 *   "keys": [
 *     { "kid": "2026-10", "privateKeyPem": "-----BEGIN PRIVATE KEY-----...", "publicKeyPem": "..." },
 *     { "kid": "2026-09", "privateKeyPem": "...", "publicKeyPem": "..." }
 *   ]
 * }
 */
export type JwtKeyMaterial = {
  kid: string;
  privateKey: KeyLike;
  publicKey: KeyLike;
};

type Cache = { activeKid: string; byKid: Map<string, JwtKeyMaterial>; expiresAt: number };
let cache: Cache | null = null;
const TTL_MS = 5 * 60 * 1000;
const client = new SecretsManagerClient({});

async function parseSecret(raw: string): Promise<{ activeKid: string; byKid: Map<string, JwtKeyMaterial> }> {
  const parsed = JSON.parse(raw) as {
    activeKid?: string;
    keys?: Array<{ kid: string; privateKeyPem: string; publicKeyPem: string }>;
  };
  if (!parsed.activeKid || !Array.isArray(parsed.keys) || parsed.keys.length === 0) {
    throw new Error("mcp_jwt_secret_invalid_shape");
  }
  const byKid = new Map<string, JwtKeyMaterial>();
  for (const k of parsed.keys) {
    byKid.set(k.kid, {
      kid: k.kid,
      privateKey: await importPKCS8(k.privateKeyPem, "RS256"),
      publicKey: await importSPKI(k.publicKeyPem, "RS256"),
    });
  }
  if (!byKid.has(parsed.activeKid)) throw new Error("mcp_jwt_active_kid_missing");
  return { activeKid: parsed.activeKid, byKid };
}

export async function loadJwtSigningKeys(secretArn: string): Promise<{
  active: JwtKeyMaterial;
  byKid: Map<string, JwtKeyMaterial>;
}> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return { active: cache.byKid.get(cache.activeKid)!, byKid: cache.byKid };
  }
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const raw = res.SecretString ?? "";
  if (!raw) throw new Error("mcp_jwt_secret_empty");
  const { activeKid, byKid } = await parseSecret(raw);
  cache = { activeKid, byKid, expiresAt: now + TTL_MS };
  return { active: byKid.get(activeKid)!, byKid };
}

export function clearJwtSigningKeyCache(): void {
  cache = null;
}
