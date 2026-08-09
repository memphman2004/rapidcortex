import type { RapidIqOpportunity, RapidIqSignal, SignalChatMessage } from "rapid-cortex-shared";
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
  if (!res.ok) return "";
  const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return body.content?.find((b) => b.type === "text")?.text ?? "";
}

export async function classifySignal(
  rawText: string,
  sourceUrl: string,
  sourceName: string,
): Promise<ClassifiedSignal> {
  if (isCollectorsMockEnabled() || !(await resolveAnthropicKey())) {
    const lower = rawText.toLowerCase();
    const isCampus = textMatchesUniversityTerms(rawText);
    const relevant =
      isCampus ||
      lower.includes("911") ||
      lower.includes("dispatch") ||
      lower.includes("ng911") ||
      lower.includes("public safety") ||
      lower.includes("cad");
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
        ? `${sourceName} materials reference campus safety / Clery compliance technology. This is a Rapid Cortex Campus fit.`
        : `${sourceName} meeting materials reference CAD/NG911 modernization. This is a Rapid Cortex Core fit for AI-assisted dispatch intelligence.`,
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

  const text = await callClaude(
    `You are a public safety technology sales intelligence analyst for Rapid Cortex.
Cover PSAP/911 (Core), campus/university safety (Campus), and venue operations (Venue).
University signals often involve Board of Trustees, campus police, Clery Act, Title IX, or student safety fees.
Extract only factual information present in the document. Never invent information. Respond ONLY with valid JSON.`,
    `Analyze this document for public safety software procurement signals (911/PSAP, campus safety, or venue).
Source: ${sourceName}
URL: ${sourceUrl}
Text: ${rawText.slice(0, 4000)}
Return JSON with keys: isRelevant, signalType, agencyName, agencyType, city, state, county, population, aiHeadline, aiSummary, excerpt, dollarValue, dollarValueContext, incumbentVendor, intentStage, rcProduct, tags, mentionedEntities, scoreContrib, confidence, vertical.
For higher-ed / campus safety set vertical="campus" and rcProduct="campus".`,
    1000,
  );
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
): Promise<string> {
  if (isCollectorsMockEnabled() || !(await resolveAnthropicKey())) {
    const last = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
    return `For ${opportunity.agencyName}: ${opportunity.aiSummary.slice(0, 280)} Re: "${last.slice(0, 120)}" — lead with the score (${opportunity.opportunityScore}) and the ${opportunity.intentStage.replace(/_/g, " ")} stage.`;
  }
  const text = await callClaude(
    `You are a sales intelligence assistant for Rapid Cortex. Answer about this opportunity only. Be concise.
OPPORTUNITY: ${opportunity.agencyName}, ${opportunity.city} ${opportunity.state}
Signal: ${opportunity.aiHeadline}
Summary: ${opportunity.aiSummary}
Score: ${opportunity.opportunityScore}/100
Dollar value: ${opportunity.estimatedDollarValue ?? "not specified"}
RC Product fit: ${opportunity.rcProduct}`,
    messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n"),
    500,
  );
  return text || "Unable to generate a response right now.";
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
