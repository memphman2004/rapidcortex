import { jwtVerify, type JWTPayload } from "jose";
import {
  ALLOWED_WRITE_ROLES,
  WRITE_SCOPE,
  type McpWatchConfig,
} from "../config.js";
import { loadJwtSigningKeys } from "../secrets/jwt-signing-keys.js";

export type AuthPrincipal = {
  subject: string;
  role: string;
  email?: string;
  scopes: string[];
  tokenId?: string;
};

export type AuthResult =
  | { ok: true; principal: AuthPrincipal }
  | { ok: false; reason: string; status: 401 | 403 };

function scopesFromPayload(payload: JWTPayload): string[] {
  const scope = payload.scope;
  if (typeof scope === "string") return scope.split(/\s+/).filter(Boolean);
  const scp = payload.scp;
  if (Array.isArray(scp)) return scp.map(String);
  return [];
}

/**
 * Full MCP access-token verification: signature (active + rotated keys),
 * issuer, audience, expiration, write scope, and permitted Cognito roles.
 */
export async function authorizeWriteRequest(
  authorizationHeader: string | undefined,
  config: McpWatchConfig,
): Promise<AuthResult> {
  if (!authorizationHeader?.toLowerCase().startsWith("bearer ")) {
    return { ok: false, reason: "missing_bearer", status: 401 };
  }
  const token = authorizationHeader.slice(7).trim();
  if (!token) return { ok: false, reason: "empty_token", status: 401 };

  const { byKid } = await loadJwtSigningKeys(config.mcpJwtSigningSecretArn);

  let payload: JWTPayload | null = null;
  let lastErr: unknown;
  for (const material of byKid.values()) {
    try {
      const verified = await jwtVerify(token, material.publicKey, {
        issuer: config.mcpIssuer,
        audience: config.mcpAudience,
        algorithms: ["RS256"],
        clockTolerance: 30,
      });
      payload = verified.payload;
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (!payload) {
    return {
      ok: false,
      reason: lastErr instanceof Error ? `invalid_token:${lastErr.message}` : "invalid_token",
      status: 401,
    };
  }

  const scopes = scopesFromPayload(payload);
  if (!scopes.includes(WRITE_SCOPE)) {
    return { ok: false, reason: "missing_watch_write_scope", status: 403 };
  }

  const role = String(payload.role ?? "").trim();
  if (!ALLOWED_WRITE_ROLES.has(role)) {
    return { ok: false, reason: "role_not_permitted", status: 403 };
  }

  const subject = String(payload.sub ?? "").trim();
  if (!subject) return { ok: false, reason: "missing_subject", status: 401 };

  return {
    ok: true,
    principal: {
      subject,
      role,
      email: typeof payload.email === "string" ? payload.email : undefined,
      scopes,
      tokenId: typeof payload.jti === "string" ? payload.jti : undefined,
    },
  };
}
