import { WRITE_SCOPE, type McpWatchConfig } from "../config.js";
import { auditLog } from "../security/audit.js";
import {
  jsonResult,
  redirectResult,
  type LambdaHttpResult,
} from "../http/lambda-http.js";
import {
  cognitoAuthorizeUrl,
  exchangeCognitoCode,
  verifyCognitoIdToken,
} from "./cognito.js";
import { verifyS256CodeChallenge } from "./pkce.js";
import {
  consumeAuthCode,
  deleteRefreshToken,
  getRefreshToken,
  hashToken,
  newAuthCode,
  newOpaqueToken,
  putAuthCode,
  putRefreshToken,
} from "./store.js";
import { mintAccessToken, refreshTtlMs } from "./tokens.js";

const PUBLIC_CLIENT_IDS = new Set(["chatgpt", "nexcort-mcp-watch", "openai-mcp"]);

type PendingLogin = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  scope: string;
  state: string;
  createdAt: number;
};

const pendingLogins = new Map<string, PendingLogin>();

function prunePending(): void {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of pendingLogins) {
    if (v.createdAt < cutoff) pendingLogins.delete(k);
  }
}

function oauthError(status: number, error: string, description?: string): LambdaHttpResult {
  return jsonResult(status, { error, error_description: description ?? error });
}

export async function handleOAuthRoute(
  config: McpWatchConfig,
  opts: {
    method: string;
    path: string;
    query: URLSearchParams;
    body: unknown;
  },
): Promise<LambdaHttpResult | null> {
  const issuer = config.mcpIssuer;
  const { method, path, query, body } = opts;

  if (method === "GET" && path === "/.well-known/oauth-authorization-server") {
    return jsonResult(200, {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      registration_endpoint: `${issuer}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [WRITE_SCOPE, "openid"],
      subject_types_supported: ["public"],
    });
  }

  if (method === "GET" && path === "/.well-known/openid-configuration") {
    return jsonResult(200, {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: [WRITE_SCOPE, "openid"],
    });
  }

  if (method === "GET" && path === "/.well-known/jwks.json") {
    try {
      const { loadJwtSigningKeys } = await import("../secrets/jwt-signing-keys.js");
      const { exportJWK } = await import("jose");
      const { byKid } = await loadJwtSigningKeys(config.mcpJwtSigningSecretArn);
      const keys = [];
      for (const material of byKid.values()) {
        const jwk = await exportJWK(material.publicKey);
        keys.push({ ...jwk, kid: material.kid, use: "sig", alg: "RS256" });
      }
      return jsonResult(200, { keys });
    } catch (err) {
      auditLog({
        event: "jwks_error",
        errorCode: err instanceof Error ? err.message : "jwks_failed",
      });
      return jsonResult(503, { error: "jwks_unavailable" });
    }
  }

  if (method === "POST" && path === "/oauth/register") {
    const b = (body ?? {}) as { client_name?: string; redirect_uris?: string[] };
    const redirectUris = Array.isArray(b.redirect_uris) ? b.redirect_uris : [];
    if (redirectUris.length === 0) {
      return oauthError(400, "invalid_client_metadata", "redirect_uris required");
    }
    const clientId = `dyn_${newOpaqueToken().slice(0, 16)}`;
    PUBLIC_CLIENT_IDS.add(clientId);
    return jsonResult(201, {
      client_id: clientId,
      client_name: b.client_name ?? "mcp-client",
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    });
  }

  if (method === "GET" && path === "/oauth/authorize") {
    prunePending();
    const clientId = String(query.get("client_id") ?? "");
    const redirectUri = String(query.get("redirect_uri") ?? "");
    const state = String(query.get("state") ?? "");
    const codeChallenge = String(query.get("code_challenge") ?? "");
    const codeChallengeMethod = String(query.get("code_challenge_method") ?? "");
    const scope = String(query.get("scope") ?? WRITE_SCOPE);
    const responseType = String(query.get("response_type") ?? "");

    if (responseType !== "code") return oauthError(400, "unsupported_response_type");
    const clientOk = PUBLIC_CLIENT_IDS.has(clientId) || clientId.startsWith("dyn_");
    if (!clientId || !clientOk) return oauthError(400, "invalid_client");
    if (!redirectUri || !state || !codeChallenge) {
      return oauthError(400, "invalid_request", "missing PKCE or redirect params");
    }
    if (codeChallengeMethod !== "S256") {
      return oauthError(400, "invalid_request", "S256 required");
    }
    if (!scope.split(/\s+/).includes(WRITE_SCOPE)) {
      return oauthError(400, "invalid_scope", `${WRITE_SCOPE} required`);
    }

    const loginState = newOpaqueToken();
    pendingLogins.set(loginState, {
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod: "S256",
      scope: WRITE_SCOPE,
      state,
      createdAt: Date.now(),
    });
    const cognitoCallback = `${issuer}/oauth/cognito/callback`;
    return redirectResult(
      cognitoAuthorizeUrl(config, { state: loginState, redirectUri: cognitoCallback }),
    );
  }

  if (method === "GET" && path === "/oauth/cognito/callback") {
    prunePending();
    const loginState = String(query.get("state") ?? "");
    const code = String(query.get("code") ?? "");
    const pending = pendingLogins.get(loginState);
    pendingLogins.delete(loginState);
    if (!pending || !code) {
      return oauthError(400, "invalid_request", "login session expired");
    }
    const cognitoCallback = `${issuer}/oauth/cognito/callback`;
    const tokens = await exchangeCognitoCode(config, { code, redirectUri: cognitoCallback });
    if (!tokens?.id_token) {
      return oauthError(400, "access_denied", "cognito token exchange failed");
    }
    const identity = await verifyCognitoIdToken(tokens.id_token, config);
    if (!identity) {
      return oauthError(403, "access_denied", "role not permitted for watch:write");
    }
    const authCode = newAuthCode();
    await putAuthCode(config.oauthStateTableName, {
      code: authCode,
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      codeChallengeMethod: "S256",
      scope: pending.scope,
      subject: identity.subject,
      role: identity.role,
      email: identity.email,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    const redirect = new URL(pending.redirectUri);
    redirect.searchParams.set("code", authCode);
    redirect.searchParams.set("state", pending.state);
    auditLog({ event: "oauth_authorize_ok", subject: identity.subject, role: identity.role });
    return redirectResult(redirect.toString());
  }

  if (method === "POST" && path === "/oauth/token") {
    const b =
      typeof body === "object" && body && !Array.isArray(body)
        ? (body as Record<string, string>)
        : {};
    const grantType = b.grant_type;
    const clientId = b.client_id ?? "";

    if (grantType === "authorization_code") {
      const record = await consumeAuthCode(config.oauthStateTableName, b.code ?? "");
      if (!record) return oauthError(400, "invalid_grant", "code invalid or expired");
      if (record.clientId !== clientId) return oauthError(400, "invalid_client");
      if (record.redirectUri !== (b.redirect_uri ?? "")) {
        return oauthError(400, "invalid_grant", "redirect_uri mismatch");
      }
      if (!verifyS256CodeChallenge(b.code_verifier ?? "", record.codeChallenge)) {
        return oauthError(400, "invalid_grant", "pkce verification failed");
      }
      const access = await mintAccessToken(config, {
        subject: record.subject,
        role: record.role,
        email: record.email,
        scope: record.scope,
      });
      const refresh = newOpaqueToken();
      await putRefreshToken(config.oauthStateTableName, {
        tokenHash: hashToken(refresh),
        clientId,
        subject: record.subject,
        role: record.role,
        email: record.email,
        scope: record.scope,
        expiresAt: Date.now() + refreshTtlMs(),
      });
      auditLog({ event: "oauth_token_issued", subject: record.subject, role: record.role });
      return jsonResult(200, {
        access_token: access.accessToken,
        token_type: "Bearer",
        expires_in: access.expiresIn,
        refresh_token: refresh,
        scope: access.scope,
      });
    }

    if (grantType === "refresh_token") {
      const refresh = b.refresh_token ?? "";
      const record = await getRefreshToken(config.oauthStateTableName, refresh);
      if (!record) return oauthError(400, "invalid_grant");
      if (record.clientId !== clientId) return oauthError(400, "invalid_client");
      await deleteRefreshToken(config.oauthStateTableName, refresh);
      const access = await mintAccessToken(config, {
        subject: record.subject,
        role: record.role,
        email: record.email,
        scope: record.scope,
      });
      const nextRefresh = newOpaqueToken();
      await putRefreshToken(config.oauthStateTableName, {
        tokenHash: hashToken(nextRefresh),
        clientId,
        subject: record.subject,
        role: record.role,
        email: record.email,
        scope: record.scope,
        expiresAt: Date.now() + refreshTtlMs(),
      });
      return jsonResult(200, {
        access_token: access.accessToken,
        token_type: "Bearer",
        expires_in: access.expiresIn,
        refresh_token: nextRefresh,
        scope: access.scope,
      });
    }

    return oauthError(400, "unsupported_grant_type");
  }

  return null;
}
