import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { exchangeRefreshToken, type CognitoRefreshTokens } from "@/lib/auth/cognito-refresh";
import { applyCognitoAuthCookies } from "@/lib/auth/apply-auth-cookies";
import { COOKIE_ID_TOKEN, COOKIE_REFRESH_TOKEN } from "@/lib/auth/cookies";
import { verifyCognitoIdToken } from "@/lib/auth/verify-cognito";

export type BffAuthResolution =
  | { token: string; rotated?: CognitoRefreshTokens }
  | { token: null };

/** Resolve a valid Cognito id_token for upstream proxy calls; refresh when the cookie JWT is stale. */
export async function resolveBffBearerToken(request: NextRequest): Promise<BffAuthResolution> {
  const idToken = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  if (idToken) {
    const user = await verifyCognitoIdToken(idToken);
    if (user) return { token: idToken };
  }

  const refreshToken = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
  if (!refreshToken) return { token: null };

  const rotated = await exchangeRefreshToken(refreshToken, idToken);
  if (!rotated) return { token: null };

  return { token: rotated.idToken, rotated };
}

export function applyRotatedAuthCookies(
  response: NextResponse,
  rotated: CognitoRefreshTokens,
): void {
  applyCognitoAuthCookies(response, {
    IdToken: rotated.idToken,
    AccessToken: rotated.accessToken,
    RefreshToken: rotated.refreshToken,
    ExpiresIn: rotated.expiresIn,
  });
}
