import {
  CognitoIdentityProviderClient,
  RespondToAuthChallengeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";
import { enforceCsrfProtection } from "@/lib/csrf";
import { applyCognitoAuthCookies } from "@/lib/auth/apply-auth-cookies";
import { getCognitoClientId, getCognitoRegion } from "@/lib/auth/cognito-config";
import { mapRespondToAuthChallengeFailure } from "@/lib/auth/cognito-route-errors";
import { optionalCognitoSecretHash } from "@/lib/auth/cognito-secret-hash";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";

/**
 * Complete second factor after password auth (`SOFTWARE_TOKEN_MFA` or `SMS_MFA`).
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
    challenge?: "SOFTWARE_TOKEN_MFA" | "SMS_MFA";
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const session = body.session?.trim();
  const username = body.username?.trim();
  const code = body.code?.trim();
  const challenge = body.challenge ?? "SOFTWARE_TOKEN_MFA";
  if (!session || !username || !code) {
    return NextResponse.json({ error: "session, username, and code are required" }, { status: 400 });
  }
  if (challenge !== "SOFTWARE_TOKEN_MFA" && challenge !== "SMS_MFA") {
    return NextResponse.json({ error: "challenge must be SOFTWARE_TOKEN_MFA or SMS_MFA" }, { status: 400 });
  }

  const cip = new CognitoIdentityProviderClient({ region });
  try {
    const challengeResponses =
      challenge === "SOFTWARE_TOKEN_MFA"
        ? {
            USERNAME: username,
            SOFTWARE_TOKEN_MFA_CODE: code,
            ...optionalCognitoSecretHash(username),
          }
        : {
            USERNAME: username,
            SMS_MFA_CODE: code,
            ...optionalCognitoSecretHash(username),
          };

    const out = await cip.send(
      new RespondToAuthChallengeCommand({
        ClientId: clientId,
        ChallengeName: challenge,
        Session: session,
        ChallengeResponses: challengeResponses,
      }),
    );

    const auth = out.AuthenticationResult;
    const idToken = auth?.IdToken;
    const accessToken = auth?.AccessToken;
    if (!idToken || !accessToken) {
      return NextResponse.json({ error: "MFA verification did not complete" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });
    applyCognitoAuthCookies(res, {
      IdToken: idToken,
      AccessToken: accessToken,
      RefreshToken: auth.RefreshToken,
      ExpiresIn: auth.ExpiresIn,
    });
    return res;
  } catch (err: unknown) {
    const name =
      err && typeof err === "object" && "name" in err && typeof (err as { name: unknown }).name === "string"
        ? (err as { name: string }).name
        : "Unknown";
    console.warn("[mfa/verify-login] Cognito challenge failed", name);
    if (name === "CodeMismatchException" || name === "EnableSoftwareTokenMFAException") {
      return NextResponse.json(
        {
          error:
            "Invalid MFA code. Use the current code from Google Authenticator for this account, or ask an admin to reset MFA so you can re-enroll.",
          code: name,
        },
        { status: 401 },
      );
    }
    const mapped = mapRespondToAuthChallengeFailure(err);
    return NextResponse.json(
      {
        error:
          typeof mapped.body.error === "string" ? mapped.body.error : "MFA verification failed",
        code: mapped.body.code ?? name,
      },
      { status: mapped.status },
    );
  }
}
