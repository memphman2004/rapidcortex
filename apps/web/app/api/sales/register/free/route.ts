import { NextRequest, NextResponse } from "next/server";
import { freeTierRegisterBodySchema } from "rapid-cortex-shared";
import { putFreeTierRegistration } from "@/lib/sales/sales-store";

/** Public free-tier registration — no auth. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = freeTierRegisterBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const registrationId = crypto.randomUUID().replace(/-/g, "").slice(0, 14);
  const item = {
    registrationId,
    ...parsed.data,
    createdAt: new Date().toISOString(),
    source: "self_register" as const,
  };
  await putFreeTierRegistration(item);
  return NextResponse.json({ ok: true, registrationId });
}
