import type {
  RcsAiSummary,
  RcsCallEnriched,
  RcsFloorHealthCallEntry,
  RcsFloorHealthSnapshot,
} from "rapid-cortex-shared";
import { RCS_CLOSED_STATES, rcsAiSummarySchema } from "rapid-cortex-shared";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";
import { getAiRuntimeConfig } from "../../ai/aiConfig.js";

const CLOSED = new Set<string>(RCS_CLOSED_STATES);

const PERMITTED_KEYWORDS = new Set([
  "weapon",
  "unconscious",
  "no_response",
  "fire",
  "explosion",
  "medical_critical",
  "children_involved",
  "suspect_fleeing",
  "multiple_victims",
  "officer_down",
  "structure_collapse",
  "chemical_hazard",
  "prolonged_silence",
  "unit_overdue",
]);

function secondsSince(iso?: string): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
}

export function buildSummarizationPrompt(call: RcsCallEnriched): string {
  const stateEntered = call.stateEnteredAt ?? call.updatedAt;
  const unitDetails = call.units
    .map(
      (u) =>
        `${u.callSign ?? u.unitId}${u.onScene ? " on-scene" : u.distanceMeters != null ? ` ${u.distanceMeters}m` : ""}`,
    )
    .join("; ");
  return `You are a real-time situational summary generator for a 911 emergency communications center.
You receive structured call data and produce a single concise situational summary.

Call data:
- Incident type / notes: ${call.notes?.trim() || "(absent)"}
- Current call state: ${call.state}
- Escalation level: ${call.escalationLevel}
- Audio status: ${call.audioStatus}
- Units assigned: ${call.units.length} (${unitDetails || "none"})
- Time in current state: ${secondsSince(stateEntered)} seconds
- Total elapsed: ${secondsSince(call.createdAt)} seconds

Respond with a JSON object only. No preamble. No markdown.
{
  "text": "1-2 sentence situational summary written for a dispatcher who has not heard this call",
  "concernKeywords": ["array", "of", "concern", "keywords", "from", "this", "predefined", "list"],
  "confidence": 0.0
}

Permitted concern keywords: weapon, unconscious, no_response, fire, explosion, medical_critical,
children_involved, suspect_fleeing, multiple_victims, officer_down, structure_collapse,
chemical_hazard, prolonged_silence, unit_overdue.

Confidence: 0.9 if notes are detailed, 0.7 if notes are partial, 0.5 if notes are absent.
Do not invent facts. If notes are absent, summarize state and time only.`;
}

export function parseAiSummaryResponse(raw: string): RcsAiSummary | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const keywords = Array.isArray(o.concernKeywords)
    ? o.concernKeywords
        .filter((k): k is string => typeof k === "string")
        .map((k) => k.trim().toLowerCase())
        .filter((k) => PERMITTED_KEYWORDS.has(k))
    : [];
  const candidate = {
    text: typeof o.text === "string" ? o.text.trim() : "",
    generatedAt: new Date().toISOString(),
    concernKeywords: keywords,
    confidence: typeof o.confidence === "number" ? o.confidence : 0.5,
  };
  const validated = rcsAiSummarySchema.safeParse(candidate);
  return validated.success ? validated.data : null;
}

function mockSummary(call: RcsCallEnriched): RcsAiSummary {
  const onScene = call.units.some((u) => u.onScene);
  const text = call.notes?.trim()
    ? `Call in ${call.state}: ${call.notes.trim().slice(0, 160)}`
    : `Call ${call.callId} is ${call.state} at escalation ${call.escalationLevel}; ${call.units.length} unit(s)${onScene ? ", arrival confirmed" : ", awaiting geofence arrival"}.`;
  return {
    text: text.slice(0, 500),
    generatedAt: new Date().toISOString(),
    concernKeywords: call.escalationLevel === "NONE" ? [] : ["unit_overdue"],
    confidence: call.notes?.trim() ? 0.7 : 0.5,
  };
}

async function invokeAnthropic(prompt: string): Promise<string | null> {
  const cfg = getAiRuntimeConfig();
  const apiKey = await resolvePlainOrSecretArn(
    process.env.ANTHROPIC_API_KEY,
    cfg.anthropic.apiKeySecretArn || undefined,
    { preferredField: "apiKey" },
  );
  if (!apiKey) return null;
  const model =
    process.env.RCS_SUMMARY_MODEL?.trim() ||
    cfg.anthropic.modelPrimary ||
    "claude-sonnet-4-6";
  const baseUrl = (cfg.anthropic.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      temperature: 0.15,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  return body.content?.find((c) => c.type === "text")?.text?.trim() ?? null;
}

async function invokeBedrock(prompt: string): Promise<string | null> {
  const cfg = getAiRuntimeConfig();
  const modelId =
    process.env.RCS_BEDROCK_MODEL_ID?.trim() ||
    cfg.bedrock.modelPrimary ||
    process.env.BEDROCK_MODEL_ID?.trim();
  if (!modelId) return null;
  const client = new BedrockRuntimeClient({ region: cfg.bedrock.region });
  const out = await client.send(
    new ConverseCommand({
      modelId,
      messages: [{ role: "user", content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 1000, temperature: 0.15 },
    }),
  );
  const blocks = out.output?.message?.content;
  return blocks?.map((b) => ("text" in b ? b.text : "")).join("")?.trim() || null;
}

export async function generateRcsAiSummary(call: RcsCallEnriched): Promise<RcsAiSummary> {
  const mock =
    process.env.RCS_AI_MOCK === "1" ||
    process.env.RCS_AI_MOCK === "true" ||
    process.env.AI_PROVIDER === "mock" ||
    process.env.AI_PROVIDER === "off";

  if (mock) return mockSummary(call);

  const prompt = buildSummarizationPrompt(call);
  try {
    const text = (await invokeAnthropic(prompt)) ?? (await invokeBedrock(prompt));
    if (!text) return mockSummary(call);
    return parseAiSummaryResponse(text) ?? mockSummary(call);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "rcs_ai_summary_failed",
        callId: call.callId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return mockSummary(call);
  }
}

export function buildFloorHealthSnapshot(
  agencyId: string,
  calls: RcsCallEnriched[],
  rulesDispatchedSeconds: number,
): RcsFloorHealthSnapshot {
  const open = calls.filter((c) => !CLOSED.has(c.state));
  const activeCalls: RcsFloorHealthCallEntry[] = open.map((c) => {
    const stateEntered = c.stateEnteredAt ?? c.updatedAt;
    return {
      callId: c.callId,
      incidentId: c.incidentId,
      state: c.state,
      escalationLevel: c.escalationLevel,
      audioStatus: c.audioStatus,
      assignedDispatcherDisplayName: c.assignedDispatcherDisplayName,
      timeInStateSeconds: secondsSince(stateEntered),
      totalElapsedSeconds: secondsSince(c.createdAt),
      aiSummaryText: c.aiSummary?.text,
      aiSummaryKeywords: c.aiSummary?.concernKeywords,
      softHandoffState: c.softHandoff?.state,
      hasUnitOnScene: c.units.some((u) => u.onScene),
      units: c.units.map((u) => ({
        unitId: u.unitId,
        callSign: u.callSign,
        onScene: u.onScene,
        distanceMeters: u.distanceMeters,
      })),
    };
  });

  return {
    agencyId,
    generatedAt: new Date().toISOString(),
    activeCalls,
    totalOpenCalls: activeCalls.length,
    criticalCallCount: activeCalls.filter(
      (c) =>
        c.escalationLevel === "CRITICAL" ||
        c.escalationLevel === "LEVEL_3" ||
        c.state === "ESCALATED" ||
        c.state === "AUDIO_ALERT",
    ).length,
    pendingHandoffCount: activeCalls.filter((c) => c.softHandoffState === "REQUESTED").length,
    overdueArrivalCount: activeCalls.filter(
      (c) =>
        (c.state === "UNIT_DISPATCHED" || c.state === "UNIT_EN_ROUTE") &&
        !c.hasUnitOnScene &&
        c.timeInStateSeconds > rulesDispatchedSeconds,
    ).length,
  };
}

export { secondsSince };
