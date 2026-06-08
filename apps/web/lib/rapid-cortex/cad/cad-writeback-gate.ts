import { NextResponse } from "next/server";

/**
 * Server-side CAD write-back gate — mirrors `featureEnabled("CAD_WRITEBACK_ENABLED", false)`
 * in `apps/api/src/lib/env.ts`. Use this helper (not raw `process.env`) in BFF routes and adapters.
 */
export function isCadWritebackEnvEnabled(): boolean {
  const v = process.env.CAD_WRITEBACK_ENABLED?.trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return false;
}

/** Matches API `badRequest` copy in `cadWritebackHttp.ts`. */
export const CAD_WRITEBACK_ENV_DISABLED_ERROR =
  "CAD write-back is not enabled for this environment";

/**
 * BFF routes: check env gate before JWT validation or agency scoping.
 * Returns a 400 response when write-back is off; otherwise `null` (proceed).
 */
export function cadWritebackEnvBlockedResponse(): NextResponse | null {
  if (isCadWritebackEnvEnabled()) return null;
  return NextResponse.json({ error: CAD_WRITEBACK_ENV_DISABLED_ERROR }, { status: 400 });
}

/** @deprecated Prefer `isCadWritebackEnvEnabled` — kept for existing imports. */
export function isCadWriteBackExplicitlyEnabled(): boolean {
  return isCadWritebackEnvEnabled();
}
