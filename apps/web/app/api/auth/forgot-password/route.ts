import {
  CognitoIdentityProviderClient,
  ForgotPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";
import { enforceCsrfProtection } from "@/lib/csrf";
import { getCognitoClientId, getCognitoRegion } from "@/lib/auth/cognito-config";
import { optionalCognitoSecretHash } from "@/lib/auth/cognito-secret-hash";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";

const GENERIC_MESSAGE =
  "If an account exists for this email, we sent a verification code. Check your inbox and spam folder.";

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

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const cip = new CognitoIdentityProviderClient({ region });
  try {
    await cip.send(
      new ForgotPasswordCommand({
        ClientId: clientId,
        Username: email,
        ...optionalCognitoSecretHash(email),
      }),
    );
  } catch {
    // Same response for unknown user, throttling, or misconfiguration — avoid account enumeration.
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
