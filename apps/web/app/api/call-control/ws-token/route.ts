import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { verifyCognitoIdToken } from "@/lib/auth/verify-cognito";
import { isCallControlEnabled, isCallControlWebSocketEnabled } from "@/lib/runtime-flags";

/** Issue Cognito id token for browser WebSocket $connect (httpOnly cookie → query param). */
export async function GET() {
  if (!isCallControlEnabled() || !isCallControlWebSocketEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const jar = await cookies();
  const idToken = jar.get(COOKIE_ID_TOKEN)?.value;
  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyCognitoIdToken(idToken);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ token: idToken });
}
