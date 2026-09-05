import { createHash, randomBytes } from "node:crypto";
import { buildCognitoAuthorizeUrl } from "@/lib/auth/build-cognito-authorize-url";
import { getCognitoClientId, getCognitoDomain } from "@/lib/auth/cognito-config";

export const HOSTED_UI_VERIFIER_COOKIE = "rc_hu_verifier";
export const HOSTED_UI_STATE_COOKIE = "rc_hu_state";
export const HOSTED_UI_NEXT_COOKIE = "rc_hu_next";

export function hostedUiCallbackPath(): string {
  return "/api/auth/hosted-ui/callback";
}

export function hostedUiRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}${hostedUiCallbackPath()}`;
}

export function pkceVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function pkceChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function safeHostedUiNextPath(raw: string | null | undefined): string {
  const next = (raw ?? "").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  return next;
}

export function hostedUiSsoIdentityProvider(): string | undefined {
  return process.env.NEXT_PUBLIC_COGNITO_SSO_IDP?.trim() || process.env.COGNITO_SSO_IDP?.trim() || undefined;
}

export function buildWebHostedUiAuthorizeUrl(input: {
  origin: string;
  state: string;
  codeChallenge: string;
}): string {
  const domain = getCognitoDomain();
  const clientId = getCognitoClientId();
  if (!domain || !clientId) {
    throw new Error("Cognito Hosted UI is not configured (domain + client id)");
  }
  const authorizeEndpoint = domain.startsWith("http")
    ? `${domain.replace(/\/$/, "")}/oauth2/authorize`
    : `https://${domain.replace(/\/$/, "")}/oauth2/authorize`;
  return buildCognitoAuthorizeUrl({
    authorizeEndpoint,
    clientId,
    redirectUri: hostedUiRedirectUri(input.origin),
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: "S256",
    state: input.state,
    scopes: ["openid", "email", "profile"],
    responseType: "code",
    identityProvider: hostedUiSsoIdentityProvider(),
  });
}

export function cognitoTokenEndpoint(): string {
  const domain = getCognitoDomain();
  if (!domain) throw new Error("Cognito domain is not configured");
  const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain.replace(/\/$/, "")}`;
  return process.env.COGNITO_TOKEN_ENDPOINT?.trim() || `${base}/oauth2/token`;
}
