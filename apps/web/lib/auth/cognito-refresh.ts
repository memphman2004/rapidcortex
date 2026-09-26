import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RevokeTokenCommand,
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

/**
 * Revoke a refresh token so idle sign-out cannot be replayed from a copied cookie.
 * Returns false when Cognito rejects the call; the caller still clears local cookies.
 */
export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  const clientId = getCognitoClientId();
  const region = getCognitoRegion();
  const token = refreshToken.trim();
  if (!clientId || !token) return false;

  const secret = process.env.COGNITO_CLIENT_SECRET?.trim();
  const cip = new CognitoIdentityProviderClient({ region });
  try {
    await cip.send(
      new RevokeTokenCommand({
        Token: token,
        ClientId: clientId,
        ...(secret ? { ClientSecret: secret } : {}),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
