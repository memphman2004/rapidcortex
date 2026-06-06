import { exchangeRefreshToken } from "@/lib/auth/cognito-refresh";

import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

/**
 * Writes `passwordLastChangedAt` via the API Lambda (`/api/auth/password-renewal-sync`).
 * Returns `false` when upstream is unset (local web-only setups) so callers can degrade gracefully.
 */
export async function syncPasswordRenewalMetadataUpstream(idToken: string): Promise<boolean> {
  const path = "/api/auth/password-renewal-sync";
  const base = resolveUpstreamApiBase(path)?.replace(/\/$/, "");
  if (!base) {
    return false;
  }
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** After metadata sync, refresh ID/access tokens so custom claims propagate to middleware. */
export async function rotateSessionTokensAfterUpstreamSync(refreshToken: string, idTokenHint: string) {
  return exchangeRefreshToken(refreshToken, idTokenHint);
}
