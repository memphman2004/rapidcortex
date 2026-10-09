import {
  CognitoIdentityProviderClient,
  RespondToAuthChallengeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";
import {
  nextResponseForAuthResult,
  selectMfaAnswer,
} from "@/lib/auth/cognito-auth-challenges";
import { getCognitoClientId, getCognitoRegion } from "@/lib/auth/cognito-config";
import { mapRespondToAuthChallengeFailure } from "@/lib/auth/cognito-route-errors";
import { optionalCognitoSecretHash } from "@/lib/auth/cognito-secret-hash";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";
import { enforceCsrfProtection } from "@/lib/csrf";

/**
 * Respond to Cognito `SELECT_MFA_TYPE` (login or enrollment choice).
 * ANSWER uses Cognito names: EMAIL_MFA | SOFTWARE_TOKEN_MFA | SMS_MFA.
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

  let body: { session?: string; username?: string; choice?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const session = body.session?.trim();
  const username = body.username?.trim();
  const answer = body.choice ? selectMfaAnswer(body.choice) : null;
  if (!session || !username || !answer) {
    return NextResponse.json(
      { error: "session, username, and choice (email or authenticator) are required" },
      { status: 400 },
    );
  }

  const cip = new CognitoIdentityProviderClient({ region });
  try {
    const out = await cip.send(
      new RespondToAuthChallengeCommand({
        ClientId: clientId,
        ChallengeName: "SELECT_MFA_TYPE",
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          ANSWER: answer,
          ...optionalCognitoSecretHash(username),
        },
      }),
    );

    const res = nextResponseForAuthResult(out, username);
    if (res) return res;
    return NextResponse.json(
      { error: `Unsupported follow-on challenge: ${out.ChallengeName ?? "none"}` },
      { status: 401 },
    );
  } catch (err: unknown) {
    const mapped = mapRespondToAuthChallengeFailure(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
