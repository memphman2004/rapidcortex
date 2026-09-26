import { NextResponse } from "next/server";
import { guestAssistAlertBodySchema } from "rapid-cortex-shared";
import { isGuestAssistEnabled } from "@/lib/runtime-flags";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

/**
 * Guest tapped Contact Security. Forward to API (SNS / staff WS) when configured;
 * always 202 so the guest UI can advance to Call 911.
 */
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
  const parsed = guestAssistAlertBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const base = resolveUpstreamApiBase("/api/guest-assist/alert");
  if (base) {
    try {
      await fetch(`${base}/api/guest-assist/alert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          ts: Date.now(),
        }),
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      // Alert delivery must not block the guest 911 sheet.
    }
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
