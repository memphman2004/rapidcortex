import type {
  RapidIqOpportunity,
  RapidIqSignal,
  RapidIqSource,
  SignalChatMessage,
} from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";
import { isCollectorsMockEnabled } from "./agenda-finder.js";
import { textMatchesUniversityTerms } from "./university-search-terms.js";

export type ClassifiedSignal = {
  isRelevant: boolean;
  signalType: RapidIqSignal["signalType"] | null;
  agencyName: string | null;
  agencyType: string | null;
  city: string | null;
  state: string | null;
  county: string | null;
  population: number | null;
  aiHeadline: string | null;
  aiSummary: string | null;
  excerpt: string | null;
  dollarValue: number | null;
  dollarValueContext: string | null;
  incumbentVendor: string | null;
  intentStage: RapidIqOpportunity["intentStage"] | null;
  rcProduct: RapidIqOpportunity["rcProduct"] | null;
  tags: string[];
  mentionedEntities: Array<{ name: string; role: string }>;
  scoreContrib: number;
  confidence: "high" | "medium" | "low";
  vertical: RapidIqOpportunity["vertical"];
  /** Direct PDF / document URL when known (agenda collector). */
  sourceDocUrl?: string | null;
};

async function resolveAnthropicKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY_SECRET_ARN,
    { preferredField: "ANTHROPIC_API_KEY" },
  );
}

function parseJsonLoose<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim()) as T;
  } catch {
    return fallback;
  }
}

async function callClaude(system: string, user: string, maxTokens: number): Promise<string> {
  if (isCollectorsMockEnabled()) return "";
  const apiKey = await resolveAnthropicKey();
  if (!apiKey) return "";

  const model = process.env.ANTHROPIC_MODEL_PRIMARY?.trim() || "claude-sonnet-4-20250514";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    console.warn(
      JSON.stringify({
        msg: "rapid_iq_claude_http_error",
        status: res.status,
        model,
      }),
    );
    return "";
  }
  const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return body.content?.find((b) => b.type === "text")?.text ?? "";
}

function classifySignalHeuristic(
  rawText: string,
  sourceName: string,
): ClassifiedSignal {
  const lower = rawText.toLowerCase();
  const isCampus = textMatchesUniversityTerms(rawText);
  const relevant =
    isCampus ||
    lower.includes("911") ||
    lower.includes("dispatch") ||
    lower.includes("ng911") ||
    lower.includes("public safety") ||
    lower.includes("cad") ||
    lower.includes("emergency communications") ||
    lower.includes("psap");
  return {
    isRelevant: relevant,
    signalType: lower.includes("grant") ? "grant" : lower.includes("rfp") ? "rfp" : "budget",
    agencyName: sourceName,
    agencyType: isCampus ? "university" : "county_911",
    city: null,
    state: null,
    county: sourceName,
    population: null,
    aiHeadline: isCampus
      ? `${sourceName} discussing campus safety technology investment`
      : `${sourceName} discussing public safety technology investment`,
    aiSummary: isCampus
      ? [
          `The source materials from ${sourceName} discuss campus safety technology modernization and Clery Act–related compliance tooling.`,
          `${sourceName} appears to be evaluating student safety platforms and emergency notification upgrades for campus police operations.`,
          `Rapid Cortex Campus fits with real-time incident intelligence, QR wayfinding, and campus public-safety workflows tied to this evaluation.`,
          `Outreach should happen while the safety technology budget cycle is open — ideally before the next board or cabinet decision window.`,
        ].join(" ")
      : [
          `The meeting materials from ${sourceName} discuss CAD/NG911 modernization and AI-assisted dispatch tooling under active review.`,
          `The agency is working through public safety communications upgrades and evaluating software that improves call-taking and supervisor coaching.`,
          `Rapid Cortex Core's real-time transcription, AI coaching, and CAD integration directly address the AI dispatch capabilities under discussion.`,
          `Outreach should happen before the next commission or board vote while the budget approval window remains open.`,
        ].join(" "),
    excerpt: isCampus ? "campus safety software procurement" : "public safety software procurement",
    dollarValue: lower.includes("$") ? 1250000 : null,
    dollarValueContext: "budget line item",
    incumbentVendor: null,
    intentStage: "evaluation",
    rcProduct: isCampus ? "campus" : "core",
    tags: isCampus ? ["CAMPUS SAFETY", "OPPORTUNITY"] : ["OPPORTUNITY", "PSAP SOFTWARE"],
    mentionedEntities: [
      {
        name: isCampus ? "Campus Police Chief" : "Communications Director",
        role: "procurement contact",
      },
    ],
    scoreContrib: relevant ? 18 : 0,
    confidence: "medium",
    vertical: isCampus ? "campus" : "911",
  };
}

export async function classifySignal(
  rawText: string,
  sourceUrl: string,
  sourceName: string,
): Promise<ClassifiedSignal> {
  if (isCollectorsMockEnabled() || !(await resolveAnthropicKey())) {
    return classifySignalHeuristic(rawText, sourceName);
  }

  const text = await callClaude(
    `You are a public safety technology sales intelligence analyst for Rapid Cortex.
Cover PSAP/911 (Core), campus/university safety (Campus), and venue operations (Venue).
University signals often involve Board of Trustees, campus police, Clery Act, Title IX, or student safety fees.
Extract only factual information present in the document. Never invent information. Respond ONLY with valid JSON.

SUMMARY QUALITY RULES:
- aiSummary must be 3-4 complete sentences. A single sentence is a FAILURE.
- Always name the specific government document or meeting (e.g. "The July 14 budget workshop agenda" not "a document").
- Always state the dollar amount if one appears in the text.
- Always name the incumbent vendor if one is mentioned.
- Always connect to a specific Rapid Cortex feature (real-time transcription, CAD integration, AI coaching, LiveLocation, etc.).
- End with a time-sensitive action recommendation ("Contact before the August board vote" / "RFP expected within 60 days").`,
    `Analyze this document for public safety software procurement signals (911/PSAP, campus safety, or venue).
Source: ${sourceName}
URL: ${sourceUrl}
Text: ${rawText.slice(0, 4000)}
Return JSON with keys: isRelevant, signalType, agencyName, agencyType, city, state, county, population, aiHeadline, aiSummary, excerpt, dollarValue, dollarValueContext, incumbentVendor, intentStage, rcProduct, tags, mentionedEntities, scoreContrib, confidence, vertical.
For higher-ed / campus safety set vertical="campus" and rcProduct="campus".
aiSummary REQUIRED: exactly 3-4 sentences structured as follows —
Sentence 1: What specifically was found (meeting, document, vote, report) and what it shows.
Sentence 2: Context about the agency's current situation — size, current system, problem they are solving.
Sentence 3: Why this is a direct Rapid Cortex opportunity — name the specific RC feature or product that fits.
Sentence 4: The recommended urgency and window for outreach.
Always include dollar amounts when present. Never use vague language like "this may be an opportunity." Be specific.`,
    1400,
  );
  if (!text.trim()) {
    console.warn(
      JSON.stringify({
        msg: "rapid_iq_classify_claude_empty",
        sourceName,
        sourceUrl,
        fallback: "keyword_heuristic",
      }),
    );
    return classifySignalHeuristic(rawText, sourceName);
  }
  const parsed = parseJsonLoose<Partial<ClassifiedSignal>>(text, { isRelevant: false });
  return {
    isRelevant: Boolean(parsed.isRelevant),
    signalType: parsed.signalType ?? null,
    agencyName: parsed.agencyName ?? null,
    agencyType: parsed.agencyType ?? null,
    city: parsed.city ?? null,
    state: parsed.state ?? null,
    county: parsed.county ?? null,
    population: parsed.population ?? null,
    aiHeadline: parsed.aiHeadline ?? null,
    aiSummary: parsed.aiSummary ?? null,
    excerpt: parsed.excerpt ?? null,
    dollarValue: parsed.dollarValue ?? null,
    dollarValueContext: parsed.dollarValueContext ?? null,
    incumbentVendor: parsed.incumbentVendor ?? null,
    intentStage: parsed.intentStage ?? null,
    rcProduct: parsed.rcProduct ?? null,
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    mentionedEntities: Array.isArray(parsed.mentionedEntities) ? parsed.mentionedEntities : [],
    scoreContrib: typeof parsed.scoreContrib === "number" ? parsed.scoreContrib : 0,
    confidence: parsed.confidence ?? "low",
    vertical: parsed.vertical ?? "911",
  };
}

export async function generateTalkingPoints(
  opportunity: RapidIqOpportunity,
  _signals: RapidIqSignal[],
): Promise<string[]> {
  if (opportunity.talkingPoints?.length) return opportunity.talkingPoints;
  if (isCollectorsMockEnabled() || !(await resolveAnthropicKey())) {
    return [
      `Reference the ${opportunity.aiHeadline} signal in your opener.`,
      `Ask about timeline for ${opportunity.intentStage.replace(/_/g, " ")}.`,
      opportunity.estimatedDollarValue
        ? `Confirm whether the ~$${opportunity.estimatedDollarValue.toLocaleString()} budget is still allocated.`
        : "Ask which budget cycle funds the modernization.",
      opportunity.incumbentVendor
        ? `Position Rapid Cortex as a complement/displacement vs ${opportunity.incumbentVendor}.`
        : "Ask which CAD/NG911 stack they run today.",
      `Offer a 20-minute Rapid Cortex Core demo tailored to ${opportunity.agencyName}.`,
    ];
  }
  const text = await callClaude(
    "Generate sales talking points for Rapid Cortex reps. Return ONLY a JSON array of exactly 5 strings.",
    `5 talking points for a call with ${opportunity.agencyName}. Signal: ${opportunity.aiHeadline}. Dollar: ${opportunity.estimatedDollarValue ?? "unknown"}. Incumbent: ${opportunity.incumbentVendor ?? "unknown"}. Product: ${opportunity.rcProduct}`,
    600,
  );
  const arr = parseJsonLoose<string[]>(text, []);
  return Array.isArray(arr) ? arr.slice(0, 5) : [];
}

export async function signalChat(
  opportunity: RapidIqOpportunity,
  messages: SignalChatMessage[],
  signals: RapidIqSignal[] = [],
  sources: RapidIqSource[] = [],
): Promise<string> {
  const sourceBlock =
    sources.length > 0
      ? sources
          .map(
            (s) =>
              `- ${s.sourceRole.toUpperCase()}: "${s.title}" — ${s.url}` +
              (s.docUrl ? ` (doc: ${s.docUrl})` : "") +
              (s.pageReference ? ` (${s.pageReference})` : "") +
              (s.excerpt ? `\n  Excerpt: "${s.excerpt}"` : ""),
          )
          .join("\n")
      : "No source documents have been linked to this opportunity yet.";

  const signalBlock =
    signals.length > 0
      ? signals
          .map(
            (s) =>
              `- [${s.signalType.toUpperCase()}] ${s.title} (${s.publishedAt?.slice(0, 10) ?? "n/a"})\n` +
              `  Source: ${s.sourceName} — ${s.sourceUrl}\n` +
              `  Summary: ${s.summary}`,
          )
          .join("\n\n")
      : "No individual signals recorded.";

  const systemPrompt = `You are a sales intelligence assistant for Rapid Cortex, a public safety AI platform.
Answer accurately using only the information below. If asked for a source, provide the exact URL from SOURCE DOCUMENTS or SIGNALS.
Never invent URLs. If you lack information, say what you do and don't know.

═══ OPPORTUNITY ═══
Agency: ${opportunity.agencyName ?? "Unknown"}
Location: ${opportunity.city ?? ""}, ${opportunity.state ?? ""}
Type: ${opportunity.agencyType ?? "Unknown"}
Population: ${opportunity.population?.toLocaleString() ?? "Unknown"}
RC Product Fit: ${opportunity.rcProduct ?? "Unknown"}
Intent Stage: ${opportunity.intentStage ?? "Unknown"}
Score: ${opportunity.opportunityScore ?? 0}/100
Estimated Value: ${
    opportunity.estimatedDollarValue
      ? `$${opportunity.estimatedDollarValue.toLocaleString()}`
      : "Not specified"
  }
Incumbent Vendor: ${opportunity.incumbentVendor ?? "Not identified"}
AI Summary: ${opportunity.aiSummary ?? "No summary available"}

═══ SIGNALS (${signals.length} total) ═══
${signalBlock}

═══ SOURCE DOCUMENTS ═══
${sourceBlock}`;

  if (isCollectorsMockEnabled() || !(await resolveAnthropicKey())) {
    const last = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
    const lower = last.toLowerCase();
    if (lower.includes("source") || lower.includes("url") || lower.includes("document")) {
      const first = sources[0] ?? null;
      const sig = signals[0] ?? null;
      if (first?.url) {
        return `The primary source for ${opportunity.agencyName} is "${first.title}" at ${first.url}${first.docUrl ? ` (document: ${first.docUrl})` : ""}.`;
      }
      if (sig?.sourceUrl) {
        return `The linked signal source for ${opportunity.agencyName} is ${sig.sourceName}: ${sig.sourceUrl}.`;
      }
      return `No source documents are linked yet for ${opportunity.agencyName}. Re-run collectors or refresh so real agenda/PDF URLs are attached.`;
    }
    return `For ${opportunity.agencyName}: ${opportunity.aiSummary.slice(0, 280)} Re: "${last.slice(0, 120)}" — lead with the score (${opportunity.opportunityScore}) and the ${opportunity.intentStage.replace(/_/g, " ")} stage.`;
  }

  const text = await callClaude(
    systemPrompt,
    messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n"),
    700,
  );
  if (!text) {
    throw new Error("Claude returned empty response");
  }
  return text;
}

export async function generateOutreach(
  opportunity: RapidIqOpportunity,
  contact?: { name?: string | null; title?: string },
): Promise<{ subject: string; body: string }> {
  if (isCollectorsMockEnabled() || !(await resolveAnthropicKey())) {
    const who = contact?.name?.trim() || "Director";
    return {
      subject: `Rapid Cortex — ${opportunity.agencyName} (${opportunity.state})`,
      body: `Hi ${who},\n\nI noticed ${opportunity.aiHeadline}. ${opportunity.aiSummary}\n\nWould you have 20 minutes this week for a brief Rapid Cortex overview?\n\nBest,\nRapid Cortex`,
    };
  }
  const text = await callClaude(
    "You are a senior SDR for Rapid Cortex. Return ONLY valid JSON {subject, body}. Under 180 words.",
    `Write outreach for: ${opportunity.agencyName}, ${opportunity.state}. Signal: ${opportunity.aiHeadline}. Contact: ${contact?.name ?? "Director"}, ${contact?.title ?? ""}`,
    600,
  );
  return parseJsonLoose(text, {
    subject: `Rapid Cortex — ${opportunity.agencyName}`,
    body: "",
  });
}
