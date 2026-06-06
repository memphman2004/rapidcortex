import { NextResponse } from "next/server";
import {
  getNativeOAuthClientId,
  isAllowedNativeAppCallbackUri,
  isAllowedNativeAuthorizeRedirectUri,
} from "@/lib/auth/nativeAuthConfig";

/**
 * Desktop “system browser” entry: validates PKCE parameters, then sends the user to the **branded**
 * `/login` page (same origin). After email/password sign-in on `/login`, the browser continues
 * the OAuth code flow against Cognito (see `native-desktop-oauth.ts` + `login-form.tsx`).
 *
 * The native/desktop app generates PKCE locally, then opens:
 *
 * `GET /auth/native-login?code_challenge=...&state=...&redirect_uri=...&app_callback=...`
 *
 * `redirect_uri` must be allowlisted (custom scheme or `https://{SITE}/auth/return-to-app`).
 * Optional `app_callback` is the desktop deep link (e.g. `rapidcortex-desktop://oauth/callback`) used after HTTPS return-to-app.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const codeChallenge = url.searchParams.get("code_challenge")?.trim();
  const state = url.searchParams.get("state")?.trim();
  const redirectUri = url.searchParams.get("redirect_uri")?.trim();
  const appCallback = url.searchParams.get("app_callback")?.trim();
  if (!codeChallenge || !state || !redirectUri) {
    return NextResponse.json(
      { error: "Missing code_challenge, state, or redirect_uri query parameters." },
      { status: 400 },
    );
  }
  if (!isAllowedNativeAuthorizeRedirectUri(redirectUri)) {
    return NextResponse.json({ error: "redirect_uri is not allowed." }, { status: 400 });
  }

  try {
    const clientId = getNativeOAuthClientId();
    const login = new URL("/login", url.origin);
    login.searchParams.set("native", "1");
    login.searchParams.set("code_challenge", codeChallenge);
    login.searchParams.set("code_challenge_method", "S256");
    login.searchParams.set("state", state);
    login.searchParams.set("redirect_uri", redirectUri);
    login.searchParams.set("client_id", clientId);
    if (appCallback) {
      login.searchParams.set("app_callback", appCallback);
    }
    return NextResponse.redirect(login);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Native auth configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
