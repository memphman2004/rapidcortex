import { NextResponse } from "next/server";
import { guestAssistSessionBodySchema } from "rapid-cortex-shared";
import { newGuestAssistSessionId, signGuestAssistToken } from "rapid-cortex-shared/guest-assist/token";
import { isGuestAssistEnabled } from "@/lib/runtime-flags";

export async function POST(request: Request) {
  if (!isGuestAssistEnabled()) {
    return NextResponse.json({ error: "Guest Assist is not enabled" }, { status: 404 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = guestAssistSessionBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const secret = process.env.GUEST_ASSIST_SESSION_SECRET?.trim();
  const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL?.trim() ?? "";
  if (!secret || !wsUrl) {
    return NextResponse.json({
      sessionId: newGuestAssistSessionId(),
      token: null,
      websocketUrl: null,
      mode: "mock" as const,
    });
  }
  const sessionId = newGuestAssistSessionId();
  const token = signGuestAssistToken(
    {
      sid: sessionId,
      v: parsed.data.vertical,
      loc: parsed.data.location,
      name: parsed.data.name,
      agencyId: parsed.data.agencyId?.trim() || "",
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    },
    secret,
  );
  const join = wsUrl.includes("?") ? "&" : "?";
  return NextResponse.json({
    sessionId,
    token,
    websocketUrl: `${wsUrl}${join}ga=1&token=${encodeURIComponent(token)}`,
    mode: "live" as const,
  });
}
