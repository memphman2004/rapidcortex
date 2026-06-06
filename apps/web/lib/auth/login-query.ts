import { getNativeOAuthClientId, isAllowedNativeAppCallbackUri } from "@/lib/auth/nativeAuthConfig";

/**
 * Snapshot of `/login` URL query props parsed on the server so the login form avoids
 * `useSearchParams()` (which can leave React Suspense stuck on fallback in production SSR).
 */

export type NativeDesktopLoginOAuth = {
  codeChallenge: string;
  codeChallengeMethod: "S256";
  state: string;
  redirectUri: string;
  clientId: string;
  /** Custom URL scheme the desktop app opens after `/auth/return-to-app` (from `app_callback`). */
  appCallbackUri: string | null;
};

export type LoginQuerySnapshot = {
  from: string | null;
  notice: string | null;
  /** `?passwordReset=true` after forgot-password completion */
  passwordReset: boolean;
  /** `?confirmed=1` after email confirmation flows */
  signupJustConfirmed: boolean;
  /** `?verified=1` after signup verification */
  signupJustVerified: boolean;
  /**
   * Desktop “system browser” OAuth: after branded password sign-in, the client continues PKCE
   * against Cognito (see `native-desktop-oauth.ts`).
   */
  nativeDesktopOAuth: NativeDesktopLoginOAuth | null;
};

function pick(raw: Record<string, string | string[] | undefined> | undefined, key: string): string | null {
  const v = raw?.[key];
  if (v === undefined) return null;
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" ? s.trim() || null : null;
}

function parseNativeDesktopOAuth(
  raw: Record<string, string | string[] | undefined> | undefined,
): NativeDesktopLoginOAuth | null {
  if (pick(raw, "native") !== "1") return null;
  const codeChallenge = pick(raw, "code_challenge");
  const state = pick(raw, "state");
  const redirectUri = pick(raw, "redirect_uri");
  const clientIdParam = pick(raw, "client_id");
  const appCallback = pick(raw, "app_callback");
  const methodRaw = pick(raw, "code_challenge_method") ?? "S256";
  if (!codeChallenge || !state || !redirectUri || !clientIdParam || methodRaw !== "S256") {
    return null;
  }
  if (appCallback && !isAllowedNativeAppCallbackUri(appCallback)) {
    return null;
  }
  let expectedClient: string;
  try {
    expectedClient = getNativeOAuthClientId();
  } catch {
    return null;
  }
  if (clientIdParam !== expectedClient) {
    return null;
  }
  return {
    codeChallenge,
    codeChallengeMethod: "S256",
    state,
    redirectUri,
    clientId: clientIdParam,
    appCallbackUri: appCallback,
  };
}

/** Parse login-related search params from a Next.js `Page` `searchParams` object (await Promise first). */
export function parseLoginSearchParams(
  raw: Record<string, string | string[] | undefined> | undefined,
): LoginQuerySnapshot {
  return {
    from: pick(raw, "from"),
    notice: pick(raw, "notice"),
    passwordReset: pick(raw, "passwordReset") === "true",
    signupJustConfirmed: pick(raw, "confirmed") === "1",
    signupJustVerified: pick(raw, "verified") === "1",
    nativeDesktopOAuth: parseNativeDesktopOAuth(raw),
  };
}
