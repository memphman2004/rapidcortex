/**
 * Decode JWT payload without signature verification (used only for non-security metadata
 * such as computing Cognito `SECRET_HASH` on refresh when the ID token is expired).
 */
export function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = Buffer.from(b64 + pad, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Username string Cognito expects in `SECRET_HASH` for this pool (email-as-username uses email). */
export function cognitoUsernameForSecretHashFromIdToken(idToken: string): string | null {
  const payload = decodeJwtPayloadUnsafe(idToken);
  if (!payload) return null;
  const u = payload["cognito:username"] ?? payload.email ?? payload.sub;
  return typeof u === "string" && u.length > 0 ? u : null;
}
