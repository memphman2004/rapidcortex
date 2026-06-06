import { NextResponse } from "next/server";

/** Graceful degraded response for integrations that may be intentionally absent during pilot deployments. */
export function serviceNotConfiguredPilotResponse(extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      ok: false,
      status: "disabled" as const,
      reason: "SERVICE_NOT_CONFIGURED" as const,
      message: "This service is not configured in this environment.",
      ...extra,
    },
    { status: 200 },
  );
}
