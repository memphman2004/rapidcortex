import {
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  UsernameExistsException,
  UserNotFoundException,
  type AdminGetUserCommandOutput,
  type AuthenticationResultType,
} from "@aws-sdk/client-cognito-identity-provider";
import { createHmac } from "node:crypto";
import { env } from "../../lib/env.js";
import { RING_HOMEOWNER_DEFAULT_AGENCY_ID } from "../../lib/ring-integration.js";
import { assignCognitoVerticalGroup } from "../../lib/assign-cognito-vertical-group.js";
import {
  newHomeownerVerificationToken,
  sendHomeownerVerificationEmail,
  storeHomeownerVerificationToken,
} from "./homeowner-email-verify.js";

const HOMEOWNER_ROLE = "homeowner";

const GENERIC_FORGOT_MESSAGE =
  "If an account exists for this email, we sent a verification code. Check your inbox and spam folder.";

function cip(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({});
}

function cognitoClientId(): string {
  return process.env.COGNITO_CLIENT_ID?.trim() ?? "";
}

/** Matches Cognito User Pool password policy (min 12 + upper/lower/number/symbol). */
export function isValidHomeownerPassword(password: string): boolean {
  if (password.length < 12) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

function optionalSecretHash(username: string): { SECRET_HASH?: string } {
  const clientId = cognitoClientId();
  const secret = process.env.COGNITO_CLIENT_SECRET?.trim();
  if (!clientId || !secret) return {};
  return {
    SECRET_HASH: createHmac("sha256", secret).update(username + clientId).digest("base64"),
  };
}

export type HomeownerAuthResult = {
  userId: string;
  email: string;
  agencyId: string;
  created: boolean;
  authenticationResult?: AuthenticationResultType;
};

/**
 * Create or sign in a lightweight Cognito homeowner for Ring Appstore account linking.
 * Always scopes devices to RING_HOMEOWNER_DEFAULT_AGENCY_ID (pilot: test-agency).
 */
export async function authenticateHomeowner(input: {
  email: string;
  password: string;
  mode: "signin" | "signup";
}): Promise<HomeownerAuthResult> {
  const poolId = env.cognitoUserPoolId;
  const clientId = cognitoClientId();
  if (!poolId || !clientId) {
    throw new Error("COGNITO_NOT_CONFIGURED");
  }

  const email = input.email.trim().toLowerCase();
  const agencyId = RING_HOMEOWNER_DEFAULT_AGENCY_ID;
  let created = false;

  if (input.mode === "signup") {
    try {
      await cip().send(
        new AdminCreateUserCommand({
          UserPoolId: poolId,
          Username: email,
          UserAttributes: [
            { Name: "email", Value: email },
            { Name: "email_verified", Value: "false" },
            { Name: "custom:agencyId", Value: agencyId },
            { Name: "custom:role", Value: HOMEOWNER_ROLE },
            { Name: "custom:pwdChangeReq", Value: "false" },
          ],
          TemporaryPassword: input.password,
          MessageAction: "SUPPRESS",
        }),
      );
      await cip().send(
        new AdminSetUserPasswordCommand({
          UserPoolId: poolId,
          Username: email,
          Password: input.password,
          Permanent: true,
        }),
      );
      created = true;
      await assignCognitoVerticalGroup({
        username: email,
        agencyId,
        role: HOMEOWNER_ROLE,
        email,
      });
    } catch (err) {
      if (!(err instanceof UsernameExistsException)) {
        throw err;
      }
      // Fall through to sign-in for existing accounts — but label wrong-password clearly.
      try {
        return await signInHomeowner({ email, password: input.password, agencyId, created: false });
      } catch (signInErr) {
        const signMsg = signInErr instanceof Error ? signInErr.message : "";
        if (
          signMsg === "AUTH_FAILED" ||
          signMsg.includes("NotAuthorized") ||
          /incorrect username or password/i.test(signMsg)
        ) {
          throw new Error("ACCOUNT_EXISTS_WRONG_PASSWORD");
        }
        throw signInErr;
      }
    }
  }

  try {
    return await signInHomeowner({ email, password: input.password, agencyId, created });
  } finally {
    if (created) {
      await lockNewHomeownerUntilEmailVerified(email, agencyId, poolId);
    }
  }
}

async function lockNewHomeownerUntilEmailVerified(
  email: string,
  agencyId: string,
  poolId: string,
): Promise<void> {
  const token = newHomeownerVerificationToken();
  try {
    await cip().send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: poolId,
        Username: email,
        UserAttributes: [{ Name: "email_verified", Value: "false" }],
      }),
    );
    await storeHomeownerVerificationToken({
      token,
      email,
      cognitoUsername: email,
      agencyId,
    });
    try {
      await sendHomeownerVerificationEmail(email, token);
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "homeowner_verify_email_failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  } finally {
    await cip().send(
      new AdminDisableUserCommand({
        UserPoolId: poolId,
        Username: email,
      }),
    );
  }
}

/** Start Cognito forgot-password for a Ring device-owner RC account (enumeration-safe). */
export async function requestHomeownerPasswordReset(emailRaw: string): Promise<{ message: string }> {
  const clientId = cognitoClientId();
  if (!clientId) {
    throw new Error("COGNITO_NOT_CONFIGURED");
  }
  const email = emailRaw.trim().toLowerCase();
  try {
    await cip().send(
      new ForgotPasswordCommand({
        ClientId: clientId,
        Username: email,
        ...optionalSecretHash(email),
      }),
    );
  } catch {
    // Same response for unknown user / throttle / misconfig — avoid account enumeration.
  }
  return { message: GENERIC_FORGOT_MESSAGE };
}

/** Confirm Cognito forgot-password with verification code + new permanent password. */
export async function confirmHomeownerPasswordReset(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<void> {
  const clientId = cognitoClientId();
  if (!clientId) {
    throw new Error("COGNITO_NOT_CONFIGURED");
  }
  if (!isValidHomeownerPassword(input.newPassword)) {
    throw new Error("PASSWORD_POLICY");
  }
  const email = input.email.trim().toLowerCase();
  try {
    await cip().send(
      new ConfirmForgotPasswordCommand({
        ClientId: clientId,
        Username: email,
        ConfirmationCode: input.code.trim(),
        Password: input.newPassword,
        ...optionalSecretHash(email),
      }),
    );
  } catch {
    throw new Error("RESET_CONFIRM_FAILED");
  }
}

async function signInHomeowner(input: {
  email: string;
  password: string;
  agencyId: string;
  created: boolean;
}): Promise<HomeownerAuthResult> {
  const clientId = cognitoClientId();
  const auth = await cip().send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId,
      AuthParameters: {
        USERNAME: input.email,
        PASSWORD: input.password,
        ...optionalSecretHash(input.email),
      },
    }),
  );

  if (auth.ChallengeName) {
    throw new Error(`AUTH_CHALLENGE:${auth.ChallengeName}`);
  }

  const result = auth.AuthenticationResult;
  if (!result?.IdToken) {
    throw new Error("AUTH_FAILED");
  }

  // Prefer Cognito `sub` from access token payload when present; else use email username.
  const userId = decodeJwtSub(result.IdToken) ?? input.email;

  return {
    userId,
    email: input.email,
    agencyId: input.agencyId,
    created: input.created,
    authenticationResult: result,
  };
}

function cognitoAttr(
  attrs: AdminGetUserCommandOutput["UserAttributes"],
  name: string,
): string {
  return attrs?.find((a) => a.Name === name)?.Value?.trim() ?? "";
}

function isCognitoUserNotFound(err: unknown): boolean {
  if (err instanceof UserNotFoundException) return true;
  return err instanceof Error && err.name === "UserNotFoundException";
}

/**
 * Look up a Ring Device Owner for Account Link URL deletion (email only).
 * Returns null for unknown users and non-homeowner roles — never deletes agency operators.
 */
export async function resolveHomeownerForDeletion(
  emailRaw: string,
): Promise<{ userId: string; email: string; agencyId: string } | null> {
  const poolId = env.cognitoUserPoolId;
  if (!poolId) {
    throw new Error("COGNITO_NOT_CONFIGURED");
  }

  const email = emailRaw.trim().toLowerCase();
  let user: AdminGetUserCommandOutput;
  try {
    user = await cip().send(new AdminGetUserCommand({ UserPoolId: poolId, Username: email }));
  } catch (err) {
    if (isCognitoUserNotFound(err)) {
      return null;
    }
    throw err;
  }

  const role = cognitoAttr(user.UserAttributes, "custom:role").toLowerCase();
  if (role !== HOMEOWNER_ROLE) {
    return null;
  }

  const username = user.Username?.trim() || email;
  const userId = cognitoAttr(user.UserAttributes, "sub") || username;
  const agencyId =
    cognitoAttr(user.UserAttributes, "custom:agencyId") || RING_HOMEOWNER_DEFAULT_AGENCY_ID;
  return { userId, email, agencyId };
}

function decodeJwtSub(idToken: string): string | null {
  try {
    const parts = idToken.split(".");
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    const payload = JSON.parse(json) as { sub?: string };
    return payload.sub?.trim() || null;
  } catch {
    return null;
  }
}
