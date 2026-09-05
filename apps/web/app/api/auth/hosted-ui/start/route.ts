import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  HOSTED_UI_NEXT_COOKIE,
  HOSTED_UI_STATE_COOKIE,
  HOSTED_UI_VERIFIER_COOKIE,
  buildWebHostedUiAuthorizeUrl,
  pkceChallengeS256,
  pkceVerifier,
  safeHostedUiNextPath,
} from "@/lib/auth/hosted-ui";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const verifier = pkceVerifier();
    const state = randomBytes(16).toString("hex");
    const next = safeHostedUiNextPath(url.searchParams.get("next"));
    const authorize = buildWebHostedUiAuthorizeUrl({
      origin: url.origin,
      state,
      codeChallenge: pkceChallengeS256(verifier),
    });
    const res = NextResponse.redirect(authorize);
    const secure = process.env.NODE_ENV === "production";
    const cookie = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 600 };
    res.cookies.set(HOSTED_UI_VERIFIER_COOKIE, verifier, cookie);
    res.cookies.set(HOSTED_UI_STATE_COOKIE, state, cookie);
    res.cookies.set(HOSTED_UI_NEXT_COOKIE, next, cookie);
    return res;
  } catch (err) {
    console.error("[hosted-ui/start]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Campus SSO is not configured. Set Cognito domain, client id, and callback URL." },
      { status: 503 },
    );
  }
}
