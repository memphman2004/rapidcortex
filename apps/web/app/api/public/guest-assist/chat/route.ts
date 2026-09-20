import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isGuestAssistEnabled } from "@/lib/runtime-flags";
import {
  completeGuestAssistChat,
  GUEST_ASSIST_CONNECT_ERROR,
  parseGuestAssistChatBody,
} from "@/lib/server/guest-assist-anthropic";

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
  try {
    const body = parseGuestAssistChatBody(json);
    const text = await completeGuestAssistChat(body);
    return NextResponse.json({ text });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request", details: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: GUEST_ASSIST_CONNECT_ERROR }, { status: 502 });
  }
}
