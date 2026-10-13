import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import type { McpWatchConfig } from "../config.js";
import { WRITE_SCOPE } from "../config.js";
import { loadJwtSigningKeys } from "../secrets/jwt-signing-keys.js";

const ACCESS_TTL_SEC = 3600;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type TokenSubject = {
  subject: string;
  role: string;
  email?: string;
  scope?: string;
};

export async function mintAccessToken(
  config: McpWatchConfig,
  subject: TokenSubject,
): Promise<{ accessToken: string; expiresIn: number; scope: string }> {
  const { active } = await loadJwtSigningKeys(config.mcpJwtSigningSecretArn);
  const scope = subject.scope ?? WRITE_SCOPE;
  const accessToken = await new SignJWT({
    role: subject.role,
    email: subject.email,
    scope,
  })
    .setProtectedHeader({ alg: "RS256", kid: active.kid, typ: "JWT" })
    .setSubject(subject.subject)
    .setIssuer(config.mcpIssuer)
    .setAudience(config.mcpAudience)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .setJti(randomUUID())
    .sign(active.privateKey);

  return { accessToken, expiresIn: ACCESS_TTL_SEC, scope };
}

export function refreshTtlMs(): number {
  return REFRESH_TTL_MS;
}
