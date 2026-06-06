import {
  getCognitoClientId,
  getCognitoDomain,
  getCognitoRegion,
} from "@/lib/auth/cognito-config";

const DEFAULT_SCOPES = ["openid", "email", "profile"] as const;
const DEFAULT_NATIVE_REDIRECT_URI = "rapidcortex://oauth/callback";
const DEFAULT_NATIVE_LOGOUT_URI = "rapidcortex://logout/callback";

/** OAuth redirect URIs allowed for native authorization code + token exchange. */
export const NATIVE_REDIRECT_ALLOWLIST = [
  "rapidcortex://oauth/callback",
  "rapidcortex-desktop://oauth/callback",
  /** Legacy / alternate desktop deep link path segment */
  "rapidcortex-desktop://auth/callback",
  "rapidcortex-ios://oauth/callback",
  "rapidcortex-windows://oauth/callback",
  /** macOS bundle historically used this scheme in Cognito app clients */
  "com.rapidcortex.desktop://oauth",
  "com.rapidcortex.desktop://oauth/callback",
] as const;

/** Logout redirect URIs for Cognito `/logout` (must match app client sign-out URLs). */
export const NATIVE_LOGOUT_ALLOWLIST = [
  "rapidcortex://logout/callback",
  "rapidcortex-desktop://logout/callback",
  "rapidcortex-ios://logout/callback",
  "rapidcortex-windows://logout/callback",
  "com.rapidcortex.desktop://logout/callback",
] as const;

export const NATIVE_RETURN_TO_APP_PATH = "/auth/return-to-app";

export type NativeAuthConfig = {
  cognitoDomain: string;
  cognitoClientId: string;
  cognitoNativeClientId: string;
  cognitoRegion: string;
  nativeRedirectUri: string;
  nativeLogoutUri: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  responseType: "code";
  codeChallengeMethod: "S256";
};

function required(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing required native auth config: ${name}`);
  }
  return trimmed;
}

function normalizeDomain(raw: string): string {
  const value = raw.trim();
  if (value.startsWith("https://") || value.startsWith("http://")) {
    return value.replace(/\/+$/g, "");
  }
  return `https://${value.replace(/\/+$/g, "")}`;
}

/**
 * HTTPS URL Cognito redirects to for the “return to app” handoff page
 * (`NEXT_PUBLIC_SITE_URL` + `/auth/return-to-app`). Omit when unset (direct custom-scheme only).
 */
export function nativeOAuthReturnToAppUrl(): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!site) return null;
  try {
    const base = new URL(site.endsWith("/") ? site.slice(0, -1) : site).origin;
    return `${base}${NATIVE_RETURN_TO_APP_PATH}`;
  } catch {
    return null;
  }
}

function firstNonEmpty(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/** App client ID used for Hosted UI + native token exchange (no secret). */
export function getNativeOAuthClientId(): string {
  const native = firstNonEmpty(
    process.env.COGNITO_NATIVE_CLIENT_ID,
    process.env.NEXT_PUBLIC_COGNITO_NATIVE_CLIENT_ID,
  );
  if (native) return native;
  const web = getCognitoClientId();
  if (web) return web;
  throw new Error(
    "Missing required native auth config: NEXT_PUBLIC_COGNITO_CLIENT_ID (or COGNITO_CLIENT_ID)",
  );
}

export function getNativeAuthConfig(): NativeAuthConfig {
  const domain = normalizeDomain(
    required(
      "NEXT_PUBLIC_COGNITO_DOMAIN (or COGNITO_DOMAIN)",
      getCognitoDomain() ?? undefined,
    ),
  );
  const webClientId = getNativeOAuthClientId();
  const nativeClientId =
    firstNonEmpty(
      process.env.COGNITO_NATIVE_CLIENT_ID,
      process.env.NEXT_PUBLIC_COGNITO_NATIVE_CLIENT_ID,
    ) ?? webClientId;
  const region = required(
    "NEXT_PUBLIC_COGNITO_REGION (or COGNITO_REGION)",
    getCognitoRegion(),
  );
  const redirectUri =
    process.env.NEXT_PUBLIC_NATIVE_REDIRECT_URI?.trim() || DEFAULT_NATIVE_REDIRECT_URI;
  const logoutUri =
    process.env.NEXT_PUBLIC_NATIVE_LOGOUT_URI?.trim() || DEFAULT_NATIVE_LOGOUT_URI;
  const tokenEndpoint =
    process.env.COGNITO_TOKEN_ENDPOINT?.trim() || `${domain}/oauth2/token`;

  return {
    cognitoDomain: domain,
    cognitoClientId: webClientId,
    cognitoNativeClientId: nativeClientId,
    cognitoRegion: region,
    nativeRedirectUri: redirectUri,
    nativeLogoutUri: logoutUri,
    authorizeEndpoint: `${domain}/oauth2/authorize`,
    tokenEndpoint,
    scopes: [...DEFAULT_SCOPES],
    responseType: "code",
    codeChallengeMethod: "S256",
  };
}

/** `redirect_uri` values allowed when exchanging tokens (must match authorize request). */
export function isAllowedNativeRedirectUri(value: string): boolean {
  if (NATIVE_REDIRECT_ALLOWLIST.includes(value as (typeof NATIVE_REDIRECT_ALLOWLIST)[number])) {
    return true;
  }
  const bridge = nativeOAuthReturnToAppUrl();
  return Boolean(bridge && value === bridge);
}

/** `redirect_uri` allowed on `/auth/native-login` → Cognito authorize. */
export function isAllowedNativeAuthorizeRedirectUri(value: string): boolean {
  return isAllowedNativeRedirectUri(value);
}

/**
 * Custom-scheme URL the desktop app registers for `onOpenURL` after HTTPS `/auth/return-to-app`.
 * Must not be an https URL (only native callback schemes).
 */
export function isAllowedNativeAppCallbackUri(value: string): boolean {
  const t = value.trim();
  if (!t || t.startsWith("https://") || t.startsWith("http://")) return false;
  return NATIVE_REDIRECT_ALLOWLIST.includes(t as (typeof NATIVE_REDIRECT_ALLOWLIST)[number]);
}

export function isAllowedNativeLogoutUri(value: string): boolean {
  return NATIVE_LOGOUT_ALLOWLIST.includes(value as (typeof NATIVE_LOGOUT_ALLOWLIST)[number]);
}
