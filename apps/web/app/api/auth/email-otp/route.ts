import {
  CognitoIdentityProviderClient,
  type ChallengeNameType,
  RespondToAuthChallengeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";
import { nextResponseForAuthResult } from "@/lib/auth/cognito-auth-challenges";
import { applyCognitoAuthCookies } from "@/lib/auth/apply-auth-cookies";
import { getCognitoClientId, getCognitoRegion } from "@/lib/auth/cognito-config";
import { optionalCognitoSecretHash } from "@/lib/auth/cognito-secret-hash";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";
import { enforceCsrfProtection } from "@/lib/csrf";

/**
 * Cognito email second factor: `EMAIL_OTP` (Essentials OTP) or `EMAIL_MFA` (email MFA).
 * `EMAIL_MFA` is valid at runtime on Essentials pools; older SDK typings omit it.
 */
export async function POST(request: Request) {
  const mobileBlock = blockMobileAuthRequest(request);
  if (mobileBlock) return mobileBlock;

  const csrfError = enforceCsrfProtection(request);
  if (csrfError) return csrfError;
  const clientId = getCognitoClientId();
  const region = getCognitoRegion();
  if (!clientId) {
    return NextResponse.json({ error: "Cognito client ID not configured" }, { status: 500 });
  }

  let body: {
    session?: string;
    username?: string;
    code?: string;
    challenge?: "EMAIL_OTP" | "EMAIL_MFA";
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const session = body.session?.trim();
  const username = body.username?.trim();
  const code = body.code?.trim();
  const challenge = body.challenge === "EMAIL_MFA" ? "EMAIL_MFA" : "EMAIL_OTP";
  if (!session || !username || !code) {
    return NextResponse.json({ error: "session, username, and code are required" }, { status: 400 });
  }

  const cip = new CognitoIdentityProviderClient({ region });
  try {
    const challengeResponses =
      challenge === "EMAIL_MFA"
        ? {
            USERNAME: username,
            EMAIL_MFA_CODE: code,
            ...optionalCognitoSecretHash(username),
          }
        : {
            USERNAME: username,
            EMAIL_OTP_CODE: code,
            ...optionalCognitoSecretHash(username),
          };

    const out = await cip.send(
      new RespondToAuthChallengeCommand({
        ClientId: clientId,
        // EMAIL_MFA is accepted by Cognito; ChallengeNameType lag in @aws-sdk.
        ChallengeName: challenge as ChallengeNameType,
        Session: session,
        ChallengeResponses: challengeResponses,
      }),
    );

    const res = nextResponseForAuthResult(out, username);
    if (res) return res;

    // nextResponseForAuthResult already handles tokens; if AuthenticationResult was partial:
    const auth = out.AuthenticationResult;
    if (auth?.IdToken && auth?.AccessToken) {
      const ok = NextResponse.json({ ok: true });
      applyCognitoAuthCookies(ok, {
        IdToken: auth.IdToken,
        AccessToken: auth.AccessToken,
        RefreshToken: auth.RefreshToken,
        ExpiresIn: auth.ExpiresIn,
      });
      return ok;
    }

    return NextResponse.json(
      { error: `Unsupported follow-on challenge: ${out.ChallengeName ?? "none"}` },
      { status: 401 },
    );
  } catch {
    return NextResponse.json({ error: "Invalid or expired email code" }, { status: 401 });
  }
}
