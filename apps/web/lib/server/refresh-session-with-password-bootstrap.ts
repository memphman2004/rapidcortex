import type { UserContext } from "rapid-cortex-shared/types";
import { exchangeRefreshToken } from "@/lib/auth/cognito-refresh";
import { verifyCognitoIdToken } from "@/lib/auth/verify-cognito";
import { bootstrapPwdChangedAtIfClaimMissing } from "@/lib/server/cognito-password-metadata-sync";

export type RefreshedSessionTokens = {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserContext;
};

/**
 * When the ID token omits `custom:pwdChangedAt`, stamp Cognito and rotate JWTs so middleware
 * and client session agree the password is current (mirrors sign-in bootstrap).
 */
export async function maybeBootstrapPasswordMetadataAndRotate(
  idToken: string,
  refreshToken: string,
): Promise<RefreshedSessionTokens | null> {
  const bootstrapped = await bootstrapPwdChangedAtIfClaimMissing(idToken);
  if (!bootstrapped) return null;

  const rotated = await exchangeRefreshToken(refreshToken, idToken);
  if (!rotated) return null;

  const user = await verifyCognitoIdToken(rotated.idToken);
  if (!user) return null;

  return {
    idToken: rotated.idToken,
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken ?? refreshToken,
    expiresIn: rotated.expiresIn,
    user,
  };
}
