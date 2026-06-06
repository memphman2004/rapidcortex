import type { NextResponse } from "next/server";
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_ID_TOKEN,
  COOKIE_PASSWORD_ROTATION_NAV_BYPASS,
  COOKIE_REFRESH_TOKEN,
} from "@/lib/auth/cookies";

/** Cognito `AuthenticationResult` shape (subset). */
export type CognitoAuthCookieSource = {
  IdToken: string;
  AccessToken: string;
  RefreshToken?: string | null;
  ExpiresIn?: number;
};

export function applyCognitoAuthCookies(
  res: NextResponse,
  auth: CognitoAuthCookieSource,
): void {
  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
  const maxAge = Math.min(auth.ExpiresIn ?? 3600, 8 * 3600);
  res.cookies.set(COOKIE_ID_TOKEN, auth.IdToken, { ...base, maxAge });
  res.cookies.set(COOKIE_ACCESS_TOKEN, auth.AccessToken, { ...base, maxAge });
  if (auth.RefreshToken) {
    res.cookies.set(COOKIE_REFRESH_TOKEN, auth.RefreshToken, {
      ...base,
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

/** Lets middleware admit one navigation when Cognito accepted the new password but ID-token claims are stale. */
export function applyPasswordRotationNavBypassCookie(res: NextResponse): void {
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(COOKIE_PASSWORD_ROTATION_NAV_BYPASS, "1", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export function clearAuthCookiesOnResponse(res: NextResponse): void {
  const secure = process.env.NODE_ENV === "production";
  const opts = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 0 };
  res.cookies.set(COOKIE_ID_TOKEN, "", opts);
  res.cookies.set(COOKIE_ACCESS_TOKEN, "", opts);
  res.cookies.set(COOKIE_REFRESH_TOKEN, "", opts);
}
