import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";

/**
 * Legacy start/stop stubs — see `/api/transcription/start`.
 */
export async function POST(_request: NextRequest) {
  return withFeatureContract("live_transcription", async () =>
    NextResponse.json(
      {
        error: "Not implemented",
        code: "TRANSCRIPTION_STOP_RETIRED",
        message:
          "Use the dispatcher workspace transcript panel (/{jurisdiction}/dispatcher). There is no standalone telephony stop route; end the language session or stop the training stream from the workspace.",
        nextAction: "Open Dispatcher → select an incident → Transcript panel",
      },
      { status: 501 },
    ),
  );
}
