import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  UsernameExistsException,
  type AuthenticationResultType,
} from "@aws-sdk/client-cognito-identity-provider";
import { env } from "../../lib/env.js";
import { RING_HOMEOWNER_DEFAULT_AGENCY_ID } from "../../lib/ring-integration.js";

const HOMEOWNER_ROLE = "homeowner";

function cip(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({});
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
  const clientId = process.env.COGNITO_CLIENT_ID?.trim() ?? "";
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
            { Name: "email_verified", Value: "true" },
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

  return signInHomeowner({ email, password: input.password, agencyId, created });
}

async function signInHomeowner(input: {
  email: string;
  password: string;
  agencyId: string;
  created: boolean;
}): Promise<HomeownerAuthResult> {
  const clientId = process.env.COGNITO_CLIENT_ID?.trim() ?? "";
  const auth = await cip().send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId,
      AuthParameters: {
        USERNAME: input.email,
        PASSWORD: input.password,
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
