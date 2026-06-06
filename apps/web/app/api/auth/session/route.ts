import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  applyCognitoAuthCookies,
  clearAuthCookiesOnResponse,
} from "@/lib/auth/apply-auth-cookies";
import { COOKIE_ID_TOKEN, COOKIE_REFRESH_TOKEN } from "@/lib/auth/cookies";
import { withCsrfCookie } from "@/lib/csrf";
import { exchangeRefreshToken } from "@/lib/auth/cognito-refresh";
import { verifyCognitoIdToken } from "@/lib/auth/verify-cognito";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";
import { maybeBootstrapPasswordMetadataAndRotate } from "@/lib/server/refresh-session-with-password-bootstrap";

export async function GET(request: Request) {
  const mobileBlock = blockMobileAuthRequest(request);
  if (mobileBlock) return mobileBlock;

  const jar = await cookies();
  const idToken = jar.get(COOKIE_ID_TOKEN)?.value;
  const refreshToken = jar.get(COOKIE_REFRESH_TOKEN)?.value;

  if (!idToken && !refreshToken) {
    return withCsrfCookie(NextResponse.json({ user: null }), request);
  }

  if (idToken && refreshToken) {
    const bootstrapped = await maybeBootstrapPasswordMetadataAndRotate(idToken, refreshToken);
    if (bootstrapped) {
      const res = NextResponse.json({ user: bootstrapped.user });
      applyCognitoAuthCookies(res, {
        IdToken: bootstrapped.idToken,
        AccessToken: bootstrapped.accessToken,
        RefreshToken: bootstrapped.refreshToken,
        ExpiresIn: bootstrapped.expiresIn,
      });
      return withCsrfCookie(res, request);
    }
  }

  if (idToken) {
    const user = await verifyCognitoIdToken(idToken);
    if (user) {
      return withCsrfCookie(NextResponse.json({ user }), request);
    }
  }

  if (refreshToken) {
    const rotated = await exchangeRefreshToken(refreshToken, idToken ?? undefined);
    if (rotated) {
      const bootstrapped = await maybeBootstrapPasswordMetadataAndRotate(
        rotated.idToken,
        rotated.refreshToken ?? refreshToken,
      );
      const user =
        bootstrapped?.user ?? (await verifyCognitoIdToken(rotated.idToken));
      if (user) {
        const res = NextResponse.json({ user });
        applyCognitoAuthCookies(res, {
          IdToken: bootstrapped?.idToken ?? rotated.idToken,
          AccessToken: bootstrapped?.accessToken ?? rotated.accessToken,
          RefreshToken: bootstrapped?.refreshToken ?? rotated.refreshToken ?? refreshToken,
          ExpiresIn: bootstrapped?.expiresIn ?? rotated.expiresIn,
        });
        return withCsrfCookie(res, request);
      }
    }
  }

  const cleared = NextResponse.json({ user: null });
  if (idToken || refreshToken) {
    clearAuthCookiesOnResponse(cleared);
  }
  return withCsrfCookie(cleared, request);
}
