/**
 * Path B — no upstream Lambda for /api/intake/session exists in apps/api (see analyzeIncident for
 * per-incident analysis). Return 501 so smoke tests and clients get an immediate honest response
 * instead of a BFF proxy timeout (502/504).
 */
import { NextResponse } from "next/server";

const NOT_IMPLEMENTED = {
  ok: false,
  error: "IntakeSession API is not yet available on this deployment.",
  code: "INTAKE_SESSION_NOT_IMPLEMENTED",
} as const;

export async function POST() {
  return NextResponse.json(NOT_IMPLEMENTED, { status: 501 });
}

export async function GET() {
  return NextResponse.json(NOT_IMPLEMENTED, { status: 501 });
}
