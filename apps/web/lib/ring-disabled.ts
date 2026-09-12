/**
 * RING INTEGRATION — SUSPENDED
 * Ring camera integration is currently inactive pending Ring developer
 * program approval. All handlers return 503. Do not remove this code.
 * To reactivate: set RING_INTEGRATION_ENABLED = true in feature-flags.ts
 * and remove all RING_DISABLED guards added on 2026-09-11.
 */

import { RING_INTEGRATION_ENABLED } from "@/lib/feature-flags";
import { NextResponse } from "next/server";

const RING_PATH =
  /(?:^|\/)(?:api\/(?:integrations|public)\/ring|connect\/ring)(?:\/|$)/i;

export function isRingApiPath(path: string): boolean {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return RING_PATH.test(normalized);
}

export function ringIntegrationDisabledJson(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "Ring camera integration is temporarily unavailable.",
      code: "RING_INTEGRATION_DISABLED",
    },
    { status: 503 },
  );
}

/** Returns a 503 response when Ring is suspended; otherwise null. */
export function ringDisabledBffResponse(path: string): NextResponse | null {
  // RING_DISABLED — routes suspended pending Ring developer program approval
  if (RING_INTEGRATION_ENABLED) return null;
  if (!isRingApiPath(path)) return null;
  return ringIntegrationDisabledJson();
}
