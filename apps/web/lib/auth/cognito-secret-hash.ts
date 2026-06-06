import { createHmac } from "node:crypto";
import { getCognitoClientId } from "@/lib/auth/cognito-config";

export function cognitoSecretHash(username: string, clientId: string, clientSecret: string): string {
  return createHmac("sha256", clientSecret).update(username + clientId).digest("base64");
}

/** Cognito confidential clients require `SECRET_HASH` on sign-in and challenge responses. */
export function optionalCognitoSecretHash(username: string): { SECRET_HASH?: string } {
  const clientId = getCognitoClientId();
  const secret = process.env.COGNITO_CLIENT_SECRET?.trim();
  if (!clientId || !secret) return {};
  return { SECRET_HASH: cognitoSecretHash(username, clientId, secret) };
}
