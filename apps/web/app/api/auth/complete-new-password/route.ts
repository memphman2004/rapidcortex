import type { RespondToAuthChallengeCommandOutput } from "@aws-sdk/client-cognito-identity-provider";
import {
  CognitoIdentityProviderClient,
  RespondToAuthChallengeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";
import { enforceCsrfProtection } from "@/lib/csrf";
import { applyCognitoAuthCookies } from "@/lib/auth/apply-auth-cookies";
import {
  cognitoPasswordPolicyError,
  isValidCognitoPassword,
} from "@/lib/auth/cognito-password-policy";
import { getCognitoClientId, getCognitoRegion } from "@/lib/auth/cognito-config";
import { optionalCognitoSecretHash } from "@/lib/auth/cognito-secret-hash";
import { mapRespondToAuthChallengeFailure } from "@/lib/auth/cognito-route-errors";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";
import type { CognitoRefreshTokens } from "@/lib/auth/cognito-refresh";
import {
  rotateSessionTokensAfterUpstreamSync,
  syncPasswordRenewalMetadataUpstream,
} from "@/lib/server/password-renewal-sync-upstream";
import { verifyCognitoIdToken } from "@/lib/auth/verify-cognito";

async function applyAuthOrChallenges(out: RespondToAuthChallengeCommandOutput, username: string) {
  const auth = out.AuthenticationResult;
  const idToken = auth?.IdToken;
  const accessToken = auth?.AccessToken;
  if (idToken && accessToken) {
    const synced = await syncPasswordRenewalMetadataUpstream(idToken);
    let rotated: CognitoRefreshTokens | null = null;
    if (synced && auth.RefreshToken && auth.RefreshToken.trim() !== "") {
      rotated = await rotateSessionTokensAfterUpstreamSync(auth.RefreshToken, idToken);
    }
    const nextId = rotated?.idToken ?? idToken;
    const nextAccess = rotated?.accessToken ?? accessToken;
    const user = await verifyCognitoIdToken(nextId);
    const res = NextResponse.json({ ok: true, user });
    applyCognitoAuthCookies(res, {
      IdToken: nextId,
      AccessToken: nextAccess,
      RefreshToken: rotated?.refreshToken ?? auth.RefreshToken,
      ExpiresIn: auth.ExpiresIn,
    });
    return res;
  }

  const challengeName = out.ChallengeName;
  const session = out.Session;
  if (challengeName === "MFA_SETUP" && session) {
    return NextResponse.json({ challenge: "MFA_SETUP", session, username }, { status: 202 });
  }
  if (challengeName === "SOFTWARE_TOKEN_MFA" && session) {
    return NextResponse.json({ challenge: "SOFTWARE_TOKEN_MFA", session, username }, { status: 202 });
  }
  if (challengeName === "SMS_MFA" && session) {
    return NextResponse.json({ challenge: "SMS_MFA", session, username }, { status: 202 });
  }

  return NextResponse.json({ error: "Could not complete password change" }, { status: 400 });
}

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

  let body: { username?: string; newPassword?: string; session?: string };
  try {
    body = (await request.json()) as { username?: string; newPassword?: string; session?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = body.username?.trim();
  const newPassword = body.newPassword;
  const session = body.session?.trim();
  if (!username || !newPassword || !session) {
    return NextResponse.json(
      { error: "username, newPassword, and session are required" },
      { status: 400 },
    );
  }
  if (!isValidCognitoPassword(newPassword)) {
    return NextResponse.json({ error: cognitoPasswordPolicyError() }, { status: 400 });
  }

  const cip = new CognitoIdentityProviderClient({ region });
  try {
    const out = await cip.send(
      new RespondToAuthChallengeCommand({
        ClientId: clientId,
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          NEW_PASSWORD: newPassword,
          ...optionalCognitoSecretHash(username),
        },
      }),
    );
    try {
      return await applyAuthOrChallenges(out, username);
    } catch (postErr) {
      console.error("[complete-new-password] post-challenge", postErr);
      return NextResponse.json(
        {
          error:
            "Password may have been updated, but signing you in failed. Try signing in again with your new password.",
          code: "AUTH_POST_CHALLENGE_FAILED",
        },
        { status: 503 },
      );
    }
  } catch (err: unknown) {
    console.error("[complete-new-password]", err);
    const mapped = mapRespondToAuthChallengeFailure(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
