/**
 * Path B — see apps/web/app/api/intake/session/route.ts
 */
import { NextResponse } from "next/server";

const NOT_IMPLEMENTED = {
  ok: false,
  error: "IntakeSession API is not yet available on this deployment.",
  code: "INTAKE_SESSION_NOT_IMPLEMENTED",
} as const;

export async function GET() {
  return NextResponse.json(NOT_IMPLEMENTED, { status: 501 });
}

export async function PATCH() {
  return NextResponse.json(NOT_IMPLEMENTED, { status: 501 });
}
