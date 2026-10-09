import type { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import {
  mapCognitoChallenge,
  type CognitoAuthChallenge,
} from "@/lib/auth/cognito-auth-challenges";
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
      challenge: CognitoAuthChallenge;
      session: string;
      username: string;
      mfasCanSelect?: string[];
      mfasCanSetup?: string[];
    }
  | { kind: "unsupported_challenge"; name: string }
  | { kind: "invalid_credentials" };

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

  if (out.ChallengeName) {
    const mapped = mapCognitoChallenge(
      out.ChallengeName,
      out.Session ?? undefined,
      username,
      out.ChallengeParameters,
    );
    if (mapped) {
      return {
        kind: "challenge",
        challenge: mapped.challenge,
        session: mapped.session,
        username: mapped.username,
        mfasCanSelect: mapped.mfasCanSelect,
        mfasCanSetup: mapped.mfasCanSetup,
      };
    }
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
