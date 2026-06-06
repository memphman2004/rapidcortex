import {
  ChangePasswordCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applyCognitoAuthCookies, applyPasswordRotationNavBypassCookie } from "@/lib/auth/apply-auth-cookies";
import { COOKIE_ACCESS_TOKEN, COOKIE_ID_TOKEN, COOKIE_REFRESH_TOKEN } from "@/lib/auth/cookies";
import { cognitoPasswordPolicyError, isValidCognitoPassword } from "@/lib/auth/cognito-password-policy";
import { getCognitoRegion } from "@/lib/auth/cognito-config";
import { mapUpstreamAuthFailure } from "@/lib/auth/cognito-route-errors";
import { enforceCsrfProtection } from "@/lib/csrf";
import { blockMobileAuthRequest } from "@/lib/auth/guards/blockMobileAuth";
import {
  rotateSessionTokensAfterUpstreamSync,
  syncPasswordRenewalMetadataUpstream,
} from "@/lib/server/password-renewal-sync-upstream";
import { ensureCognitoPasswordMetadataAfterWebPasswordChange } from "@/lib/server/cognito-password-metadata-sync";
import { exchangeRefreshToken } from "@/lib/auth/cognito-refresh";

const PASSWORD_CHANGE_SUCCESS_MESSAGE =
  "Password updated successfully. You're all set — your session remains active.";

export async function POST(request: Request) {
  const mobileBlock = blockMobileAuthRequest(request);
  if (mobileBlock) return mobileBlock;

  const csrfError = enforceCsrfProtection(request);
  if (csrfError) return csrfError;

  let body: { currentPassword?: string; newPassword?: string; confirmPassword?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const currentPassword = body.currentPassword;
  const newPassword = body.newPassword;
  const confirmPassword = body.confirmPassword;
  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: "All password fields are required." }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "New password and confirmation do not match." }, { status: 400 });
  }
  if (!isValidCognitoPassword(newPassword)) {
    return NextResponse.json({ error: cognitoPasswordPolicyError() }, { status: 400 });
  }

  const jar = await cookies();
  const refresh = jar.get(COOKIE_REFRESH_TOKEN)?.value;
  let idToken = jar.get(COOKIE_ID_TOKEN)?.value;
  let accessToken = jar.get(COOKIE_ACCESS_TOKEN)?.value;

  if (!accessToken && refresh && idToken) {
    const rotated = await exchangeRefreshToken(refresh, idToken);
    if (rotated) {
      accessToken = rotated.accessToken;
      idToken = rotated.idToken;
    }
  }

  if (!accessToken || !idToken) {
    return NextResponse.json(
      { error: "Your session expired. Sign in again, then retry your password update." },
      { status: 401 },
    );
  }

  const region = getCognitoRegion();
  const cip = new CognitoIdentityProviderClient({ region });
  try {
    await cip.send(
      new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: currentPassword,
        ProposedPassword: newPassword,
      }),
    );
  } catch (err: unknown) {
    const mapped = mapUpstreamAuthFailure(err);
    const error =
      mapped.body?.error === "Invalid credentials"
        ? "Incorrect current password or your session is no longer valid. Sign out, sign back in with the password Cognito recognizes, then try again."
        : (mapped.body?.error ?? "Could not update password.");
    return NextResponse.json(
      { error },
      { status: mapped.status >= 400 && mapped.status < 600 ? mapped.status : 401 },
    );
  }

  /**
   * Best-effort: backend audit / JWT metadata sync. Cognito password is already committed;
   * do not strand the user behind 503 here — downstream API may be down or misconfigured.
   */
  let synced = await syncPasswordRenewalMetadataUpstream(idToken);
  if (!synced) {
    synced = await ensureCognitoPasswordMetadataAfterWebPasswordChange(idToken);
  }
  let rotated = refresh ? await rotateSessionTokensAfterUpstreamSync(refresh, idToken) : null;
  if (!rotated && refresh && synced) {
    rotated = await rotateSessionTokensAfterUpstreamSync(refresh, idToken);
  }
  const nextId = rotated?.idToken ?? idToken;
  const nextAccess = rotated?.accessToken ?? accessToken;

  const message = PASSWORD_CHANGE_SUCCESS_MESSAGE;

  if (!synced && process.env.NODE_ENV === "production") {
    console.warn("[change-password] password-renewal-sync upstream did not return OK; continuing session");
  }

  const res = NextResponse.json({
    ok: true,
    message,
    metadataSyncSkipped: synced ? false : true,
  });
  applyCognitoAuthCookies(res, {
    IdToken: nextId,
    AccessToken: nextAccess,
    RefreshToken: rotated?.refreshToken ?? refresh,
    ExpiresIn: rotated?.expiresIn ?? 3600,
  });
  applyPasswordRotationNavBypassCookie(res);
  return res;
}
