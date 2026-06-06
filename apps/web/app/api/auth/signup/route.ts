// TODO(prod) — Section 2.4: keep `NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP` + Cognito AllowAdminCreateUserOnly aligned in prod;
// no agency workforce onboarding without invite token + agencyadmin/rcsuperadmin issuance.

import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";
import { enforceCsrfProtection } from "@/lib/csrf";
import {
  cognitoPasswordPolicyError,
  isValidCognitoPassword,
} from "@/lib/auth/cognito-password-policy";
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

  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }
  if (!isValidCognitoPassword(password)) {
    return NextResponse.json({ error: cognitoPasswordPolicyError() }, { status: 400 });
  }

  const clientSecret = process.env.COGNITO_CLIENT_SECRET?.trim();
  const defaultAgencyId = process.env.SELF_SIGNUP_DEFAULT_AGENCY_ID?.trim();
  const defaultRole = process.env.SELF_SIGNUP_DEFAULT_ROLE?.trim();
  const defaultIsSubscriber = process.env.SELF_SIGNUP_DEFAULT_IS_SUBSCRIBER?.trim();
  const cip = new CognitoIdentityProviderClient({ region });
  const userAttributes = [{ Name: "email", Value: email }];
  if (defaultAgencyId) {
    userAttributes.push({ Name: "custom:agencyId", Value: defaultAgencyId });
  }
  if (defaultRole) {
    userAttributes.push({ Name: "custom:role", Value: defaultRole });
  }
  if (defaultIsSubscriber) {
    userAttributes.push({ Name: "custom:isSubscriber", Value: defaultIsSubscriber });
  }

  try {
    const out = await cip.send(
      new SignUpCommand({
        ClientId: clientId,
        Username: email,
        Password: password,
        UserAttributes: userAttributes,
        ...(clientSecret
          ? { SecretHash: cognitoSecretHash(email, clientId, clientSecret) }
          : {}),
      }),
    );

    const confirmed = out.UserConfirmed === true;
    return NextResponse.json({
      ok: true,
      needsConfirmation: !confirmed,
      destination: out.CodeDeliveryDetails?.Destination ?? null,
    });
  } catch (err) {
    if (err instanceof UsernameExistsException) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in." },
        { status: 409 },
      );
    }
    const message =
      process.env.NODE_ENV === "production"
        ? "Sign up could not be completed. Contact your administrator."
        : err instanceof Error
          ? err.message
          : "Sign up failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
