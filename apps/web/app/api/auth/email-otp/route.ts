import {
  CognitoIdentityProviderClient,
  RespondToAuthChallengeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";
import { enforceCsrfProtection } from "@/lib/csrf";
import { applyCognitoAuthCookies } from "@/lib/auth/apply-auth-cookies";
import { getCognitoClientId, getCognitoRegion } from "@/lib/auth/cognito-config";
import { optionalCognitoSecretHash } from "@/lib/auth/cognito-secret-hash";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";

function resolveUsernameForChallenge(
  username: string,
  out: { ChallengeParameters?: Record<string, string> | undefined },
): string {
  return (
    out.ChallengeParameters?.USER_ID_FOR_SRP ??
    out.ChallengeParameters?.USERNAME ??
    username
  );
}

/**
 * Cognito Essentials (and some pools) return `EMAIL_OTP` after `USER_PASSWORD_AUTH`.
 * Respond with the code from the user’s email, then continue any follow-on challenges.
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

  let body: { session?: string; username?: string; code?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const session = body.session?.trim();
  const username = body.username?.trim();
  const code = body.code?.trim();
  if (!session || !username || !code) {
    return NextResponse.json({ error: "session, username, and code are required" }, { status: 400 });
  }

  const cip = new CognitoIdentityProviderClient({ region });
  try {
    const out = await cip.send(
      new RespondToAuthChallengeCommand({
        ClientId: clientId,
        ChallengeName: "EMAIL_OTP",
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          EMAIL_OTP_CODE: code,
          ...optionalCognitoSecretHash(username),
        },
      }),
    );

    if (out.ChallengeName === "NEW_PASSWORD_REQUIRED" && out.Session) {
      const u = resolveUsernameForChallenge(username, out);
      return NextResponse.json(
        { challenge: "NEW_PASSWORD_REQUIRED", session: out.Session, username: u },
        { status: 202 },
      );
    }
    if (out.ChallengeName === "MFA_SETUP" && out.Session) {
      const u = resolveUsernameForChallenge(username, out);
      return NextResponse.json({ challenge: "MFA_SETUP", session: out.Session, username: u }, { status: 202 });
    }
    if (out.ChallengeName === "SOFTWARE_TOKEN_MFA" && out.Session) {
      const u = resolveUsernameForChallenge(username, out);
      return NextResponse.json(
        { challenge: "SOFTWARE_TOKEN_MFA", session: out.Session, username: u },
        { status: 202 },
      );
    }
    if (out.ChallengeName === "SMS_MFA" && out.Session) {
      const u = resolveUsernameForChallenge(username, out);
      return NextResponse.json({ challenge: "SMS_MFA", session: out.Session, username: u }, { status: 202 });
    }
    if (out.ChallengeName) {
      return NextResponse.json(
        { error: `Unsupported follow-on challenge: ${out.ChallengeName}` },
        { status: 401 },
      );
    }

    const auth = out.AuthenticationResult;
    const idToken = auth?.IdToken;
    const accessToken = auth?.AccessToken;
    if (!idToken || !accessToken) {
      return NextResponse.json({ error: "Email verification did not complete" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });
    applyCognitoAuthCookies(res, {
      IdToken: idToken,
      AccessToken: accessToken,
      RefreshToken: auth.RefreshToken,
      ExpiresIn: auth.ExpiresIn,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid or expired email code" }, { status: 401 });
  }
}
