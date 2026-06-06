import {
  AssociateSoftwareTokenCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";
import { enforceCsrfProtection } from "@/lib/csrf";
import { getCognitoRegion } from "@/lib/auth/cognito-config";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";

/**
 * Step 1 of TOTP enrollment after `MFA_SETUP` challenge: returns secret for authenticator apps.
 */
export async function POST(request: Request) {
  const mobileBlock = blockMobileAuthRequest(request);
  if (mobileBlock) return mobileBlock;

  const csrfError = enforceCsrfProtection(request);
  if (csrfError) return csrfError;
  const region = getCognitoRegion();

  let body: { session?: string };
  try {
    body = (await request.json()) as { session?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const session = body.session?.trim();
  if (!session) {
    return NextResponse.json({ error: "session is required" }, { status: 400 });
  }

  const cip = new CognitoIdentityProviderClient({ region });
  try {
    const out = await cip.send(
      new AssociateSoftwareTokenCommand({
        Session: session,
      }),
    );
    if (!out.SecretCode || !out.Session) {
      return NextResponse.json({ error: "Could not start MFA setup" }, { status: 400 });
    }
    return NextResponse.json({
      secretCode: out.SecretCode,
      session: out.Session,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Associate failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
