import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

/**
 * Supported call-language catalog for STT/translation UI.
 * Auth is enforced by the upstream Lambda (`canDispatch`).
 * Do not gate this metadata on `live_translation` — the language
 * picker is needed for transcription even when translation add-ons are off.
 */
export async function GET(request: NextRequest) {
  return proxyToAuthUpstream(request, "/api/call-intelligence/languages");
}
