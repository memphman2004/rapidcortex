import { randomBytes, timingSafeEqual } from "node:crypto";
import type { RingCitizenOAuthState, RingOAuthState, RingOAuthTokens } from "./ring-types.js";
import { RingAuthError, RingTokenExpiredError } from "./ring-errors.js";
import { getRingCredentials } from "./ring-credentials.js";
import { RING_CITIZEN_REDIRECT_URI, RING_REDIRECT_URI } from "./ring-env.js";
import { RingTokenStore } from "./ring-token-store.js";

const RING_AUTHORIZE_URL = "https://oauth.ring.com/oauth/authorize";
const RING_TOKEN_URL = "https://oauth.ring.com/oauth/token";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLen), "base64").toString("utf8");
}

function statesMatch(incomingState: string, storedState: string): boolean {
  const a = Buffer.from(incomingState);
  const b = Buffer.from(storedState);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Decode base64url OAuth state from login redirect (callback handler). */
export function decodeRingOAuthState(encoded: string): RingOAuthState {
  return parseOAuthState(encoded);
}

/** Custom schemes Ring Appstore / Alexa use to complete OAuth in the native app. */
const RING_APPSTORE_RETURN_PROTOCOLS = new Set(["ring:", "amazonstores:", "alexa:"]);
const RING_RETURN_URL_MAX_LENGTH = 2048;

/**
 * Allow Ring-owned HTTPS return URLs and native Appstore callback schemes.
 * Rejecting `ring://` here drops `ringReturnUrl` from OAuth state, so callback
 * never redirects back to Ring and the Appstore stays on "Sign In".
 */
export function normalizeRingReturnUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.length > RING_RETURN_URL_MAX_LENGTH) return null;
  try {
    const url = new URL(trimmed);
    const protocol = url.protocol.toLowerCase();
    if (RING_APPSTORE_RETURN_PROTOCOLS.has(protocol)) {
      return trimmed;
    }
    if (protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host !== "ring.com" && !host.endsWith(".ring.com")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function parseOAuthState(encoded: string): RingOAuthState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(encoded));
  } catch {
    throw new RingAuthError("Ring OAuth state is not valid");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new RingAuthError("Ring OAuth state is not valid");
  }
  const record = parsed as Record<string, unknown>;
  const agencyId = String(record.agencyId ?? "");
  const userId = String(record.userId ?? "");
  const nonce = String(record.nonce ?? "");
  const createdAt = Number(record.createdAt);
  if (!agencyId || !userId || !nonce || !Number.isFinite(createdAt)) {
    throw new RingAuthError("Ring OAuth state is missing required fields");
  }
  const ringReturnUrl =
    record.ringReturnUrl == null
      ? null
      : normalizeRingReturnUrl(String(record.ringReturnUrl));
  const usStateRaw = record.usState == null ? null : String(record.usState).trim().toUpperCase();
  const usState = usStateRaw && usStateRaw.length === 2 ? usStateRaw : null;
  return { agencyId, userId, nonce, createdAt, ringReturnUrl, usState };
}

function assertCitizenStateFresh(createdAt: number): void {
  if (Date.now() - createdAt > STATE_MAX_AGE_MS) {
    throw new RingAuthError("Ring OAuth state expired");
  }
}

type RingTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

function mapTokenResponse(body: RingTokenResponse): RingOAuthTokens {
  const accessToken = String(body.access_token ?? "");
  const refreshToken = String(body.refresh_token ?? "");
  const expiresIn = Number(body.expires_in ?? 0);
  const scope = String(body.scope ?? "client");
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new RingAuthError("Ring token response is missing access_token or expires_in");
  }
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    scope,
  };
}

export class RingOAuthService {
  constructor(private readonly tokenStore: RingTokenStore = new RingTokenStore()) {}

  async buildAuthorizationUrl(
    agencyId: string,
    userId: string,
    ringReturnUrl?: string | null,
    usState?: string | null,
  ): Promise<{ url: string; state: string }> {
    const { clientId } = await getRingCredentials();
    const normalizedState = usState?.trim().toUpperCase() || null;
    const statePayload: RingOAuthState = {
      agencyId,
      userId,
      nonce: randomBytes(32).toString("hex"),
      createdAt: Date.now(),
      ringReturnUrl: normalizeRingReturnUrl(ringReturnUrl),
      ...(normalizedState ? { usState: normalizedState } : {}),
    };
    const state = toBase64Url(JSON.stringify(statePayload));
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: RING_REDIRECT_URI,
      response_type: "code",
      scope: "client",
      state,
    });
    return {
      url: `${RING_AUTHORIZE_URL}?${params.toString()}`,
      state,
    };
  }

  async buildCitizenAuthorizationUrl(agencyId: string): Promise<{ url: string; state: string }> {
    const { clientId } = await getRingCredentials();
    const statePayload: RingCitizenOAuthState = {
      agencyId,
      nonce: randomBytes(32).toString("hex"),
      createdAt: Date.now(),
      flow: "citizen",
    };
    const state = toBase64Url(JSON.stringify(statePayload));
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: RING_CITIZEN_REDIRECT_URI,
      response_type: "code",
      scope: "client",
      state,
    });
    return {
      url: `${RING_AUTHORIZE_URL}?${params.toString()}`,
      state,
    };
  }

  async exchangeCode(
    code: string,
    incomingState: string,
    storedState: string,
  ): Promise<RingOAuthTokens> {
    if (!statesMatch(incomingState, storedState)) {
      throw new RingAuthError("Ring OAuth state mismatch");
    }

    const state = parseOAuthState(incomingState);
    if (Date.now() - state.createdAt > STATE_MAX_AGE_MS) {
      throw new RingAuthError("Ring OAuth state expired");
    }

    const { clientId, clientSecret } = await getRingCredentials();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: RING_REDIRECT_URI,
      client_id: clientId,
      client_secret: clientSecret,
    });

    return this.postTokenEndpoint(body);
  }

  async exchangeCitizenCode(
    code: string,
    incomingState: string,
    storedState: string,
    createdAt: number,
  ): Promise<RingOAuthTokens> {
    if (!statesMatch(incomingState, storedState)) {
      throw new RingAuthError("Ring OAuth state mismatch");
    }
    assertCitizenStateFresh(createdAt);

    const { clientId, clientSecret } = await getRingCredentials();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: RING_CITIZEN_REDIRECT_URI,
      client_id: clientId,
      client_secret: clientSecret,
    });

    return this.postTokenEndpoint(body);
  }

  /**
   * Appstore Token Exchange URL — Ring POSTs `code` (no OAuth state / redirect_uri).
   * Must complete within ~60 seconds of Ring issuing the code.
   */
  async exchangeAppstoreCode(code: string): Promise<RingOAuthTokens> {
    const trimmed = code.trim();
    if (!trimmed) {
      throw new RingAuthError("Ring Appstore authorization code is missing");
    }
    const { clientId, clientSecret } = await getRingCredentials();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: trimmed,
      client_id: clientId,
      client_secret: clientSecret,
    });
    return this.postTokenEndpoint(body);
  }

  async refreshTokens(secretKey: string): Promise<RingOAuthTokens> {
    const current = await this.tokenStore.getTokens(secretKey);
    if (!current.refreshToken) {
      throw new RingTokenExpiredError("Ring refresh token is not available");
    }

    const { clientId, clientSecret } = await getRingCredentials();
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    try {
      const refreshed = await this.postTokenEndpoint(body);
      await this.tokenStore.updateTokens(secretKey, refreshed);
      return refreshed;
    } catch (err) {
      if (err instanceof RingAuthError) {
        throw new RingTokenExpiredError("Ring rejected the refresh token", {
          cause: err.code,
        });
      }
      throw err;
    }
  }

  private async postTokenEndpoint(body: URLSearchParams): Promise<RingOAuthTokens> {
    const response = await fetch(RING_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    console.log(
      JSON.stringify({
        msg: "ring_oauth_token_request",
        status: response.status,
      }),
    );

    let payload: RingTokenResponse;
    try {
      payload = (await response.json()) as RingTokenResponse;
    } catch {
      throw new RingAuthError("Ring token endpoint returned invalid JSON", {
        status: response.status,
      });
    }

    if (!response.ok || payload.error) {
      throw new RingAuthError(payload.error_description ?? payload.error ?? "Ring token request failed", {
        status: response.status,
      });
    }

    return mapTokenResponse(payload);
  }
}
