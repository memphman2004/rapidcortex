import { NextResponse } from "next/server";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";
import { enforceCsrfProtection } from "@/lib/csrf";
import { clearAuthCookiesOnResponse } from "@/lib/auth/apply-auth-cookies";
import { COOKIE_REFRESH_TOKEN } from "@/lib/auth/cookies";
import { revokeRefreshToken } from "@/lib/auth/cognito-refresh";
import { marketingLoginPath } from "@/lib/marketing-links";
import { resolveRedirectUrl } from "@/lib/request-origin";

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return part.slice(eq + 1).trim();
    }
  }
  return undefined;
}

async function revokeSession(request: Request): Promise<void> {
  const refresh = readCookie(request, COOKIE_REFRESH_TOKEN);
  if (!refresh) return;
  await revokeRefreshToken(refresh);
}

export async function POST(request: Request) {
  const mobileBlock = blockMobileAuthRequest(request);
  if (mobileBlock) return mobileBlock;

  const csrfError = enforceCsrfProtection(request);
  if (csrfError) return csrfError;
  await revokeSession(request);
  const res = NextResponse.json({ ok: true });
  clearAuthCookiesOnResponse(res);
  return res;
}

export async function GET(request: Request) {
  const mobileBlock = blockMobileAuthRequest(request);
  if (mobileBlock) return mobileBlock;

  const login = resolveRedirectUrl(marketingLoginPath());
  await revokeSession(request);
  const res = NextResponse.redirect(login);
  clearAuthCookiesOnResponse(res);
  return res;
}
