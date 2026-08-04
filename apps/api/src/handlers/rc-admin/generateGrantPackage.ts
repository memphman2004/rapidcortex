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
  normalizeGrantPackageCandidate,
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
/** Fast model — API Gateway HTTP API hard-caps at 30s; opus often exceeds that.
 *  claude-3-5-haiku-20241022 retired 2026-02-19 — use Haiku 4.5. */
const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
/**
 * Grant packages are rare; give Anthropic most of a 60s Lambda budget.
 * Sync HTTP via API Gateway still hard-caps at 30s — the web BFF should
 * Invoke this Lambda directly (GRANT_GENERATE_FUNCTION_NAME) for the full budget.
 */
const ANTHROPIC_TIMEOUT_MS = Math.max(
  20_000,
  Number.parseInt(process.env.GRANT_GENERATE_PROVIDER_TIMEOUT_MS ?? "55000", 10) || 55_000,
);
const OPENAI_TIMEOUT_MS = Math.max(
  6_000,
  Number.parseInt(process.env.GRANT_GENERATE_OPENAI_TIMEOUT_MS ?? "15000", 10) || 15_000,
);
const BEDROCK_TIMEOUT_MS = Math.max(
  8_000,
  Number.parseInt(process.env.GRANT_GENERATE_BEDROCK_TIMEOUT_MS ?? "20000", 10) || 20_000,
);
const MAX_OUTPUT_TOKENS = Math.max(
  1500,
  Number.parseInt(process.env.GRANT_GENERATE_MAX_TOKENS ?? "4000", 10) || 4000,
);

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
  const errors: string[] = [];
  /** Opt-in only. Default path is Anthropic → OpenAI via API keys. */
  const allowBedrock =
    process.env.GRANT_GENERATE_ALLOW_BEDROCK === "true" ||
    process.env.GRANT_GENERATE_PREFER_BEDROCK === "true";

  const tryBedrock = async (): Promise<GrantPackage | null> => {
    const bedrockModel =
      process.env.GRANT_GENERATE_BEDROCK_MODEL_ID?.trim() ||
      process.env.QA_BEDROCK_MODEL_ID?.trim() ||
      process.env.BEDROCK_MODEL_PRIMARY?.trim() ||
      "us.anthropic.claude-haiku-4-5-20251001-v1:0";
    try {
      console.info("[generateGrantPackage] Using Bedrock", { bedrockModel });
      return parseAndValidatePackage(await callBedrock(bedrockModel, form));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[generateGrantPackage] Bedrock path failed:", msg);
      errors.push(`bedrock: ${msg}`);
      return null;
    }
  };

  // Optional: Bedrock-first when PREFER is set (fast path inside AWS).
  if (process.env.GRANT_GENERATE_PREFER_BEDROCK === "true") {
    const fromBedrock = await tryBedrock();
    if (fromBedrock) return fromBedrock;
  }

  // 1) Anthropic
  const anthropicKey = await resolvePlainOrSecretArn(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY_SECRET_ARN,
    // Secrets Manager JSON for rapid-cortex/ai/anthropic uses { "apiKey": "sk-ant-..." }
    { preferredField: "apiKey" },
  );
  if (anthropicKey) {
    try {
      console.info("[generateGrantPackage] Using Anthropic (primary)");
      return parseAndValidatePackage(await callAnthropic(anthropicKey, form));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[generateGrantPackage] Anthropic path failed — trying next:", msg);
      errors.push(`anthropic: ${msg}`);
    }
  } else {
    errors.push("anthropic: API key not configured");
  }

  // 2) OpenAI
  const openAiKey = await resolvePlainOrSecretArn(
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_API_KEY_SECRET_ARN,
    { preferredField: "OPENAI_API_KEY" },
  );
  if (openAiKey) {
    try {
      console.info("[generateGrantPackage] Using OpenAI (fallback)");
      return parseAndValidatePackage(await callOpenAi(openAiKey, form));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[generateGrantPackage] OpenAI path failed:", msg);
      errors.push(`openai: ${msg}`);
    }
  } else {
    errors.push("openai: API key not configured");
  }

  // 3) Bedrock (opt-in only via GRANT_GENERATE_ALLOW_BEDROCK=true)
  if (allowBedrock && process.env.GRANT_GENERATE_PREFER_BEDROCK !== "true") {
    const fromBedrock = await tryBedrock();
    if (fromBedrock) return fromBedrock;
  }

  console.error("[generateGrantPackage] All generation providers failed", {
    errors,
    hasAnthropic: Boolean(anthropicKey),
    hasOpenAi: Boolean(openAiKey),
    allowBedrock,
  });
  throw new AnthropicCallError(
    errors.length
      ? `Generation service unavailable (${errors.map((e) => e.split(":")[0]).join(" → ")})`
      : "Generation service unavailable — configure AnthropicApiKeySecretArn or OpenAI secret",
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
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: "user", content: buildPrompt(form) }],
      }),
      signal: AbortSignal.timeout(ANTHROPIC_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("[generateGrantPackage] Anthropic fetch error:", err);
    throw new AnthropicCallError(
      err instanceof Error && err.name === "TimeoutError"
        ? `Anthropic timed out after ${ANTHROPIC_TIMEOUT_MS}ms`
        : "Generation service unreachable",
      false,
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[generateGrantPackage] Anthropic API error ${res.status}:`, errText.slice(0, 500));
    throw new AnthropicCallError(`Anthropic failed (upstream ${res.status})`, true);
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
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("[generateGrantPackage] OpenAI fetch error:", err);
    throw new AnthropicCallError(
      err instanceof Error && err.name === "TimeoutError"
        ? `OpenAI timed out after ${OPENAI_TIMEOUT_MS}ms`
        : "Generation service unreachable",
      false,
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[generateGrantPackage] OpenAI API error ${res.status}:`, errText.slice(0, 500));
    const quota =
      res.status === 429 && /insufficient_quota|exceeded your current quota/i.test(errText);
    throw new AnthropicCallError(
      quota
        ? "OpenAI quota exceeded — add billing/credits at platform.openai.com"
        : `OpenAI failed (upstream ${res.status})`,
      true,
    );
  }

  const data = (await res.json()) as OpenAiChatResponse;
  return data.choices?.[0]?.message?.content ?? "";
}

async function callBedrock(modelId: string, form: GrantSuccessProfile): Promise<string> {
  const region = process.env.BEDROCK_REGION?.trim() || process.env.AWS_REGION?.trim() || "us-east-1";
  const client = new BedrockRuntimeClient({ region });
  const abort = AbortSignal.timeout(BEDROCK_TIMEOUT_MS);
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
        inferenceConfig: { maxTokens: MAX_OUTPUT_TOKENS, temperature: 0.2 },
      }),
      { abortSignal: abort },
    );
    const blocks = out.output?.message?.content;
    return blocks?.map((b) => ("text" in b ? b.text ?? "" : "")).join("")?.trim() ?? "";
  } catch (err) {
    console.error("[generateGrantPackage] Bedrock error:", err);
    throw new AnthropicCallError(
      err instanceof Error && err.name === "AbortError" ? "Bedrock timed out" : "Generation service unreachable (Bedrock)",
      false,
    );
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

  const validated = grantPackageSchema.safeParse(normalizeGrantPackageCandidate(candidate));
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

Keep sections compact and specific to ${form.schoolName}: 2 short paragraphs per narrative field (executiveSummary may be 3). Include 5–6 budget line items totaling close to the requested amount, 4 timeline phases, and 4 measurable outcomes. Professional, grant-committee-ready — no filler.`;
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
