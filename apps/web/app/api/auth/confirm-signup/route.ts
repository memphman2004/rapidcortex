import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";
import { enforceCsrfProtection } from "@/lib/csrf";
import { getCognitoClientId, getCognitoRegion } from "@/lib/auth/cognito-config";
import { isPublicSignupServerEnabled } from "@/lib/auth/public-signup";
import { cognitoSecretHash } from "@/lib/auth/cognito-secret-hash";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";

export async function POST(request: Request) {
  const mobileBlock = blockMobileAuthRequest(request);
  if (mobileBlock) return mobileBlock;

  const csrfError = enforceCsrfProtection(request);
  if (csrfError) return csrfError;
  if (!isPublicSignupServerEnabled()) {
    return NextResponse.json(
      { error: "Self-service signup is disabled. Contact your Rapid Cortex administrator." },
      { status: 403 },
    );
  }
  const clientId = getCognitoClientId();
  const region = getCognitoRegion();
  if (!clientId) {
    return NextResponse.json({ error: "Cognito client ID not configured" }, { status: 500 });
  }

  let body: { email?: string; code?: string };
  try {
    body = (await request.json()) as { email?: string; code?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const code = body.code?.trim();
  if (!email || !code) {
    return NextResponse.json({ error: "email and code are required" }, { status: 400 });
  }

  const clientSecret = process.env.COGNITO_CLIENT_SECRET?.trim();
  const cip = new CognitoIdentityProviderClient({ region });

  try {
    await cip.send(
      new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: email,
        ConfirmationCode: code,
        ...(clientSecret
          ? { SecretHash: cognitoSecretHash(email, clientId, clientSecret) }
          : {}),
      }),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Confirmation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
