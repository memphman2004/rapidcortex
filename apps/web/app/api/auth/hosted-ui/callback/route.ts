import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applyCognitoAuthCookies } from "@/lib/auth/apply-auth-cookies";
import { getCognitoClientId } from "@/lib/auth/cognito-config";
import {
  HOSTED_UI_NEXT_COOKIE,
  HOSTED_UI_STATE_COOKIE,
  HOSTED_UI_VERIFIER_COOKIE,
  cognitoTokenEndpoint,
  hostedUiRedirectUri,
  safeHostedUiNextPath,
} from "@/lib/auth/hosted-ui";
import { buildNativeTokenExchangeParams } from "@/lib/auth/native-token-exchange";

function clearHostedUiCookies(res: NextResponse): void {
  const secure = process.env.NODE_ENV === "production";
  const opts = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 0 };
  res.cookies.set(HOSTED_UI_VERIFIER_COOKIE, "", opts);
  res.cookies.set(HOSTED_UI_STATE_COOKIE, "", opts);
  res.cookies.set(HOSTED_UI_NEXT_COOKIE, "", opts);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();
  const state = url.searchParams.get("state")?.trim();
  const oauthError = url.searchParams.get("error");
  const jar = await cookies();
  const expectedState = jar.get(HOSTED_UI_STATE_COOKIE)?.value;
  const verifier = jar.get(HOSTED_UI_VERIFIER_COOKIE)?.value;
  const next = safeHostedUiNextPath(jar.get(HOSTED_UI_NEXT_COOKIE)?.value);

  if (oauthError) {
    const res = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(oauthError)}`, url.origin));
    clearHostedUiCookies(res);
    return res;
  }

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    const res = NextResponse.redirect(new URL("/login?error=sso_state", url.origin));
    clearHostedUiCookies(res);
    return res;
  }

  const clientId = getCognitoClientId();
  if (!clientId) {
    return NextResponse.json({ error: "Cognito client is not configured" }, { status: 503 });
  }

  const params = buildNativeTokenExchangeParams({
    clientId,
    code,
    redirectUri: hostedUiRedirectUri(url.origin),
    codeVerifier: verifier,
  });
  const secret = process.env.COGNITO_CLIENT_SECRET?.trim();
  if (secret) params.set("client_secret", secret);

  const tokenRes = await fetch(cognitoTokenEndpoint(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const payload = (await tokenRes.json().catch(() => ({}))) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !payload.id_token || !payload.access_token) {
    console.error("[hosted-ui/callback] token exchange failed", payload.error, payload.error_description);
    const res = NextResponse.redirect(new URL("/login?error=sso_token", url.origin));
    clearHostedUiCookies(res);
    return res;
  }

  const res = NextResponse.redirect(new URL(next, url.origin));
  applyCognitoAuthCookies(res, {
    IdToken: payload.id_token,
    AccessToken: payload.access_token,
    RefreshToken: payload.refresh_token,
    ExpiresIn: payload.expires_in,
  });
  clearHostedUiCookies(res);
  return res;
}
