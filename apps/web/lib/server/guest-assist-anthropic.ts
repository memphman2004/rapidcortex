import {
  guestAssistChatBodySchema,
  type GuestAssistChatBody,
} from "rapid-cortex-shared";
import { guestAssistLocalReply } from "./guest-assist-local-reply";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const CONNECT_ERROR =
  "Having trouble connecting. Ask a nearby staff member — or call 911 if this is an emergency.";

/** Plain key, or JSON blob from ECS Secrets injection (`apiKey` / `ANTHROPIC_API_KEY`). */
export function extractAnthropicApiKey(raw: string | undefined): string {
  const t = raw?.trim() ?? "";
  if (!t) return "";
  if (t.startsWith("{")) {
    try {
      const obj = JSON.parse(t) as Record<string, unknown>;
      for (const k of ["apiKey", "ANTHROPIC_API_KEY", "key"] as const) {
        const v = obj[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    } catch {
      return "";
    }
    return "";
  }
  return t;
}

const COMPLETE_ANSWER_RULES = [
  "Give a complete answer, not a one-line brush-off.",
  "Use short paragraphs or numbered steps. Include landmarks and what to do if they cannot find it.",
  "4–8 sentences is appropriate for directions. Do not pad every reply with 911.",
  "Only tell the guest to call 911 if they describe danger, injury, a weapon, fire, or a medical emergency.",
].join(" ");

/**
 * Server-side Claude call. The guest page never receives the API key.
 * Missing ANTHROPIC_API_KEY (or Claude failure) → complete local answers.
 */
export async function completeGuestAssistChat(body: GuestAssistChatBody): Promise<string> {
  const key = extractAnthropicApiKey(process.env.ANTHROPIC_API_KEY);
  if (!key) {
    return guestAssistLocalReply(body);
  }
  const model = process.env.ANTHROPIC_MODEL_PRIMARY?.trim() || "claude-sonnet-4-6";
  try {
    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system: `${body.system}\n\n${COMPLETE_ANSWER_RULES}`,
        messages: body.messages,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => null)) as {
      content?: Array<{ text?: string }>;
    } | null;
    const text = data?.content?.[0]?.text?.trim();
    if (!res.ok || !text) {
      return guestAssistLocalReply(body);
    }
    return text;
  } catch {
    return guestAssistLocalReply(body);
  }
}

export function parseGuestAssistChatBody(raw: unknown): GuestAssistChatBody {
  return guestAssistChatBodySchema.parse(raw);
}

export { CONNECT_ERROR as GUEST_ASSIST_CONNECT_ERROR };
