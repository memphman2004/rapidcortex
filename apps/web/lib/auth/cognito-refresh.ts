import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { getCognitoClientId, getCognitoRegion } from "@/lib/auth/cognito-config";
import { cognitoUsernameForSecretHashFromIdToken } from "@/lib/auth/cognito-jwt-payload";
import { optionalCognitoSecretHash } from "@/lib/auth/cognito-secret-hash";

export type CognitoRefreshTokens = {
  idToken: string;
  accessToken: string;
  /** Present when Cognito rotates the refresh token. */
  refreshToken?: string;
  expiresIn: number;
};

/**
 * Exchange a refresh token for new ID/access tokens (USER_PASSWORD_AUTH pool).
 */
export async function exchangeRefreshToken(
  refreshToken: string,
  idTokenHint?: string,
): Promise<CognitoRefreshTokens | null> {
  const clientId = getCognitoClientId();
  const region = getCognitoRegion();
  if (!clientId) return null;

  const username = idTokenHint ? cognitoUsernameForSecretHashFromIdToken(idTokenHint) : null;
  const secret = username ? optionalCognitoSecretHash(username) : {};

  const cip = new CognitoIdentityProviderClient({ region });
  try {
    const out = await cip.send(
      new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
          ...secret,
        },
      }),
    );
    const auth = out.AuthenticationResult;
    if (!auth?.IdToken || !auth.AccessToken) return null;
    return {
      idToken: auth.IdToken,
      accessToken: auth.AccessToken,
      refreshToken: auth.RefreshToken,
      expiresIn: auth.ExpiresIn ?? 3600,
    };
  } catch {
    return null;
  }
}
