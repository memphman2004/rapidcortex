import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";

/**
 * Legacy start/stop stubs — live transcription is incident transcript + language-session
 * audio-chunks on the dispatcher workspace, not a standalone telephony start API.
 */
export async function POST(_request: NextRequest) {
  return withFeatureContract("live_transcription", async () =>
    NextResponse.json(
      {
        error: "Not implemented",
        code: "TRANSCRIPTION_START_RETIRED",
        message:
          "Use the dispatcher workspace transcript panel (/{jurisdiction}/dispatcher). Live speech uses language-session start + audio-chunks; training uses the transcript stream controls.",
        nextAction: "Open Dispatcher → select an incident → Transcript panel",
      },
      { status: 501 },
    ),
  );
}
