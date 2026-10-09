import {
  CognitoIdentityProviderClient,
  RespondToAuthChallengeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";
import { nextResponseForAuthResult } from "@/lib/auth/cognito-auth-challenges";
import { getCognitoClientId, getCognitoRegion } from "@/lib/auth/cognito-config";
import { mapRespondToAuthChallengeFailure } from "@/lib/auth/cognito-route-errors";
import { optionalCognitoSecretHash } from "@/lib/auth/cognito-secret-hash";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";
import { enforceCsrfProtection } from "@/lib/csrf";

/**
 * Complete email MFA enrollment from `MFA_SETUP` by confirming the user's email attribute.
 * Cognito then issues `EMAIL_OTP` / `EMAIL_MFA` with a 6-digit code.
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

  let body: { session?: string; username?: string; email?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const session = body.session?.trim();
  const username = body.username?.trim();
  const email = (body.email?.trim() || username || "").toLowerCase();
  if (!session || !username || !email) {
    return NextResponse.json({ error: "session, username, and email are required" }, { status: 400 });
  }

  const cip = new CognitoIdentityProviderClient({ region });
  try {
    const out = await cip.send(
      new RespondToAuthChallengeCommand({
        ClientId: clientId,
        ChallengeName: "MFA_SETUP",
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          email,
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
    return NextResponse.json(
      {
        error:
          typeof mapped.body.error === "string"
            ? mapped.body.error
            : "Could not start email MFA setup",
        code: mapped.body.code,
      },
      { status: mapped.status },
    );
  }
}
