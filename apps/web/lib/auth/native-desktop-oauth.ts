import { buildCognitoAuthorizeUrl } from "@/lib/auth/build-cognito-authorize-url";
import { getNativeAuthConfig, getNativeOAuthClientId, isAllowedNativeAppCallbackUri } from "@/lib/auth/nativeAuthConfig";

const STORAGE_KEY = "rc_native_oauth_pkce_v1";

/** PKCE + redirect data for desktop OAuth after branded `/login` (survives `prompt=none` → `login_required` retry). */
export type NativeDesktopOAuthPkce = {
  codeChallenge: string;
  codeChallengeMethod: "S256";
  state: string;
  redirectUri: string;
  clientId: string;
  /** Desktop deep link base (e.g. `rapidcortex-desktop://oauth/callback`) for `/auth/return-to-app`. */
  appCallbackUri?: string | null;
};

export function persistNativeDesktopOAuthPkce(bundle: NativeDesktopOAuthPkce): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readNativeDesktopOAuthPkce(): NativeDesktopOAuthPkce | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NativeDesktopOAuthPkce>;
    if (
      typeof parsed.codeChallenge !== "string" ||
      typeof parsed.state !== "string" ||
      typeof parsed.redirectUri !== "string" ||
      typeof parsed.clientId !== "string"
    ) {
      return null;
    }
    let appCallbackUri: string | null | undefined = parsed.appCallbackUri;
    if (typeof appCallbackUri === "string") {
      appCallbackUri = appCallbackUri.trim();
      if (appCallbackUri && !isAllowedNativeAppCallbackUri(appCallbackUri)) {
        appCallbackUri = undefined;
      }
    } else {
      appCallbackUri = undefined;
    }
    return {
      codeChallenge: parsed.codeChallenge,
      codeChallengeMethod: "S256",
      state: parsed.state,
      redirectUri: parsed.redirectUri,
      clientId: parsed.clientId,
      appCallbackUri: appCallbackUri || undefined,
    };
  } catch {
    return null;
  }
}

export function clearNativeDesktopOAuthPkce(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Cognito Hosted UI authorize URL for the native app client (PKCE).
 * `prompt: "none"` requests a code without showing Hosted UI when Cognito already has a browser SSO session.
 */
export function buildNativeDesktopCognitoAuthorizeUrl(
  bundle: NativeDesktopOAuthPkce,
  opts?: { prompt?: "none" },
): string {
  const cfg = getNativeAuthConfig();
  const expectedClient = getNativeOAuthClientId();
  if (bundle.clientId !== expectedClient) {
    throw new Error("Native OAuth client_id mismatch");
  }
  return buildCognitoAuthorizeUrl({
    authorizeEndpoint: cfg.authorizeEndpoint,
    clientId: bundle.clientId,
    redirectUri: bundle.redirectUri,
    codeChallenge: bundle.codeChallenge,
    codeChallengeMethod: "S256",
    state: bundle.state,
    scopes: cfg.scopes,
    responseType: "code",
    ...(opts?.prompt ? { prompt: opts.prompt } : {}),
  });
}
