import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  generateGrantPackageRequestSchema,
  GRANT_PROGRAM_LABELS,
  GRANT_SCHOOL_TYPE_LABELS,
  grantPackageSchema,
  type GrantPackage,
  type GrantSuccessProfile,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, isRcAdmin, isRcSuperAdmin } from "rapid-cortex-security";
import "../../lib/env.js"; // hydrate RC_RUNTIME_CONFIG_JSON (OPENAI/ANTHROPIC secret ARNs)
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { makeId } from "../../lib/ids.js";
import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";
import { badRequestFromZod, ok, serverError, unauthorized } from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";

const auditRepo = new AuditRepository();

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-8";
const DEFAULT_OPENAI_MODEL = "gpt-4.1";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

type AnthropicMessagesResponse = {
  content?: { type: string; text?: string }[];
  error?: { type?: string; message?: string };
};

type OpenAiChatResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!isRcSuperAdmin(user.role) && !isRcAdmin(user.role)) {
    return ok({ error: "Forbidden — platform admin access required" }, 403);
  }

  const bodyRaw =
    event.isBase64Encoded && event.body
      ? Buffer.from(event.body, "base64").toString("utf8")
      : (event.body ?? "{}");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(bodyRaw);
  } catch {
    return ok({ error: "Invalid JSON body" }, 400);
  }

  const parsed = generateGrantPackageRequestSchema.safeParse(parsedJson);
  if (!parsed.success) return badRequestFromZod(parsed.error);
  const { form } = parsed.data;

  let grantPackage: GrantPackage;
  try {
    grantPackage =
      process.env.GRANT_GENERATE_MOCK === "true"
        ? mockGrantPackage(form)
        : await generateGrantPackage(form);
  } catch (error) {
    if (error instanceof AnthropicCallError) {
      console.error("[generateGrantPackage] generation error:", error.message);
      return ok({ error: error.message }, error.upstream ? 502 : 503);
    }
    console.error("[generateGrantPackage]", error);
    return serverError();
  }

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: "platform",
    actorId: user.userId,
    type: AUDIT_EVENT_TYPES.GRANT_PACKAGE_GENERATED,
    details: {
      schoolName: form.schoolName,
      city: form.city,
      state: form.state,
      grantPrograms: form.grantPrograms,
      totalBudget: grantPackage.totalBudget,
    },
    createdAt: new Date().toISOString(),
    resourceType: "grant_package",
    resourceId: form.schoolName,
  });

  return ok(grantPackage);
};

class AnthropicCallError extends Error {
  upstream: boolean;
  constructor(message: string, upstream: boolean) {
    super(message);
    this.upstream = upstream;
  }
}

async function generateGrantPackage(form: GrantSuccessProfile): Promise<GrantPackage> {
  const anthropicKey = await resolvePlainOrSecretArn(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY_SECRET_ARN,
    // Secrets Manager JSON for rapid-cortex/ai/anthropic uses { "apiKey": "sk-ant-..." }
    { preferredField: "apiKey" },
  );
  if (anthropicKey) {
    return parseAndValidatePackage(await callAnthropic(anthropicKey, form));
  }

  const openAiKey = await resolvePlainOrSecretArn(
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_API_KEY_SECRET_ARN,
    { preferredField: "OPENAI_API_KEY" },
  );
  if (openAiKey) {
    console.info("[generateGrantPackage] Anthropic unset — using OpenAI");
    return parseAndValidatePackage(await callOpenAi(openAiKey, form));
  }

  const bedrockModel =
    process.env.GRANT_GENERATE_BEDROCK_MODEL_ID?.trim() ||
    process.env.QA_BEDROCK_MODEL_ID?.trim() ||
    process.env.BEDROCK_MODEL_PRIMARY?.trim() ||
    "";
  if (bedrockModel) {
    console.info("[generateGrantPackage] No vendor API keys — using Bedrock", { bedrockModel });
    return parseAndValidatePackage(await callBedrock(bedrockModel, form));
  }

  console.error(
    "[generateGrantPackage] No Anthropic, OpenAI, or Bedrock model configured (AnthropicApiKeySecretArn empty)",
  );
  throw new AnthropicCallError(
    "Generation service unavailable — configure AnthropicApiKeySecretArn or OpenAI secret, or set GRANT_GENERATE_BEDROCK_MODEL_ID",
    false,
  );
}

async function callAnthropic(apiKey: string, form: GrantSuccessProfile): Promise<string> {
  const model = process.env.GRANT_GENERATE_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
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
        max_tokens: 8000,
        messages: [{ role: "user", content: buildPrompt(form) }],
      }),
    });
  } catch (err) {
    console.error("[generateGrantPackage] Anthropic fetch error:", err);
    throw new AnthropicCallError("Generation service unreachable", false);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[generateGrantPackage] Anthropic API error ${res.status}:`, errText);
    throw new AnthropicCallError(`Generation failed (upstream ${res.status})`, true);
  }

  const data = (await res.json()) as AnthropicMessagesResponse;
  return data.content?.find((b) => b.type === "text")?.text ?? "";
}

async function callOpenAi(apiKey: string, form: GrantSuccessProfile): Promise<string> {
  const model = process.env.GRANT_GENERATE_OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  let res: Response;
  try {
    res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a senior grant writer. Return ONLY valid JSON matching the requested schema — no markdown.",
          },
          { role: "user", content: buildPrompt(form) },
        ],
      }),
    });
  } catch (err) {
    console.error("[generateGrantPackage] OpenAI fetch error:", err);
    throw new AnthropicCallError("Generation service unreachable", false);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[generateGrantPackage] OpenAI API error ${res.status}:`, errText);
    throw new AnthropicCallError(`Generation failed (upstream ${res.status})`, true);
  }

  const data = (await res.json()) as OpenAiChatResponse;
  return data.choices?.[0]?.message?.content ?? "";
}

async function callBedrock(modelId: string, form: GrantSuccessProfile): Promise<string> {
  const region = process.env.BEDROCK_REGION?.trim() || process.env.AWS_REGION?.trim() || "us-east-1";
  const client = new BedrockRuntimeClient({ region });
  try {
    const out = await client.send(
      new ConverseCommand({
        modelId,
        system: [
          {
            text:
              "You are a senior grant writer. Return ONLY valid JSON matching the requested schema — no markdown fences.",
          },
        ],
        messages: [{ role: "user", content: [{ text: buildPrompt(form) }] }],
        inferenceConfig: { maxTokens: 8000, temperature: 0.2 },
      }),
    );
    const blocks = out.output?.message?.content;
    return blocks?.map((b) => ("text" in b ? b.text ?? "" : "")).join("")?.trim() ?? "";
  } catch (err) {
    console.error("[generateGrantPackage] Bedrock error:", err);
    throw new AnthropicCallError("Generation service unreachable (Bedrock)", false);
  }
}

function parseAndValidatePackage(rawText: string): GrantPackage {
  const cleaned = rawText
    .replace(/^\s*```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();

  let candidate: unknown;
  try {
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    const slice =
      jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
    candidate = JSON.parse(slice);
  } catch {
    console.error("[generateGrantPackage] JSON parse failed. Raw text length:", rawText.length);
    throw new AnthropicCallError("Could not parse generated grant package", true);
  }

  const validated = grantPackageSchema.safeParse(candidate);
  if (!validated.success) {
    console.error("[generateGrantPackage] Schema validation failed:", validated.error.message);
    throw new AnthropicCallError("Generated grant package failed validation", true);
  }
  return validated.data;
}

function buildPrompt(form: GrantSuccessProfile): string {
  const programLabels = form.grantPrograms.map((id) => GRANT_PROGRAM_LABELS[id]).join(", ");
  const schoolTypeLabel = GRANT_SCHOOL_TYPE_LABELS[form.schoolType];

  return `You are a senior grant writer specializing in public safety technology grants for educational institutions and municipal / state / county agencies. Generate a comprehensive, customized grant package for Rapid Cortex — a next-generation public safety intelligence and reporting platform.

Rapid Cortex features: anonymous/identified emergency reporting via QR codes and NFC tags; real-time incident management dashboard; AI-assisted triage and incident pattern recognition; mass notification coordination; CJIS-aware/FERPA-compliant architecture where applicable; CAD system integration; 40+ language multilingual support; live camera feed integration (KVS/WebRTC); predictive analytics; mobile app for staff/responders; audit trails and chain-of-custody documentation.

APPLICANT:
- Name: ${form.schoolName}
- Type: ${schoolTypeLabel}
- Location: ${form.city}, ${form.state}
- Student population: ${form.studentPopulation}
- Campuses: ${form.campusCount}
- Buildings: ${form.buildingCount || "not specified"}
- Residence halls: ${form.residenceHalls || "0"}
- Campus police: ${form.campusPolice === "yes" ? `Yes (${form.officerCount || "TBD"} officers)` : form.campusPolice === "contract" ? "Contract security" : "None"}

CURRENT SAFETY INFRASTRUCTURE:
- Emergency notification system: ${form.existingENS || "None"}
- Blue light phones: ${form.blueLight === "yes" ? `Yes, ${form.blueLightCount || "TBD"} units` : "None"}
- Access control: ${form.accessControl === "yes" ? "Full" : form.accessControl === "partial" ? "Partial" : "Limited/none"}
- Cameras: ${form.cameraCount || "not specified"}
- CAD system: ${form.cadSystem === "yes" ? "Yes" : "No"}
- Current reporting: ${form.reportingProcess || "standard 911/phone"}
- Mutual aid: ${form.mutualAid || "local law enforcement"}

SAFETY CONCERNS: ${form.safetyConcerns || "general campus safety, reporting accessibility, situational awareness gaps"}

GRANT PROGRAMS: ${programLabels}
REQUESTED AMOUNT: $${form.grantAmount || "110000"}
PROJECT PERIOD: ${form.projectPeriod} months
ADDITIONAL CONTEXT: ${form.additionalContext || "standard campus deployment"}

Return ONLY valid JSON — no markdown, no code blocks, no preamble. Exact structure:
{
  "executiveSummary": "4-paragraph executive summary specific to ${form.schoolName}",
  "problemStatement": "3-paragraph problem statement with specific campus safety context",
  "projectNarrative": "5-paragraph detailed project narrative specific to this institution",
  "technologyDescription": "3-paragraph technology description tailored to this campus",
  "budget": [
    {"item": "item name", "quantity": 1, "unitCost": 0, "totalCost": 0, "category": "Platform|Services|Hardware|Training|Support"}
  ],
  "totalBudget": 0,
  "budgetJustification": "3-paragraph justification of all budget categories",
  "timeline": [
    {"phase": "Phase name", "period": "Mth X–Y", "milestones": ["milestone1", "milestone2", "milestone3"]}
  ],
  "cybersecurity": "3-paragraph cybersecurity section addressing FERPA, CJIS alignment, encryption, access controls",
  "sustainability": "2-paragraph sustainability plan for post-grant period",
  "evaluation": "2-paragraph evaluation and performance measurement plan",
  "outcomes": [
    {"metric": "metric name", "baseline": "current state", "target": "goal after implementation", "timeframe": "by month X"}
  ]
}

Include 7–9 budget line items totaling close to the requested amount. Include 5–6 timeline phases. Include 6 measurable outcomes. Make every section specific to ${form.schoolName}. Be detailed, professional, and grant-committee-ready. Avoid generic language.`;
}

/** Deterministic offline package for local/CI runs (GRANT_GENERATE_MOCK=true). */
function mockGrantPackage(form: GrantSuccessProfile): GrantPackage {
  const amount = Number.parseInt(form.grantAmount || "110000", 10) || 110000;
  return {
    executiveSummary: `Mock executive summary for ${form.schoolName}.`,
    problemStatement: `Mock problem statement for ${form.schoolName}.`,
    projectNarrative: `Mock project narrative for ${form.schoolName}.`,
    technologyDescription: "Mock technology description.",
    budget: [
      {
        item: "Rapid Cortex Campus platform license",
        quantity: 1,
        unitCost: amount,
        totalCost: amount,
        category: "Platform",
      },
    ],
    totalBudget: amount,
    budgetJustification: "Mock budget justification.",
    timeline: [
      { phase: "Deployment", period: `Mth 1–${form.projectPeriod}`, milestones: ["Kickoff", "Go-live"] },
    ],
    cybersecurity: "Mock cybersecurity section.",
    sustainability: "Mock sustainability plan.",
    evaluation: "Mock evaluation plan.",
    outcomes: [
      { metric: "Reporting response time", baseline: "Unmeasured", target: "Sub-60s", timeframe: "By month 6" },
    ],
  };
}
