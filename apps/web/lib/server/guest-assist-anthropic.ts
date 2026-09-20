import {
  guestAssistChatBodySchema,
  type GuestAssistChatBody,
} from "rapid-cortex-shared";

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

function mockReply(body: GuestAssistChatBody): string {
  const last = [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const loc = body.location?.trim() || "this location";
  const name = body.name?.trim() || "this site";
  if (last) {
    return `I can help with that at ${name} near ${loc}. Ask a nearby staff member if you need a walk-over. Call 911 if this is an emergency.`;
  }
  return `I can help at ${name} near ${loc}. Call 911 if this is an emergency.`;
}

/**
 * Server-side Claude call. The guest page never receives the API key.
 * Missing ANTHROPIC_API_KEY → mock (local/CI).
 */
export async function completeGuestAssistChat(body: GuestAssistChatBody): Promise<string> {
  const key = extractAnthropicApiKey(process.env.ANTHROPIC_API_KEY);
  if (!key) {
    return mockReply(body);
  }
  const model = process.env.ANTHROPIC_MODEL_PRIMARY?.trim() || "claude-sonnet-4-6";
  const res = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      system: body.system,
      messages: body.messages,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => null)) as {
    content?: Array<{ text?: string }>;
  } | null;
  const text = data?.content?.[0]?.text?.trim();
  if (!res.ok || !text) {
    throw new Error(CONNECT_ERROR);
  }
  return text;
}

export function parseGuestAssistChatBody(raw: unknown): GuestAssistChatBody {
  return guestAssistChatBodySchema.parse(raw);
}

export { CONNECT_ERROR as GUEST_ASSIST_CONNECT_ERROR };
