import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";
import {
  buildProfileGrantNarrative,
  fillEmptyGrantNarrative,
  type GrantNarrativeSections,
} from "./profile-narrative.js";

const CLAUDE_MODEL = "claude-sonnet-4-6";
const OPENAI_MODEL = "gpt-4o";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const OPENAI_API = "https://api.openai.com/v1/chat/completions";
/** Leave the rest of the 180s Lambda budget for an OpenAI completion. */
const CLAUDE_TIMEOUT_MS = 90_000;
const OPENAI_TIMEOUT_MS = 70_000;

export type GrantWriterSections = GrantNarrativeSections;

export type GrantWriterResult = {
  sections: GrantWriterSections;
  /** model = Claude or OpenAI. profile = written from the application because the model was unavailable. */
  source: "model" | "profile";
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

export function normalizeGrantWriterSections(raw: Record<string, unknown>): GrantWriterSections {
  return {
    executiveSummary: String(raw.executiveSummary ?? ""),
    statementOfNeed: String(raw.statementOfNeed ?? ""),
    projectDescription: String(raw.projectDescription ?? ""),
    goalsAndObjectives: asStringArray(raw.goalsAndObjectives),
    implementationTimeline: asStringArray(raw.implementationTimeline),
    evaluationPlan: String(raw.evaluationPlan ?? ""),
    organizationalCapacity: String(raw.organizationalCapacity ?? ""),
    budgetNarrative: String(raw.budgetNarrative ?? ""),
    sustainabilityPlan: String(raw.sustainabilityPlan ?? ""),
    conclusion: String(raw.conclusion ?? ""),
  };
}

export function buildGrantWriterPrompt(form: Record<string, unknown>): string {
  const modules = Array.isArray(form.rcModules) ? form.rcModules.join(", ") : "";

  return `You are an expert grant writer specializing in public safety technology grants for 911 centers, dispatch agencies, law enforcement, fire rescue, and EMS agencies. Write professional, compelling, federally-compliant grant narratives.

Write a complete grant response for the following application. Use specific, quantified language. Write in a professional tone appropriate for government grant reviewers.

GRANT OPPORTUNITY:
- Grant Program: ${form.grantName || "Not specified"}
- Funding Agency: ${form.fundingAgency || "Not specified"}
- Solicitation Number: ${form.grantNumber || "Not specified"}
- Amount Requested: ${form.requestedAmount || "Not specified"}
- Project Period: ${form.projectPeriod || "Not specified"}
- Deadline: ${form.deadline || "Not specified"}

APPLICANT AGENCY:
- Agency Name: ${form.agencyName}
- Agency Type: ${form.agencyType || "Public Safety Agency"}
- Location: ${[form.agencyCity, form.agencyState].filter(Boolean).join(", ") || "Not specified"}
- Service Population: ${form.agencyPopulation || "Not specified"}
- Contact: ${form.contactName || ""} ${form.contactTitle ? `(${form.contactTitle})` : ""}

PROJECT:
- Title: ${form.projectTitle || "AI-Powered Public Safety Communications Intelligence System"}
- Technology: NexCort iQ — public safety intelligence that assists dispatchers and does not replace them
- Modules: ${modules || "Core platform"}
- Existing Technology: ${form.existingTechnology || "Not specified"}
- Staffing Challenge: ${form.staffingChallenge || "Not specified"}

PROBLEM STATEMENT:
${form.problemStatement || "Agency faces operational challenges including staffing shortages, outdated technology, and increasing call volumes."}

PROJECT DESCRIPTION:
${form.projectDescription}

ADDITIONAL CONTEXT:
${form.additionalContext || "None."}

ABOUT NEXCORT IQ:
NexCort iQ is a public safety intelligence platform that assists — and does not replace — CAD systems, dispatchers, or responders. It provides real-time transcription, supervisor dashboards, automated QA, incident command tools, multi-language translation, and post-incident analytics. It is hosted on Amazon Web Services and can connect to Tyler Technologies, Motorola, CentralSquare, Hexagon, and ProPhoenix when that agency's interface is configured. Do not invent crime statistics, response-time savings, or awards the agency did not provide.

Keep each paragraph to 2–4 sentences and each bullet to one sentence so the JSON finishes completely.

Respond ONLY with a valid JSON object — no markdown, no preamble:
{
  "executiveSummary": "2-3 paragraphs...",
  "statementOfNeed": "3-4 paragraphs with specific challenges...",
  "projectDescription": "4-5 paragraphs with implementation approach...",
  "goalsAndObjectives": ["Goal 1: ...", "Goal 2: ...", "Goal 3: ...", "Goal 4: ..."],
  "implementationTimeline": ["Month 1-3: ...", "Month 4-6: ...", "Month 7-12: ..."],
  "evaluationPlan": "2-3 paragraphs with metrics...",
  "organizationalCapacity": "2-3 paragraphs...",
  "budgetNarrative": "2-3 paragraphs justifying the requested amount...",
  "sustainabilityPlan": "2 paragraphs...",
  "conclusion": "1-2 paragraphs..."
}`;
}

function isProviderTimeout(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "TimeoutError" || err.name === "AbortError";
}

function isRetryableProviderError(err: unknown): boolean {
  if (isProviderTimeout(err)) return true;
  if (!(err instanceof Error)) return false;
  return /\b(429|500|502|503|529)\b/.test(err.message);
}

function grantWriterMockEnabled(): boolean {
  const flag = process.env.GRANT_WRITER_MOCK?.trim().toLowerCase();
  return flag === "1" || flag === "true";
}

function parseGrantJson(rawText: string, provider: "Claude" | "OpenAI"): GrantWriterSections {
  const cleaned = rawText.replace(/```json\n?|```\n?/g, "").trim();
  const withPrefill = cleaned.startsWith("{") ? cleaned : `{${cleaned}`;
  const start = withPrefill.indexOf("{");
  const end = withPrefill.lastIndexOf("}");
  const jsonText = start >= 0 && end > start ? withPrefill.slice(start, end + 1) : withPrefill;
  try {
    return normalizeGrantWriterSections(JSON.parse(jsonText) as Record<string, unknown>);
  } catch {
    console.error(
      JSON.stringify({
        msg: "grant_writer_json_parse_failed",
        provider,
        chars: rawText.length,
        startsWithBrace: cleaned.startsWith("{"),
      }),
    );
    throw new Error(`${provider} returned an unexpected format. Please try again.`);
  }
}

async function generateWithClaude(form: Record<string, unknown>, apiKey: string): Promise<GrantWriterSections> {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.GRANT_WRITER_MODEL?.trim() || CLAUDE_MODEL,
      max_tokens: 8192,
      messages: [
        { role: "user", content: buildGrantWriterPrompt(form) },
        { role: "assistant", content: "{" },
      ],
    }),
    signal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 200)}`);
  }

  const payload = (await res.json()) as {
    stop_reason?: string;
    content?: { type: string; text?: string }[];
  };
  if (payload.stop_reason === "max_tokens") {
    throw new Error("Claude cut the narrative off before it finished. Please try again.");
  }
  const rawText = (payload.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("");
  return parseGrantJson(rawText, "Claude");
}

async function generateWithOpenAi(form: Record<string, unknown>, apiKey: string): Promise<GrantWriterSections> {
  const res = await fetch(OPENAI_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GRANT_WRITER_OPENAI_MODEL?.trim() || OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a senior grant writer. Return ONLY valid JSON matching the requested schema — no markdown.",
        },
        { role: "user", content: buildGrantWriterPrompt(form) },
      ],
    }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const quota = res.status === 429 && /insufficient_quota|exceeded your current quota/i.test(text);
    throw new Error(
      quota
        ? "OpenAI quota exceeded — add billing/credits at platform.openai.com"
        : `OpenAI API ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const rawText = payload.choices?.[0]?.message?.content ?? "";
  return parseGrantJson(rawText, "OpenAI");
}

function profileResult(form: Record<string, unknown>, reason: string): GrantWriterResult {
  console.info(JSON.stringify({ msg: "grant_writer_profile_narrative", reason }));
  return { sections: buildProfileGrantNarrative(form), source: "profile" };
}

export async function generateGrantWriterSections(
  form: Record<string, unknown>,
): Promise<GrantWriterResult> {
  if (grantWriterMockEnabled()) {
    return profileResult(form, "mock");
  }

  const apiKey = await resolvePlainOrSecretArn(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
  if (!apiKey) {
    return profileResult(form, "anthropic_unconfigured");
  }

  let claudeError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const sections = fillEmptyGrantNarrative(await generateWithClaude(form, apiKey), form);
      return { sections, source: "model" };
    } catch (err) {
      claudeError = err;
      if (attempt === 1 && isRetryableProviderError(err)) {
        console.info(JSON.stringify({ msg: "grant_writer_claude_retry" }));
        continue;
      }
      break;
    }
  }

  if (!isRetryableProviderError(claudeError) && !isProviderTimeout(claudeError)) {
    console.error(
      JSON.stringify({
        msg: "grant_writer_claude_failed",
        error: claudeError instanceof Error ? claudeError.message.slice(0, 180) : "unknown",
      }),
    );
  }

  const openAiKey = await resolvePlainOrSecretArn(
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_API_KEY_SECRET_ARN,
    { preferredField: "OPENAI_API_KEY" },
  );
  if (openAiKey && (isRetryableProviderError(claudeError) || isProviderTimeout(claudeError))) {
    try {
      console.info(JSON.stringify({ msg: "grant_writer_openai_fallback" }));
      const sections = fillEmptyGrantNarrative(await generateWithOpenAi(form, openAiKey), form);
      return { sections, source: "model" };
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "grant_writer_openai_failed",
          error: err instanceof Error ? err.message.slice(0, 180) : "unknown",
        }),
      );
    }
  }

  return profileResult(form, "providers_unavailable");
}
