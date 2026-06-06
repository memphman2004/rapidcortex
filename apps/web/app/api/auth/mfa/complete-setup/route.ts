import {
  CognitoIdentityProviderClient,
  RespondToAuthChallengeCommand,
  VerifySoftwareTokenCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";
import { enforceCsrfProtection } from "@/lib/csrf";
import { applyCognitoAuthCookies } from "@/lib/auth/apply-auth-cookies";
import { getCognitoClientId, getCognitoRegion } from "@/lib/auth/cognito-config";
import { optionalCognitoSecretHash } from "@/lib/auth/cognito-secret-hash";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";

/**
 * Finish TOTP enrollment: verify code, then complete `MFA_SETUP` challenge and issue cookies.
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

  let body: { session?: string; userCode?: string; username?: string };
  try {
    body = (await request.json()) as { session?: string; userCode?: string; username?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const session = body.session?.trim();
  const userCode = body.userCode?.trim();
  const username = body.username?.trim();
  if (!session || !userCode || !username) {
    return NextResponse.json({ error: "session, userCode, and username are required" }, { status: 400 });
  }

  const cip = new CognitoIdentityProviderClient({ region });
  try {
    const verified = await cip.send(
      new VerifySoftwareTokenCommand({
        Session: session,
        UserCode: userCode,
        FriendlyDeviceName: "Authenticator",
      }),
    );
    if (!verified.Session) {
      return NextResponse.json({ error: "Invalid authenticator code" }, { status: 400 });
    }

    const out = await cip.send(
      new RespondToAuthChallengeCommand({
        ClientId: clientId,
        ChallengeName: "MFA_SETUP",
        Session: verified.Session,
        ChallengeResponses: {
          USERNAME: username,
          ...optionalCognitoSecretHash(username),
        },
      }),
    );

    const auth = out.AuthenticationResult;
    const idToken = auth?.IdToken;
    const accessToken = auth?.AccessToken;
    if (!idToken || !accessToken) {
      return NextResponse.json({ error: "MFA setup did not complete" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });
    applyCognitoAuthCookies(res, {
      IdToken: idToken,
      AccessToken: accessToken,
      RefreshToken: auth.RefreshToken,
      ExpiresIn: auth.ExpiresIn,
    });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "MFA setup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
