import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";
import { verticalFromRole } from "rapid-cortex-shared";
import { mapUpstreamAuthFailure } from "@/lib/auth/cognito-route-errors";
import { applyCognitoAuthCookies } from "@/lib/auth/apply-auth-cookies";
import { getCognitoClientId, getCognitoRegion } from "@/lib/auth/cognito-config";
import { exchangeRefreshToken } from "@/lib/auth/cognito-refresh";
import { initiateUserPasswordAuth } from "@/lib/auth/cognito-user-password-auth";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { bootstrapPwdChangedAtIfClaimMissing } from "@/lib/server/cognito-password-metadata-sync";
import { enforceCsrfProtection } from "@/lib/csrf";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";
import { isMobileUserAgent, isTabletUserAgent } from "@/lib/device/isMobileRequest";
import { decodeJwtClaims, getPostAuthRedirect } from "@/lib/post-auth-redirect";
import { normalizeVerticalRoleToken } from "@/lib/role-routing";

function isMobileClient(request: Request): boolean {
  const ua = request.headers.get("user-agent");
  return isMobileUserAgent(ua) || isTabletUserAgent(ua);
}

function isVenueOrCampusRole(role: string): boolean {
  const vertical = verticalFromRole(normalizeVerticalRoleToken(role));
  return vertical === "venue" || vertical === "campus";
}

export async function POST(request: Request) {
  const mobileBlock = blockMobileAuthRequest(request);
  if (mobileBlock) return mobileBlock;

  const csrfError = enforceCsrfProtection(request);
  if (csrfError) return csrfError;

  const clientId = getCognitoClientId();
  const region = getCognitoRegion();

  // Fix: check both clientId and region before proceeding
  if (!clientId || !region) {
    return NextResponse.json({ error: "Cognito not configured" }, { status: 500 });
  }

  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  const cip = new CognitoIdentityProviderClient({ region });

  try {
    const out = await initiateUserPasswordAuth(cip, clientId, email, password);

    if (out.kind === "challenge") {
      return NextResponse.json(
        { challenge: out.challenge, session: out.session, username: out.username },
        { status: 202 },
      );
    }

    if (out.kind === "unsupported_challenge") {
      return NextResponse.json(
        { error: `Unsupported auth challenge: ${out.name}` },
        { status: 401 },
      );
    }

    if (out.kind === "invalid_credentials") {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    let idToken = out.idToken;
    let accessToken = out.accessToken;
    let refreshToken = out.refreshToken;
    let expiresIn = out.expiresIn;

    if (refreshToken) {
      const bootstrapped = await bootstrapPwdChangedAtIfClaimMissing(idToken);
      if (bootstrapped) {
        const rotated = await exchangeRefreshToken(refreshToken, idToken);
        if (rotated) {
          idToken = rotated.idToken;
          accessToken = rotated.accessToken;
          refreshToken = rotated.refreshToken ?? refreshToken;
          expiresIn = rotated.expiresIn;
        }
      }
    }

    const claims = decodeJwtClaims(idToken);
    const role = claims["custom:role"] ?? "";
    const agencyId = claims["custom:agencyId"] ?? "";
    if (isMobileClient(request) && !isVenueOrCampusRole(role)) {
      return NextResponse.json(
        { error: "desktop-required", redirectTo: "/login?error=desktop-required" },
        { status: 403 },
      );
    }
    const { searchParams } = new URL(request.url);
    let destination = getPostAuthRedirect(
      {
        role,
        vertical: claims["custom:vertical"] ?? "",
        agencyId,
        email: claims.email ?? email,
      },
      searchParams.get("next"),
    );
    if (
      isMobileClient(request) &&
      normalizeVerticalRoleToken(role) === "venue_supervisor" &&
      agencyId
    ) {
      destination = `/app/venue/${extractVenueCode(agencyId)}/supervisor`;
    }

    const res = NextResponse.json({ ok: true, redirectTo: destination });
    applyCognitoAuthCookies(res, {
      IdToken: idToken,
      AccessToken: accessToken,
      RefreshToken: refreshToken,
      ExpiresIn: expiresIn,
    });
    if (process.env.NODE_ENV !== "production") {
      // Note: cookie may hold a rotated refresh token if bootstrapping ran above
      console.info("[signin] issued_session_cookies", { hasRefreshToken: Boolean(refreshToken?.trim()) });
    }
    return res;
  } catch (err: unknown) {
    console.error("[signin]", err);
    const mapped = mapUpstreamAuthFailure(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}