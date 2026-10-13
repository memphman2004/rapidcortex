import type { Express, Request, Response } from "express";
import { WRITE_SCOPE, type McpWatchConfig } from "../config.js";
import { auditLog } from "../security/audit.js";
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

/** ChatGPT MCP clients — public client_ids accepted for authorize/token. */
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

/** Short-lived in-process bridge from /authorize → Cognito callback (keyed by state). */
const pendingLogins = new Map<string, PendingLogin>();

function prunePending(): void {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of pendingLogins) {
    if (v.createdAt < cutoff) pendingLogins.delete(k);
  }
}

function jsonError(res: Response, status: number, error: string, description?: string): void {
  res.status(status).json({ error, error_description: description ?? error });
}

export function registerOAuthRoutes(app: Express, config: McpWatchConfig): void {
  const issuer = config.mcpIssuer;

  app.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.json({
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
  });

  app.get("/.well-known/openid-configuration", (_req, res) => {
    res.json({
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: [WRITE_SCOPE, "openid"],
    });
  });

  app.get("/.well-known/jwks.json", async (_req, res) => {
    try {
      const { loadJwtSigningKeys } = await import("../secrets/jwt-signing-keys.js");
      const { exportJWK } = await import("jose");
      const { byKid } = await loadJwtSigningKeys(config.mcpJwtSigningSecretArn);
      const keys = [];
      for (const material of byKid.values()) {
        const jwk = await exportJWK(material.publicKey);
        keys.push({ ...jwk, kid: material.kid, use: "sig", alg: "RS256" });
      }
      res.json({ keys });
    } catch (err) {
      auditLog({
        event: "jwks_error",
        errorCode: err instanceof Error ? err.message : "jwks_failed",
      });
      res.status(503).json({ error: "jwks_unavailable" });
    }
  });

  /** Dynamic client registration (public clients; ChatGPT MCP). */
  app.post("/oauth/register", (req, res) => {
    const body = (req.body ?? {}) as {
      client_name?: string;
      redirect_uris?: string[];
      token_endpoint_auth_method?: string;
    };
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
    if (redirectUris.length === 0) {
      return jsonError(res, 400, "invalid_client_metadata", "redirect_uris required");
    }
    const clientId = `dyn_${newOpaqueToken().slice(0, 16)}`;
    PUBLIC_CLIENT_IDS.add(clientId);
    res.status(201).json({
      client_id: clientId,
      client_name: body.client_name ?? "mcp-client",
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    });
  });

  app.get("/oauth/authorize", (req, res) => {
    prunePending();
    const clientId = String(req.query.client_id ?? "");
    const redirectUri = String(req.query.redirect_uri ?? "");
    const state = String(req.query.state ?? "");
    const codeChallenge = String(req.query.code_challenge ?? "");
    const method = String(req.query.code_challenge_method ?? "");
    const scope = String(req.query.scope ?? WRITE_SCOPE);
    const responseType = String(req.query.response_type ?? "");

    if (responseType !== "code") return jsonError(res, 400, "unsupported_response_type");
    const clientOk = PUBLIC_CLIENT_IDS.has(clientId) || clientId.startsWith("dyn_");
    if (!clientId || !clientOk) {
      return jsonError(res, 400, "invalid_client");
    }
    if (!redirectUri || !state || !codeChallenge) {
      return jsonError(res, 400, "invalid_request", "missing PKCE or redirect params");
    }
    if (method !== "S256") return jsonError(res, 400, "invalid_request", "S256 required");
    if (!scope.split(/\s+/).includes(WRITE_SCOPE)) {
      return jsonError(res, 400, "invalid_scope", `${WRITE_SCOPE} required`);
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
    const url = cognitoAuthorizeUrl(config, {
      state: loginState,
      redirectUri: cognitoCallback,
    });
    res.redirect(302, url);
  });

  app.get("/oauth/cognito/callback", async (req, res) => {
    prunePending();
    const loginState = String(req.query.state ?? "");
    const code = String(req.query.code ?? "");
    const pending = pendingLogins.get(loginState);
    pendingLogins.delete(loginState);
    if (!pending || !code) {
      return jsonError(res, 400, "invalid_request", "login session expired");
    }

    const cognitoCallback = `${issuer}/oauth/cognito/callback`;
    const tokens = await exchangeCognitoCode(config, { code, redirectUri: cognitoCallback });
    if (!tokens?.id_token) {
      return jsonError(res, 400, "access_denied", "cognito token exchange failed");
    }
    const identity = await verifyCognitoIdToken(tokens.id_token, config);
    if (!identity) {
      return jsonError(res, 403, "access_denied", "role not permitted for watch:write");
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
    res.redirect(302, redirect.toString());
  });

  app.post("/oauth/token", async (req: Request, res: Response) => {
    const body =
      typeof req.body === "object" && req.body && !Array.isArray(req.body)
        ? (req.body as Record<string, string>)
        : Object.fromEntries(new URLSearchParams(String(req.body ?? "")));

    const grantType = body.grant_type;
    const clientId = body.client_id ?? "";

    if (grantType === "authorization_code") {
      const code = body.code ?? "";
      const redirectUri = body.redirect_uri ?? "";
      const verifier = body.code_verifier ?? "";
      const record = await consumeAuthCode(config.oauthStateTableName, code);
      if (!record) return jsonError(res, 400, "invalid_grant", "code invalid or expired");
      if (record.clientId !== clientId) return jsonError(res, 400, "invalid_client");
      if (record.redirectUri !== redirectUri) {
        return jsonError(res, 400, "invalid_grant", "redirect_uri mismatch");
      }
      if (!verifyS256CodeChallenge(verifier, record.codeChallenge)) {
        return jsonError(res, 400, "invalid_grant", "pkce verification failed");
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
      return res.json({
        access_token: access.accessToken,
        token_type: "Bearer",
        expires_in: access.expiresIn,
        refresh_token: refresh,
        scope: access.scope,
      });
    }

    if (grantType === "refresh_token") {
      const refresh = body.refresh_token ?? "";
      const record = await getRefreshToken(config.oauthStateTableName, refresh);
      if (!record) return jsonError(res, 400, "invalid_grant");
      if (record.clientId !== clientId) return jsonError(res, 400, "invalid_client");

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

      return res.json({
        access_token: access.accessToken,
        token_type: "Bearer",
        expires_in: access.expiresIn,
        refresh_token: nextRefresh,
        scope: access.scope,
      });
    }

    return jsonError(res, 400, "unsupported_grant_type");
  });
}
