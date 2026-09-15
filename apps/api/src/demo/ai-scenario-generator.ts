/**
 * Converts a natural-language situation into a runnable ScenarioDefinition.
 * Uses Bedrock Converse when available; heuristic JSON when BEDROCK_MOCK=1
 * or the model call fails (never throws to the UI).
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { ScenarioDefinition, ScenarioVertical } from "rapid-cortex-shared";
import { finish, runStandardWalkthrough } from "./scenarios/helpers.js";

const SCENARIO_GENERATION_SYSTEM_PROMPT = `You are an emergency dispatch scenario generator for
Rapid Cortex, a public safety platform.

Convert a natural-language situation description into a structured JSON scenario definition.

Output ONLY valid JSON matching this schema:
{
  "incidentType": string,
  "priority": number,
  "locationHint": string,
  "vertical": string,
  "callerMessage": string,
  "reportMethod": string,
  "suggestedUnits": string[],
  "aiSummary": string,
  "cameraIds": string[],
  "escalateToSupervisor": boolean,
  "scenarioLabel": string,
  "estimatedDemoMinutes": number
}

incidentType must be one of: MED-CARDIAC, MED-TRAUMA, MED-OD, MED-PSYCH, LEW-WEAPON, LEW-ASSAULT, LEW-SUSP, FIRE-STRUCTURE, TRF-MVA, WELFARE, NOISE, ABANDON
reportMethod must be one of: qr_scan, sms, phone, camera_alert
priority is 1-5 (1=life threatening)
Do not include real phone numbers. Do not instruct anyone to call 911.`;

type GeneratedParams = {
  incidentType: string;
  priority: 1 | 2 | 3 | 4 | 5;
  locationHint: string;
  vertical: ScenarioVertical;
  callerMessage: string;
  reportMethod: "qr_scan" | "sms" | "phone" | "camera_alert";
  suggestedUnits: string[];
  aiSummary: string;
  cameraIds: string[];
  escalateToSupervisor: boolean;
  scenarioLabel: string;
  estimatedDemoMinutes: number;
};

function heuristicParams(situation: string, vertical: ScenarioVertical): GeneratedParams {
  const lower = situation.toLowerCase();
  let incidentType = "WELFARE";
  let priority: 1 | 2 | 3 | 4 | 5 = 3;
  if (/(weapon|gun|rifle|knife|active)/.test(lower)) {
    incidentType = "LEW-WEAPON";
    priority = 1;
  } else if (/(fight|assault|punch)/.test(lower)) {
    incidentType = "LEW-ASSAULT";
    priority = 2;
  } else if (/(cardiac|chest|cpr|unconscious|overdose|od\b)/.test(lower)) {
    incidentType = /overdose|od\b/.test(lower) ? "MED-OD" : "MED-CARDIAC";
    priority = 1;
  } else if (/(fire|smoke)/.test(lower)) {
    incidentType = "FIRE-STRUCTURE";
    priority = 1;
  } else if (/(crash|mva|collision)/.test(lower)) {
    incidentType = "TRF-MVA";
    priority = 2;
  } else if (/(noise|party)/.test(lower)) {
    incidentType = "NOISE";
    priority = 5;
  } else if (/(suspicious|lurking)/.test(lower)) {
    incidentType = "LEW-SUSP";
    priority = 2;
  }
  return {
    incidentType,
    priority,
    locationHint: situation.slice(0, 80) || "Demo location",
    vertical,
    callerMessage: situation.slice(0, 400),
    reportMethod: "phone",
    suggestedUnits: priority <= 2 ? ["ems", "security"] : ["security"],
    aiSummary: `[DEMO] ${incidentType}: ${situation.slice(0, 180)}`,
    cameraIds: [],
    escalateToSupervisor: priority === 1,
    scenarioLabel: `AI: ${incidentType}`,
    estimatedDemoMinutes: 5,
  };
}

function parseGenerated(raw: string, fallback: GeneratedParams): GeneratedParams {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return fallback;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const priorityNum = Number(parsed.priority);
    const priority = (priorityNum >= 1 && priorityNum <= 5 ? priorityNum : fallback.priority) as 1 | 2 | 3 | 4 | 5;
    const reportMethod =
      parsed.reportMethod === "qr_scan" ||
      parsed.reportMethod === "sms" ||
      parsed.reportMethod === "phone" ||
      parsed.reportMethod === "camera_alert"
        ? parsed.reportMethod
        : fallback.reportMethod;
    return {
      incidentType: String(parsed.incidentType ?? fallback.incidentType),
      priority,
      locationHint: String(parsed.locationHint ?? fallback.locationHint),
      vertical: fallback.vertical,
      callerMessage: String(parsed.callerMessage ?? fallback.callerMessage),
      reportMethod,
      suggestedUnits: Array.isArray(parsed.suggestedUnits)
        ? parsed.suggestedUnits.map((u) => String(u))
        : fallback.suggestedUnits,
      aiSummary: String(parsed.aiSummary ?? fallback.aiSummary),
      cameraIds: Array.isArray(parsed.cameraIds) ? parsed.cameraIds.map((c) => String(c)) : fallback.cameraIds,
      escalateToSupervisor: Boolean(parsed.escalateToSupervisor),
      scenarioLabel: String(parsed.scenarioLabel ?? fallback.scenarioLabel),
      estimatedDemoMinutes: Number(parsed.estimatedDemoMinutes) || 5,
    };
  } catch {
    return fallback;
  }
}

async function callAiWithSystemPrompt(system: string, user: string): Promise<string | null> {
  if (process.env.BEDROCK_MOCK === "1" || process.env.BEDROCK_MOCK === "true") {
    return null;
  }
  const modelId =
    process.env.BEDROCK_MODEL_ID?.trim() ||
    process.env.QA_BEDROCK_MODEL_ID?.trim() ||
    "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  try {
    const client = new BedrockRuntimeClient({ region });
    const out = await client.send(
      new ConverseCommand({
        modelId,
        system: [{ text: system }],
        messages: [{ role: "user", content: [{ text: user }] }],
        inferenceConfig: { maxTokens: 700, temperature: 0.2 },
      }),
    );
    const blocks = out.output?.message?.content;
    const text = blocks?.map((b) => ("text" in b ? b.text : "")).join("")?.trim() ?? "";
    return text || null;
  } catch (err: unknown) {
    console.warn(
      JSON.stringify({
        type: "scenario.ai_generate_fallback",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return null;
  }
}

export async function generateScenarioFromPrompt(
  situationDescription: string,
  _agencyId: string,
  vertical: ScenarioVertical,
): Promise<{ definition: ScenarioDefinition; params: GeneratedParams }> {
  const fallback = heuristicParams(situationDescription, vertical);
  const raw = await callAiWithSystemPrompt(
    SCENARIO_GENERATION_SYSTEM_PROMPT,
    `Convert this situation into a scenario:\n\n"${situationDescription}"\n\nVertical: ${vertical}`,
  );
  const params = raw ? parseGenerated(raw, fallback) : fallback;

  const meta = {
    id: "ai-generated" as const,
    label: params.scenarioLabel,
    vertical,
    description: situationDescription,
    estimatedDemoMinutes: params.estimatedDemoMinutes,
    tags: ["ai-generated", params.incidentType.toLowerCase()],
  };

  const definition: ScenarioDefinition = {
    ...meta,
    async execute(_id, runner) {
      const { id, checks } = await runStandardWalkthrough(runner, {
        type: params.incidentType,
        priority: params.priority,
        location: { displayName: params.locationHint },
        reporterMessage: params.callerMessage,
        reportMethod: params.reportMethod,
        aiSummary: params.aiSummary,
        cameraIds: params.cameraIds,
        units: params.suggestedUnits.map((unitType) => ({ unitId: unitType.toUpperCase(), unitType })),
        escalateReason: params.escalateToSupervisor
          ? `Auto-escalated: ${params.incidentType} — Priority ${params.priority}`
          : undefined,
      });
      return finish(meta, runner, id, checks, {
        incidentType: params.incidentType,
        priority: params.priority,
      });
    },
  };

  return { definition, params };
}
