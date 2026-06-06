import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  applyCognitoAuthCookies,
  clearAuthCookiesOnResponse,
} from "@/lib/auth/apply-auth-cookies";
import { COOKIE_ID_TOKEN, COOKIE_REFRESH_TOKEN } from "@/lib/auth/cookies";
import { exchangeRefreshToken } from "@/lib/auth/cognito-refresh";
import { verifyCognitoIdToken } from "@/lib/auth/verify-cognito";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";
import { maybeBootstrapPasswordMetadataAndRotate } from "@/lib/server/refresh-session-with-password-bootstrap";

function isSafeRelativeRedirect(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.startsWith("/api/auth")) return false;
  return true;
}

/**
 * Server-side session refresh for middleware: exchanges httpOnly refresh token
 * when the ID token is expired or invalid, then redirects back to the app.
 */
export async function GET(request: NextRequest) {
  const mobileBlock = blockMobileAuthRequest(request);
  if (mobileBlock) return mobileBlock;

  const redirectRaw = request.nextUrl.searchParams.get("redirect_to") ?? "/";
  const redirectTo = redirectRaw.split("?")[0] ?? "/";
  if (!isSafeRelativeRedirect(redirectTo)) {
    return NextResponse.json({ error: "Invalid redirect_to" }, { status: 400 });
  }

  const jar = await cookies();
  const idToken = jar.get(COOKIE_ID_TOKEN)?.value;
  const refreshToken = jar.get(COOKIE_REFRESH_TOKEN)?.value;

  if (idToken) {
    const user = await verifyCognitoIdToken(idToken);
    if (user) {
      if (refreshToken) {
        const bootstrapped = await maybeBootstrapPasswordMetadataAndRotate(idToken, refreshToken);
        if (bootstrapped) {
          const res = NextResponse.redirect(new URL(redirectTo, request.url));
          applyCognitoAuthCookies(res, {
            IdToken: bootstrapped.idToken,
            AccessToken: bootstrapped.accessToken,
            RefreshToken: bootstrapped.refreshToken,
            ExpiresIn: bootstrapped.expiresIn,
          });
          return res;
        }
      }
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
  }

  if (!refreshToken) {
    const cleared = NextResponse.redirect(new URL(redirectTo, request.url));
    clearAuthCookiesOnResponse(cleared);
    return cleared;
  }

  const rotated = await exchangeRefreshToken(refreshToken, idToken ?? undefined);
  if (!rotated) {
    const cleared = NextResponse.redirect(new URL(redirectTo, request.url));
    clearAuthCookiesOnResponse(cleared);
    return cleared;
  }

  const bootstrapped = await maybeBootstrapPasswordMetadataAndRotate(
    rotated.idToken,
    rotated.refreshToken ?? refreshToken,
  );

  const user = bootstrapped?.user ?? (await verifyCognitoIdToken(rotated.idToken));
  if (!user) {
    const cleared = NextResponse.redirect(new URL(redirectTo, request.url));
    clearAuthCookiesOnResponse(cleared);
    return cleared;
  }

  const res = NextResponse.redirect(new URL(redirectTo, request.url));
  applyCognitoAuthCookies(res, {
    IdToken: bootstrapped?.idToken ?? rotated.idToken,
    AccessToken: bootstrapped?.accessToken ?? rotated.accessToken,
    RefreshToken: bootstrapped?.refreshToken ?? rotated.refreshToken,
    ExpiresIn: bootstrapped?.expiresIn ?? rotated.expiresIn,
  });
  return res;
}
