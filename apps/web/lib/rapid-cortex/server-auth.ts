import { cookies } from "next/headers";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { verifyCognitoIdToken } from "@/lib/auth/verify-cognito";

export async function requireApiUser() {
  const jar = await cookies();
  const idToken = jar.get(COOKIE_ID_TOKEN)?.value;
  if (!idToken) {
    return null;
  }
  return verifyCognitoIdToken(idToken);
}
