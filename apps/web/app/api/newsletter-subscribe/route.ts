import { NextRequest, NextResponse } from "next/server";

/**
 * Preference log + optional forward for The NexCortiQ Signal.
 * Primary capture remains POST /api/marketing/lead (business email).
 * This route accepts optional vertical preference for segmented sends.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email =
    typeof body === "object" && body && "email" in body
      ? String((body as { email?: unknown }).email ?? "")
          .trim()
          .toLowerCase()
      : "";
  const vertical =
    typeof body === "object" && body && "vertical" in body
      ? String((body as { vertical?: unknown }).vertical ?? "").trim() || undefined
      : undefined;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  console.info(
    JSON.stringify({
      msg: "newsletter_subscribe_preference",
      emailDomain: email.split("@")[1] ?? "",
      vertical: vertical ?? null,
      ts: new Date().toISOString(),
    }),
  );

  return NextResponse.json({ success: true });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
  });
}
