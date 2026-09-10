import type { TranslateSegment, TranslateSession } from "rapid-cortex-shared";
import { findSupportedLanguage } from "rapid-cortex-shared";
import { env } from "../lib/env.js";

function languageLabel(code: string): string {
  return findSupportedLanguage(code)?.label ?? code;
}

export function mockSessionSummary(session: TranslateSession, segments: TranslateSegment[]): string {
  const n = segments.filter((s) => s.isFinal).length;
  const lang = languageLabel(session.subjectLanguage || "es");
  if (session.vertical === "hospital") {
    return `Clinical translation session with ${n} exchanges in ${lang}. Encounter notes stored by reference only.`;
  }
  return `Translation session with ${n} exchanges in ${lang}.`;
}

export function formatTranscript(session: TranslateSession, segments: TranslateSegment[]): string {
  if (session.vertical === "hospital") {
    return "";
  }
  return segments
    .filter((s) => s.isFinal)
    .map((s) => {
      const who = s.speaker === "officer" ? "OFFICER" : "SUBJECT";
      const lang = s.speaker === "subject" ? ` (${s.originalLanguage})` : "";
      return `${who}${lang}: ${s.originalText}\n  → ${s.translatedText}`;
    })
    .join("\n");
}

export async function generateSessionSummary(
  session: TranslateSession,
  segments: TranslateSegment[],
): Promise<string> {
  const fallback = mockSessionSummary(session, segments);
  if (env.translateMock) return fallback;
  if (session.vertical === "hospital") return fallback;

  const transcript = formatTranscript(session, segments).slice(0, 4000);
  if (!transcript.trim()) return fallback;

  try {
    const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");
    const client = new BedrockRuntimeClient({ region: env.region });
    const modelId =
      process.env.TRANSLATE_SUMMARY_MODEL_ID?.trim() || "anthropic.claude-3-haiku-20240307-v1:0";
    const res = await client.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 200,
          messages: [
            {
              role: "user",
              content: `Summarize this field translation session in 2-3 sentences for a CAD note. Do not invent facts.\n\n${transcript}`,
            },
          ],
        }),
      }),
    );
    const raw = JSON.parse(new TextDecoder().decode(res.body)) as {
      content?: Array<{ text?: string }>;
    };
    const text = raw.content?.[0]?.text?.trim();
    return text || fallback;
  } catch (error) {
    console.warn(
      JSON.stringify({
        type: "translate.summary.fallback",
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return fallback;
  }
}
