import type { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { optionalCognitoSecretHash } from "@/lib/auth/cognito-secret-hash";

export type UserPasswordAuthResult =
  | {
      kind: "tokens";
      idToken: string;
      accessToken: string;
      refreshToken?: string | null;
      expiresIn?: number;
    }
  | {
      kind: "challenge";
      challenge:
        | "EMAIL_OTP"
        | "NEW_PASSWORD_REQUIRED"
        | "MFA_SETUP"
        | "SOFTWARE_TOKEN_MFA"
        | "SMS_MFA";
      session: string;
      username: string;
    }
  | { kind: "unsupported_challenge"; name: string }
  | { kind: "invalid_credentials" };

function resolveUsernameForChallenge(
  usernameInput: string,
  out: { ChallengeParameters?: Record<string, string> | undefined },
): string {
  return (
    out.ChallengeParameters?.USER_ID_FOR_SRP ??
    out.ChallengeParameters?.USERNAME ??
    usernameInput
  );
}

export async function initiateUserPasswordAuth(
  cip: CognitoIdentityProviderClient,
  clientId: string,
  username: string,
  password: string,
): Promise<UserPasswordAuthResult> {
  const out = await cip.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        ...optionalCognitoSecretHash(username),
      },
    }),
  );

  if (out.ChallengeName === "EMAIL_OTP" && out.Session) {
    return {
      kind: "challenge",
      challenge: "EMAIL_OTP",
      session: out.Session,
      username: resolveUsernameForChallenge(username, out),
    };
  }
  if (out.ChallengeName === "NEW_PASSWORD_REQUIRED" && out.Session) {
    return {
      kind: "challenge",
      challenge: "NEW_PASSWORD_REQUIRED",
      session: out.Session,
      username: resolveUsernameForChallenge(username, out),
    };
  }
  if (out.ChallengeName === "MFA_SETUP" && out.Session) {
    return {
      kind: "challenge",
      challenge: "MFA_SETUP",
      session: out.Session,
      username: resolveUsernameForChallenge(username, out),
    };
  }
  if (out.ChallengeName === "SOFTWARE_TOKEN_MFA" && out.Session) {
    return {
      kind: "challenge",
      challenge: "SOFTWARE_TOKEN_MFA",
      session: out.Session,
      username: resolveUsernameForChallenge(username, out),
    };
  }
  if (out.ChallengeName === "SMS_MFA" && out.Session) {
    return {
      kind: "challenge",
      challenge: "SMS_MFA",
      session: out.Session,
      username: resolveUsernameForChallenge(username, out),
    };
  }
  if (out.ChallengeName) {
    return { kind: "unsupported_challenge", name: out.ChallengeName };
  }

  const auth = out.AuthenticationResult;
  const idToken = auth?.IdToken;
  const accessToken = auth?.AccessToken;
  if (!idToken || !accessToken) {
    return { kind: "invalid_credentials" };
  }
  return {
    kind: "tokens",
    idToken,
    accessToken,
    refreshToken: auth.RefreshToken,
    expiresIn: auth.ExpiresIn,
  };
}
