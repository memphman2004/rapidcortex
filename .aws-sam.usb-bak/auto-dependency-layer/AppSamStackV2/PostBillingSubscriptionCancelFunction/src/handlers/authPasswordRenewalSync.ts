import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  type AdminGetUserCommandOutput,
  type AttributeType,
} from "@aws-sdk/client-cognito-identity-provider";
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

/** Self-service password metadata after successful rotation (JWT must match Cognito `sub`). */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

  const poolId = env.cognitoUserPoolId;
  if (!poolId) return serviceUnavailable("Cognito user pool is not configured on this deployment");

  const email = user.email?.trim();

  try {
    const cip = new CognitoIdentityProviderClient({ region: env.region });
    /**
     * Prefer JWT `sub` as Cognito `Username` (UUID-username pools). Fall back to email for pools
     * where the username is the email address.
     */
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
    const now = new Date().toISOString();
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
    return ok({ ok: true, passwordLastChangedAt: now });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "name" in e &&
      (e as { name?: string }).name === "ResourceNotFoundException"
    ) {
      return forbidden();
    }
    return serverError();
  }
};
