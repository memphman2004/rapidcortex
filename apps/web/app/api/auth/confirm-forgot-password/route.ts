import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";
import { enforceCsrfProtection } from "@/lib/csrf";
import { getCognitoClientId, getCognitoRegion } from "@/lib/auth/cognito-config";
import { cognitoPasswordPolicyError, isValidCognitoPassword } from "@/lib/auth/cognito-password-policy";
import { optionalCognitoSecretHash } from "@/lib/auth/cognito-secret-hash";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";

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

  let body: { email?: string; code?: string; newPassword?: string };
  try {
    body = (await request.json()) as { email?: string; code?: string; newPassword?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim();
  const code = body.code?.trim();
  const newPassword = body.newPassword;
  if (!email || !code || !newPassword) {
    return NextResponse.json({ error: "email, code, and newPassword are required" }, { status: 400 });
  }
  if (!isValidCognitoPassword(newPassword)) {
    return NextResponse.json({ error: cognitoPasswordPolicyError() }, { status: 400 });
  }

  const cip = new CognitoIdentityProviderClient({ region });
  try {
    await cip.send(
      new ConfirmForgotPasswordCommand({
        ClientId: clientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
        ...optionalCognitoSecretHash(email),
      }),
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired code, or password does not meet requirements." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Password reset successfully. Please sign in with your new password.",
  });
}
