import { NextResponse } from "next/server";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";
import { getNativeAuthConfig, isAllowedNativeRedirectUri } from "@/lib/auth/nativeAuthConfig";
import { buildNativeTokenExchangeParams } from "@/lib/auth/native-token-exchange";

type NativeTokenRequest = {
  code?: string;
  codeVerifier?: string;
  redirectUri?: string;
};

type NativeRefreshRequest = {
  refreshToken?: string;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) {
    return false;
  }
  entry.count += 1;
  buckets.set(key, entry);
  return true;
}

function auditTokenExchange(
  request: Request,
  status: "success" | "failure",
  requestId: string,
  reason?: string,
) {
  console.info(
    JSON.stringify({
      eventType: "native_auth_token_exchange",
      status,
      timestamp: new Date().toISOString(),
      requestId,
      userAgent: request.headers.get("user-agent") ?? "unknown",
      reason,
    }),
  );
}

async function exchangeWithCognito(body: URLSearchParams, tokenEndpoint: string) {
  return fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });
}

export async function POST(request: Request) {
  const mobileBlock = blockMobileAuthRequest(request);
  if (mobileBlock) return mobileBlock;

  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const ipKey = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";
  if (!checkRateLimit(ipKey)) {
    auditTokenExchange(request, "failure", requestId, "rate_limited");
    return NextResponse.json({ error: "Too many token exchange attempts" }, { status: 429 });
  }

  let payload: NativeTokenRequest;
  try {
    payload = (await request.json()) as NativeTokenRequest;
  } catch {
    auditTokenExchange(request, "failure", requestId, "invalid_json");
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = payload.code?.trim();
  const codeVerifier = payload.codeVerifier?.trim();
  const redirectUri = payload.redirectUri?.trim();
  if (!code || !codeVerifier || !redirectUri) {
    auditTokenExchange(request, "failure", requestId, "missing_fields");
    return NextResponse.json(
      { error: "code, codeVerifier, and redirectUri are required" },
      { status: 400 },
    );
  }
  if (!isAllowedNativeRedirectUri(redirectUri)) {
    auditTokenExchange(request, "failure", requestId, "invalid_redirect_uri");
    return NextResponse.json({ error: "redirectUri is not allowed" }, { status: 400 });
  }

  try {
    const config = getNativeAuthConfig();
    const response = await exchangeWithCognito(
      buildNativeTokenExchangeParams({
        clientId: config.cognitoNativeClientId,
        code,
        redirectUri,
        codeVerifier,
      }),
      config.tokenEndpoint,
    );
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      auditTokenExchange(request, "failure", requestId, "upstream_rejected");
      return NextResponse.json(
        { error: "Token exchange failed", errorCode: json.error ?? "exchange_failed" },
        { status: 502 },
      );
    }

    auditTokenExchange(request, "success", requestId);
    return NextResponse.json(
      {
        access_token: json.access_token,
        id_token: json.id_token,
        refresh_token: json.refresh_token,
        expires_in: json.expires_in,
        token_type: json.token_type,
      },
      { status: 200 },
    );
  } catch {
    auditTokenExchange(request, "failure", requestId, "config_or_network_error");
    return NextResponse.json({ error: "Native token exchange unavailable" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const mobileBlock = blockMobileAuthRequest(request);
  if (mobileBlock) return mobileBlock;

  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  let payload: NativeRefreshRequest;
  try {
    payload = (await request.json()) as NativeRefreshRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const refreshToken = payload.refreshToken?.trim();
  if (!refreshToken) {
    return NextResponse.json({ error: "refreshToken is required" }, { status: 400 });
  }
  try {
    const config = getNativeAuthConfig();
    const response = await exchangeWithCognito(
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.cognitoNativeClientId,
        refresh_token: refreshToken,
      }),
      config.tokenEndpoint,
    );
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      auditTokenExchange(request, "failure", requestId, "refresh_rejected");
      return NextResponse.json({ error: "Refresh failed" }, { status: 502 });
    }
    auditTokenExchange(request, "success", requestId);
    return NextResponse.json(
      {
        access_token: json.access_token,
        id_token: json.id_token,
        refresh_token: json.refresh_token ?? refreshToken,
        expires_in: json.expires_in,
        token_type: json.token_type,
      },
      { status: 200 },
    );
  } catch {
    auditTokenExchange(request, "failure", requestId, "refresh_unavailable");
    return NextResponse.json({ error: "Refresh unavailable" }, { status: 500 });
  }
}
