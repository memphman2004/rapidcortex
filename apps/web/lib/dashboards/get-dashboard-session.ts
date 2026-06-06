import { cookies } from "next/headers";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { verifyCognitoIdToken } from "@/lib/auth/verify-cognito";
import type { UserContext } from "rapid-cortex-shared";

/** Server-only: resolve signed-in user for role dashboard layouts and API routes. */
export async function getDashboardSessionUser(): Promise<UserContext | null> {
  const jar = await cookies();
  const idToken = jar.get(COOKIE_ID_TOKEN)?.value;
  if (!idToken) return null;
  return verifyCognitoIdToken(idToken);
}
