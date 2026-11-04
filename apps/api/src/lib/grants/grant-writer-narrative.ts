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
/**
 * Keep Claude under the Lambda timeout so OpenAI can still run.
 * Default Lambda timeout is 180s; leave ~55s for OpenAI + overhead.
 */
const CLAUDE_TIMEOUT_MS = Math.max(
  30_000,
  Number.parseInt(process.env.GRANT_WRITER_CLAUDE_TIMEOUT_MS ?? "90000", 10) || 90_000,
);
const OPENAI_TIMEOUT_MS = 55_000;
/** Detailed multi-section narrative without blowing the Lambda wall clock. */
const MAX_OUTPUT_TOKENS = Math.max(
  4096,
  Math.min(
    16_384,
    Number.parseInt(process.env.GRANT_WRITER_MAX_TOKENS ?? "12288", 10) || 12_288,
  ),
);
/** gpt-4o completion cap; keep OpenAI fallback valid if GRANT_WRITER_MAX_TOKENS is higher. */
const OPENAI_MAX_OUTPUT_TOKENS = Math.min(MAX_OUTPUT_TOKENS, 16_384);

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

const STRING_SECTION_KEYS = [
  "executiveSummary",
  "statementOfNeed",
  "projectDescription",
  "evaluationPlan",
  "organizationalCapacity",
  "budgetNarrative",
  "sustainabilityPlan",
  "conclusion",
] as const;

const ARRAY_SECTION_KEYS = ["goalsAndObjectives", "implementationTimeline"] as const;

/** Extract known fields from truncated or messy model JSON when JSON.parse fails. */
export function salvageGrantWriterSections(rawText: string): GrantWriterSections | null {
  const cleaned = rawText.replace(/```json\n?|```\n?/g, "").trim();
  const withPrefill = cleaned.startsWith("{") ? cleaned : `{${cleaned}`;
  const found: Record<string, unknown> = {};
  let hit = 0;

  for (const key of STRING_SECTION_KEYS) {
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
    const match = withPrefill.match(re);
    if (!match) continue;
    try {
      found[key] = JSON.parse(`"${match[1]}"`) as string;
      hit += 1;
    } catch {
      found[key] = match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
      hit += 1;
    }
  }

  for (const key of ARRAY_SECTION_KEYS) {
    const re = new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)(?:\\]|$)`);
    const match = withPrefill.match(re);
    if (!match) continue;
    const items: string[] = [];
    const itemRe = /"((?:\\.|[^"\\])*)"/g;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRe.exec(match[1])) !== null) {
      try {
        items.push(JSON.parse(`"${itemMatch[1]}"`) as string);
      } catch {
        items.push(itemMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'));
      }
    }
    if (items.length > 0) {
      found[key] = items;
      hit += 1;
    }
  }

  if (hit < 3) return null;
  return normalizeGrantWriterSections(found);
}

export function buildGrantWriterPrompt(form: Record<string, unknown>): string {
  const modules = Array.isArray(form.rcModules) ? form.rcModules.join(", ") : "";
  const moduleList = Array.isArray(form.rcModules)
    ? form.rcModules.filter((m): m is string => typeof m === "string" && m.trim().length > 0)
    : [];
  const moduleGuidance =
    moduleList.length > 0
      ? moduleList.map((m) => `- Expand how "${m}" will be used in day-to-day operations at this agency.`).join("\n")
      : "- Expand how the NexCort iQ core platform will be used in day-to-day operations.";

  return `You are an expert grant writer specializing in public safety technology grants for 911 centers, dispatch agencies, law enforcement, fire rescue, and EMS agencies. Write professional, compelling, federally-compliant grant narratives suitable for DOJ, COPS, FEMA, Byrne JAG, HSGP, ARPA/SLFRF, and state criminal justice reviewers.

Write a COMPLETE, DETAILED grant response for the following application. Reviewers expect substance: specific operational language, implementation steps, measurable objectives, evaluation methods, budget justification, and sustainability — without inventing statistics the agency did not provide.

LENGTH AND DEPTH REQUIREMENTS (do not underwrite):
- executiveSummary: 4–5 substantial paragraphs (who/what/why/how/safeguards).
- statementOfNeed: 5–6 paragraphs covering operational problem, staffing, existing technology gaps, community impact, and why this funder/program fits. Incorporate additional context when provided.
- projectDescription: 6–8 paragraphs covering approach, each selected module's operational use, role isolation, training/change management, AWS hosting/tenant isolation, and immutable 911 transfer.
- goalsAndObjectives: 6–8 SMART-style objectives (one sentence each, numbered Goal/Objective with a measurable or verifiable outcome). Do not invent crime or response-time numbers.
- implementationTimeline: 6–8 phased bullets spanning the full project period (kickoff, configure, train/pilot, operate, report, closeout).
- evaluationPlan: 4–5 paragraphs with indicators, data sources, reporting cadence, and who owns evaluation.
- organizationalCapacity: 4–5 paragraphs (ops capacity, technical capacity, key personnel, fiscal/grant admin).
- budgetNarrative: 4–5 paragraphs tying the requested amount to subscription, implementation, training, and what is NOT covered (CAD/radio).
- sustainabilityPlan: 3–4 paragraphs (funding after award, knowledge retention, technical ownership, continued metrics).
- conclusion: 2–3 paragraphs restating ask, need, and the assist-not-replace posture.

Use specific, quantified language ONLY when the applicant supplied the figure. Write in a professional tone appropriate for government grant reviewers. Separate paragraphs with \\n\\n inside JSON strings.

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
- Contact: ${form.contactName || ""} ${form.contactTitle ? `(${form.contactTitle})` : ""} ${form.contactEmail ? `<${form.contactEmail}>` : ""}

PROJECT:
- Title: ${form.projectTitle || "AI-Powered Public Safety Communications Intelligence System"}
- Technology: NexCort iQ — public safety intelligence that assists dispatchers and does not replace them
- Modules: ${modules || "Core platform"}
- Existing Technology: ${form.existingTechnology || "Not specified"}
- Staffing Challenge: ${form.staffingChallenge || "Not specified"}

MODULE DETAIL TO INCLUDE:
${moduleGuidance}

PROBLEM STATEMENT:
${form.problemStatement || "Agency faces operational challenges including staffing shortages, outdated technology, and increasing call volumes."}

PROJECT DESCRIPTION:
${form.projectDescription}

ADDITIONAL CONTEXT:
${form.additionalContext || "None."}

ABOUT NEXCORT IQ (facts you may use — do not invent others):
NexCort iQ is a public safety intelligence platform that assists — and does not replace — CAD systems, dispatchers, or responders. It provides real-time transcription, supervisor dashboards, automated QA, incident command tools, multi-language translation, silent text/caller media where configured, and post-incident analytics. It is hosted on Amazon Web Services with per-agency data isolation and administrative audit trails. It can connect to Tyler Technologies, Motorola, CentralSquare, Hexagon, and ProPhoenix when that agency's interface is configured. CAD write-back is fail-closed and never assumed. Emergency transfer to 911 is immutable and cannot be suppressed by configuration. Do not invent crime statistics, response-time savings, awards, or certifications the agency did not provide.

Finish the entire JSON object. Prefer complete, valid JSON over an unfinished longer draft. If space is tight, shorten later sections slightly rather than omitting keys.

Respond ONLY with a valid JSON object — no markdown, no preamble:
{
  "executiveSummary": "4-5 paragraphs separated by \\\\n\\\\n...",
  "statementOfNeed": "5-6 paragraphs...",
  "projectDescription": "6-8 paragraphs...",
  "goalsAndObjectives": ["Objective 1: ...", "Objective 2: ...", "Objective 3: ...", "Objective 4: ...", "Objective 5: ...", "Objective 6: ..."],
  "implementationTimeline": ["Month 1: ...", "Months 1-2: ...", "Months 2-3: ...", "Months 3-6: ...", "Months 6-12: ...", "Closeout: ..."],
  "evaluationPlan": "4-5 paragraphs...",
  "organizationalCapacity": "4-5 paragraphs...",
  "budgetNarrative": "4-5 paragraphs justifying the requested amount...",
  "sustainabilityPlan": "3-4 paragraphs...",
  "conclusion": "2-3 paragraphs..."
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
    const salvaged = salvageGrantWriterSections(rawText);
    if (salvaged) {
      console.info(
        JSON.stringify({
          msg: "grant_writer_json_salvaged",
          provider,
          chars: rawText.length,
        }),
      );
      return salvaged;
    }
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
      max_tokens: MAX_OUTPUT_TOKENS,
      // claude-sonnet-4-6 (and newer) reject assistant prefill — end on a user turn.
      messages: [{ role: "user", content: buildGrantWriterPrompt(form) }],
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
  const rawText = (payload.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("");

  if (payload.stop_reason === "max_tokens") {
    const salvaged = (() => {
      try {
        return parseGrantJson(rawText, "Claude");
      } catch {
        return null;
      }
    })();
    if (salvaged) {
      console.info(JSON.stringify({ msg: "grant_writer_claude_truncated_salvaged", chars: rawText.length }));
      return salvaged;
    }
    throw new Error("Claude cut the narrative off before it finished. Please try again.");
  }

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
      max_tokens: OPENAI_MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a senior public-safety grant writer. Return ONLY valid JSON matching the requested schema — no markdown. Write detailed, funder-ready narrative sections.",
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
    choices?: { message?: { content?: string }; finish_reason?: string }[];
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
      // Timeouts burn most of the Lambda budget — skip a second Claude attempt and use OpenAI.
      if (attempt === 1 && isRetryableProviderError(err) && !isProviderTimeout(err)) {
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
  // Any Claude failure (not only timeouts/429s) — keep demos off the profile fallback when OpenAI works.
  if (openAiKey) {
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
