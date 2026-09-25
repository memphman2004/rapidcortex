import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  AdminGetUserCommand,
  AdminSetUserMFAPreferenceCommand,
  CognitoIdentityProviderClient,
  type AdminGetUserCommandOutput,
  type AttributeType,
} from "@aws-sdk/client-cognito-identity-provider";
import { isAppReviewSilentMfaEmail } from "rapid-cortex-shared";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  getUserContext,
  isUserAccountActive,
} from "../lib/auth.js";
import { forbidden, ok, serverError, unauthorized, serviceUnavailable } from "../lib/response.js";
import { env } from "../lib/env.js";

function readAttr(attrs: AttributeType[] | undefined, name: string): string {
  const a = attrs?.find((x) => x.Name === name);
  return String(a?.Value ?? "");
}

/**
 * App Review only: after silent TOTP enroll, clear software-token MFA so the next
 * Apple device (iPhone then iPad) receives MFA_SETUP again instead of a 6-digit prompt.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

  const email = user.email?.trim() ?? "";
  if (!isAppReviewSilentMfaEmail(email)) {
    return forbidden("Not an App Review account");
  }

  const poolId = env.cognitoUserPoolId;
  if (!poolId) return serviceUnavailable("Cognito user pool is not configured on this deployment");

  try {
    const cip = new CognitoIdentityProviderClient({ region: env.region });
    let out: AdminGetUserCommandOutput;
    try {
      out = await cip.send(
        new AdminGetUserCommand({
          UserPoolId: poolId,
          Username: user.userId,
        }),
      );
    } catch (first: unknown) {
      if (!email) throw first;
      out = await cip.send(
        new AdminGetUserCommand({
          UserPoolId: poolId,
          Username: email,
        }),
      );
    }
    const sub = readAttr(out.UserAttributes, "sub").trim();
    if (!sub || sub !== user.userId) return forbidden();

    const cognitoStoredUsername = String(out.Username ?? user.userId);
    await cip.send(
      new AdminSetUserMFAPreferenceCommand({
        UserPoolId: poolId,
        Username: cognitoStoredUsername,
        SoftwareTokenMfaSettings: { Enabled: false, PreferredMfa: false },
        SMSMfaSettings: { Enabled: false, PreferredMfa: false },
      }),
    );
    return ok({ ok: true, released: true, mailbox: email.toLowerCase() });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "name" in e &&
      (e as { name?: string }).name === "ResourceNotFoundException"
    ) {
      return forbidden();
    }
    console.error("[authAppReviewReleaseMfa]", e);
    return serverError();
  }
};
