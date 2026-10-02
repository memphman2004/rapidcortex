import { env } from "../lib/env.js";
import { resolvePlainOrSecretArn } from "../lib/runtimeSecrets.js";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export interface IncidentContext {
  incidentType?: string;
  description?: string;
  latestTranscriptExcerpt?: string;
  recentObservationSummaries: string[];
}

export interface ParsedVisionResponse {
  narrative: string;
  category: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  correlationNote?: string;
}

export function buildVisionSystemPrompt(context: IncidentContext, cameraName: string): string {
  const parts: string[] = [
    `You are watching authorized security camera footage for a public safety dispatcher.`,
    `Camera: ${cameraName}`,
    `Your job is to describe what you observe in plain language that a dispatcher can act on.`,
    ``,
    `INCIDENT CONTEXT (do not include this text in your response):`,
  ];
  if (context.incidentType) parts.push(`Incident type: ${context.incidentType}`);
  if (context.description) parts.push(`Description: ${context.description}`);
  if (context.latestTranscriptExcerpt) {
    parts.push(`Recent caller transcript: "${context.latestTranscriptExcerpt}"`);
  }
  if (context.recentObservationSummaries.length > 0) {
    parts.push(`Prior observations this incident:`);
    for (const obs of context.recentObservationSummaries) {
      parts.push(`  - ${obs}`);
    }
  }
  parts.push(
    ``,
    `WRITING RULES — follow these exactly:`,
    `1. Start with what is most operationally significant. Do not bury the lead.`,
    `2. Describe people, vehicles, movement, and anything unusual with specific detail.`,
    `3. If a person: describe clothing colors, approximate build, direction of movement, pace.`,
    `4. If a vehicle: describe color, type (sedan/SUV/truck), direction of travel.`,
    `5. If scene is clear: state that clearly. Example: "No people or vehicles visible. Empty street."`,
    `6. If image is dark, blurry, or unreadable: state that. Example: "Frame too dark to analyze."`,
    `7. Keep observations to 2-4 sentences. No filler, no apologies, no hedging beyond necessary.`,
    `8. Do NOT claim certainty about identity. Say "possible", "consistent with", "appears to be".`,
    `9. Do NOT mention the camera name — it will be prepended automatically.`,
    `10. If you see something matching the caller transcript, note the potential match explicitly.`,
    ``,
    `ALSO PROVIDE on a new line, in this exact format:`,
    `CATEGORY: [one of: PERSON, VEHICLE, CROWD_FORMATION, VISIBLE_FIRE, VISIBLE_SMOKE, POTENTIAL_WEAPON, UNUSUAL_MOVEMENT, SCENE_DESCRIPTION, NO_RELEVANT_ACTIVITY]`,
    `CONFIDENCE: [LOW, MEDIUM, or HIGH]`,
    `CORRELATION_NOTE: [one sentence if you see something matching the transcript, or NONE]`,
  );
  return parts.join("\n");
}

export function parseClaudeVisionResponse(raw: string): ParsedVisionResponse {
  const lines = raw.split("\n");
  const metaStart = lines.findIndex(
    (l) => l.startsWith("CATEGORY:") || l.startsWith("CONFIDENCE:"),
  );
  const narrative =
    metaStart > 0
      ? lines.slice(0, metaStart).join(" ").trim().replace(/\s+/g, " ")
      : raw.trim();

  let category = "SCENE_DESCRIPTION";
  let confidence: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM";
  let correlationNote: string | undefined;

  for (const line of lines.slice(Math.max(0, metaStart))) {
    if (line.startsWith("CATEGORY:")) {
      category = line.replace("CATEGORY:", "").trim().toUpperCase();
    } else if (line.startsWith("CONFIDENCE:")) {
      const rawConf = line.replace("CONFIDENCE:", "").trim().toUpperCase();
      if (rawConf === "LOW" || rawConf === "MEDIUM" || rawConf === "HIGH") confidence = rawConf;
    } else if (line.startsWith("CORRELATION_NOTE:")) {
      const note = line.replace("CORRELATION_NOTE:", "").trim();
      if (note && note !== "NONE") correlationNote = note;
    }
  }
  return { narrative, category, confidence, correlationNote };
}

export function detectTranscriptCorrelation(narrative: string, transcript: string): boolean {
  if (!transcript) return false;
  const n = narrative.toLowerCase();
  const t = transcript.toLowerCase();
  const transcriptWords = t.split(/\W+/).filter((w) => w.length > 4);
  const matchCount = transcriptWords.filter((w) => n.includes(w)).length;
  return matchCount >= 2;
}

function useMockVision(): boolean {
  return env.visionAiMock;
}

async function anthropicApiKey(): Promise<string> {
  return resolvePlainOrSecretArn(env.anthropicApiKey, env.anthropicApiKeySecretArn, {
    preferredField: "ANTHROPIC_API_KEY",
  });
}

const MOCK_NARRATIVE =
  "Person in gray hooded sweatshirt observed at the intersection of Oak Street and 3rd Avenue, moving northbound. Pace consistent with jogging. Possible match to caller description of subject fleeing north on Oak Street.\nCATEGORY: PERSON\nCONFIDENCE: HIGH\nCORRELATION_NOTE: Consistent with caller description of a subject fleeing north.";

/**
 * Stream Claude (or mock) text deltas. Caller receives each token as it arrives.
 */
export async function streamClaudeVision(params: {
  frameBase64: string;
  context: IncidentContext;
  cameraName: string;
  onToken: (token: string) => Promise<void> | void;
}): Promise<string | null> {
  if (useMockVision()) {
    let full = "";
    const chunks = MOCK_NARRATIVE.split(/(\s+)/);
    for (const chunk of chunks) {
      if (!chunk) continue;
      full += chunk;
      await params.onToken(chunk);
    }
    return full;
  }

  const apiKey = await anthropicApiKey();
  if (!apiKey) {
    console.error(JSON.stringify({ msg: "vision_claude_missing_api_key" }));
    return null;
  }

  const model = process.env.ANTHROPIC_MODEL_PRIMARY?.trim() || "claude-sonnet-4-6";
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        stream: true,
        system: buildVisionSystemPrompt(params.context, params.cameraName),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: params.frameBase64 },
              },
              {
                type: "text",
                text: "Analyze this security camera frame and write your observation for the dispatcher.",
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "vision_claude_stream_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return null;
  }

  if (!res.ok || !res.body) {
    console.error(
      JSON.stringify({ msg: "vision_claude_http_failed", status: res.status }),
    );
    return null;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const token = extractTextDelta(block);
      if (!token) continue;
      fullText += token;
      await params.onToken(token);
    }
  }
  if (buffer.trim()) {
    const token = extractTextDelta(buffer);
    if (token) {
      fullText += token;
      await params.onToken(token);
    }
  }
  return fullText.trim() ? fullText : null;
}

function extractTextDelta(block: string): string | null {
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const parsed = JSON.parse(payload) as {
        type?: string;
        delta?: { type?: string; text?: string };
      };
      if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
        return parsed.delta.text ?? null;
      }
    } catch {
      /* ignore malformed SSE */
    }
  }
  return null;
}
