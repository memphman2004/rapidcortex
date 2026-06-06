import { NextResponse } from "next/server";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";
import { enforceCsrfProtection } from "@/lib/csrf";
import { clearAuthCookiesOnResponse } from "@/lib/auth/apply-auth-cookies";
import { marketingLoginPath } from "@/lib/marketing-links";

export async function POST(request: Request) {
  const mobileBlock = blockMobileAuthRequest(request);
  if (mobileBlock) return mobileBlock;

  const csrfError = enforceCsrfProtection(request);
  if (csrfError) return csrfError;
  const res = NextResponse.json({ ok: true });
  clearAuthCookiesOnResponse(res);
  return res;
}

export async function GET(request: Request) {
  const mobileBlock = blockMobileAuthRequest(request);
  if (mobileBlock) return mobileBlock;

  const login = new URL(marketingLoginPath(), request.url);
  const res = NextResponse.redirect(login);
  clearAuthCookiesOnResponse(res);
  return res;
}
