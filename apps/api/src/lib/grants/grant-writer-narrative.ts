import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";

const CLAUDE_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

export type GrantWriterSections = {
  executiveSummary: string;
  statementOfNeed: string;
  projectDescription: string;
  goalsAndObjectives: string[];
  implementationTimeline: string[];
  evaluationPlan: string;
  organizationalCapacity: string;
  budgetNarrative: string;
  sustainabilityPlan: string;
  conclusion: string;
};

export function isGrantWriterMockMode(): boolean {
  return (
    process.env.GRANT_WRITER_MOCK === "1" ||
    process.env.GRANT_WRITER_MOCK === "true" ||
    process.env.GRANT_GENERATE_MOCK === "true"
  );
}

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
- Technology: Rapid Cortex — next-generation AI intelligence and decision-support platform
- Modules: ${modules || "Core platform"}
- Existing Technology: ${form.existingTechnology || "Not specified"}
- Staffing Challenge: ${form.staffingChallenge || "Not specified"}

PROBLEM STATEMENT:
${form.problemStatement || "Agency faces operational challenges including staffing shortages, outdated technology, and increasing call volumes."}

PROJECT DESCRIPTION:
${form.projectDescription}

ADDITIONAL CONTEXT:
${form.additionalContext || "None."}

ABOUT RAPID CORTEX:
Rapid Cortex is a public safety AI platform that enhances — does NOT replace — CAD systems, dispatchers, or responders. It provides real-time AI transcription, supervisor dashboards, automated QA, incident command tools, multi-language translation, and post-incident analytics. CJIS-compliant, AWS-hosted, integrates with Tyler Technologies, Motorola, CentralSquare, and Hexagon.

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

export function mockGrantWriterSections(form: Record<string, unknown>): GrantWriterSections {
  const agency = String(form.agencyName || "Applicant Agency");
  return normalizeGrantWriterSections({
    executiveSummary: `${agency} requests funding to deploy Rapid Cortex as a decision-support layer alongside existing CAD and telephony.`,
    statementOfNeed: `${agency} faces staffing pressure and increasing call complexity. This request does not replace 911 operations.`,
    projectDescription: String(form.projectDescription || "Deploy Rapid Cortex intelligence for dispatch operations."),
    goalsAndObjectives: [
      "Improve call documentation quality",
      "Reduce supervisor review latency",
      "Expand language coverage without replacing interpreters",
    ],
    implementationTimeline: ["Month 1-3: Configure and train", "Month 4-6: Pilot", "Month 7-12: Agency-wide"],
    evaluationPlan: "Track QA scores, time-to-dispatch documentation, and language-assist usage monthly.",
    organizationalCapacity: `${agency} will assign a project lead and retain existing CAD/telephony vendors.`,
    budgetNarrative: "Funds cover licensing, implementation, and training. No CAD replacement is requested.",
    sustainabilityPlan: "The agency will budget recurring licensing after the grant period.",
    conclusion: `${agency} will use Rapid Cortex to enhance — not replace — emergency communications.`,
  });
}

export async function generateGrantWriterSections(
  form: Record<string, unknown>,
): Promise<GrantWriterSections> {
  if (isGrantWriterMockMode()) return mockGrantWriterSections(form);

  const apiKey = await resolvePlainOrSecretArn(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
  if (!apiKey) {
    throw new Error("Anthropic secret is not configured (ANTHROPIC_API_KEY_SECRET_ARN).");
  }

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.GRANT_WRITER_MODEL?.trim() || CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: buildGrantWriterPrompt(form) }],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 200)}`);
  }

  const payload = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const rawText = (payload.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("");
  const cleaned = rawText.replace(/```json\n?|```\n?/g, "").trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error("Claude returned an unexpected format. Please try again.");
  }
  return normalizeGrantWriterSections(parsed);
}
