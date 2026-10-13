import { createRemoteJWKSet, jwtVerify } from "jose";
import type { McpWatchConfig } from "../config.js";
import { ALLOWED_WRITE_ROLES } from "../config.js";

export type CognitoIdentity = {
  subject: string;
  role: string;
  email?: string;
};

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksIssuer: string | null = null;

function cognitoIssuer(config: McpWatchConfig): string {
  return `https://cognito-idp.${config.cognitoRegion}.amazonaws.com/${config.cognitoUserPoolId}`;
}

function getJwks(config: McpWatchConfig) {
  const issuer = cognitoIssuer(config);
  if (!jwksCache || jwksIssuer !== issuer) {
    jwksCache = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    jwksIssuer = issuer;
  }
  return jwksCache;
}

function extractRole(payload: Record<string, unknown>): string {
  const custom = payload["custom:role"];
  if (typeof custom === "string" && custom.trim()) return custom.trim();
  const groups = payload["cognito:groups"];
  if (Array.isArray(groups)) {
    for (const g of groups) {
      const role = String(g).trim();
      if (ALLOWED_WRITE_ROLES.has(role)) return role;
    }
  }
  return "";
}

/** Verify Cognito ID token from Hosted UI code exchange. */
export async function verifyCognitoIdToken(
  idToken: string,
  config: McpWatchConfig,
): Promise<CognitoIdentity | null> {
  try {
    const { payload } = await jwtVerify(idToken, getJwks(config), {
      issuer: cognitoIssuer(config),
      audience: config.cognitoClientId,
      clockTolerance: 30,
    });
    const role = extractRole(payload as Record<string, unknown>);
    if (!ALLOWED_WRITE_ROLES.has(role)) return null;
    const subject = String(payload.sub ?? "").trim();
    if (!subject) return null;
    return {
      subject,
      role,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}

export function cognitoAuthorizeUrl(
  config: McpWatchConfig,
  opts: { state: string; redirectUri: string },
): string {
  const domain = config.cognitoDomain.replace(/\/$/, "");
  const u = new URL(`${domain}/oauth2/authorize`);
  u.searchParams.set("client_id", config.cognitoClientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("state", opts.state);
  return u.toString();
}

export async function exchangeCognitoCode(
  config: McpWatchConfig,
  opts: { code: string; redirectUri: string },
): Promise<{ id_token?: string; access_token?: string } | null> {
  const domain = config.cognitoDomain.replace(/\/$/, "");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.cognitoClientId,
    code: opts.code,
    redirect_uri: opts.redirectUri,
  });
  const res = await fetch(`${domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  return (await res.json()) as { id_token?: string; access_token?: string };
}
