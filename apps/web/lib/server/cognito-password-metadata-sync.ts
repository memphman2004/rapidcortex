import {
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  type AdminGetUserCommandOutput,
  type AttributeType,
} from "@aws-sdk/client-cognito-identity-provider";
import { parsePasswordChangeRequiredFlag } from "rapid-cortex-shared/auth/password-policy";
import { decodeJwt } from "jose";
import { getCognitoRegion, getCognitoUserPoolId } from "@/lib/auth/cognito-config";

function readAttr(attrs: AttributeType[] | undefined, name: string): string {
  const a = attrs?.find((x) => x.Name === name);
  return String(a?.Value ?? "");
}

/**
 * When the ID token omits `custom:pwdChangedAt`, session logic treats the password as expired (first-login policy).
 * After a successful `USER_PASSWORD_AUTH`, stamp Cognito once so the refreshed JWT carries the claim — fixes legacy
 * users and cases where the attribute exists in Cognito but was missing from the minted token.
 * Does not run when `custom:pwdChangeReq` is set (admin-mandated reset must use the change-password flow).
 */
export async function bootstrapPwdChangedAtIfClaimMissing(idToken: string): Promise<boolean> {
  try {
    const p = decodeJwt(idToken);
    const existing = String(p["custom:pwdChangedAt"] ?? "").trim();
    if (existing) return false;
    if (parsePasswordChangeRequiredFlag(p["custom:pwdChangeReq"])) return false;
  } catch {
    return false;
  }
  return ensureCognitoPasswordMetadataAfterWebPasswordChange(idToken);
}

/**
 * Best-effort Cognito `custom:pwdChangedAt` update from the web server after `ChangePassword`.
 * Mirrors `apps/api/src/handlers/authPasswordRenewalSync.ts` when `password-renewal-sync` is unreachable.
 */
export async function ensureCognitoPasswordMetadataAfterWebPasswordChange(idToken: string): Promise<boolean> {
  const poolId = getCognitoUserPoolId();
  if (!poolId) return false;

  let sub: string;
  let email: string | undefined;
  try {
    const p = decodeJwt(idToken);
    sub = String(p.sub ?? "").trim();
    email = typeof p.email === "string" ? p.email.trim() : undefined;
  } catch {
    return false;
  }
  if (!sub) return false;

  const region = getCognitoRegion();
  const cip = new CognitoIdentityProviderClient({ region });
  const now = new Date().toISOString();

  try {
    let out: AdminGetUserCommandOutput;
    try {
      out = await cip.send(
        new AdminGetUserCommand({
          UserPoolId: poolId,
          Username: sub,
        }),
      );
    } catch {
      if (!email) return false;
      out = await cip.send(
        new AdminGetUserCommand({
          UserPoolId: poolId,
          Username: email,
        }),
      );
    }
    const resolvedSub = readAttr(out.UserAttributes, "sub").trim();
    if (!resolvedSub || resolvedSub !== sub) return false;
    const cognitoStoredUsername = String(out.Username ?? sub);
    await cip.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: poolId,
        Username: cognitoStoredUsername,
        UserAttributes: [
          { Name: "custom:pwdChangedAt", Value: now },
          { Name: "custom:pwdChangeReq", Value: "false" },
        ],
      }),
    );
    return true;
  } catch {
    return false;
  }
}
