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
  const dollarMatch = rawText.match(/\$[\d,]+(?:\.\d+)?(?:\s*(?:million|m|k))?/i);
  const dateMatch = rawText.match(
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  );
  const hasSpecificDetail = Boolean(dollarMatch || dateMatch);
  const keywordHit =
    isCampus ||
    lower.includes("911") ||
    lower.includes("dispatch") ||
    lower.includes("ng911") ||
    lower.includes("public safety") ||
    lower.includes("cad") ||
    lower.includes("emergency communications") ||
    lower.includes("psap");
  // Heuristic path must not invent buyer agencies from collector source labels
  const relevant = keywordHit && hasSpecificDetail;

  const excerpt = rawText.replace(/\s+/g, " ").trim().slice(0, 180);
  const dollarValue = dollarMatch
    ? Number(dollarMatch[0].replace(/[$,]/g, "").replace(/\s*(million|m)/i, "000000").replace(/\s*k/i, "000")) ||
      null
    : null;

  return {
    isRelevant: relevant,
    signalType: lower.includes("grant") ? "grant" : lower.includes("rfp") ? "rfp" : "budget",
    agencyName: null,
    agencyType: isCampus ? "university" : "county_911",
    city: null,
    state: null,
    county: null,
    population: null,
    aiHeadline: relevant
      ? `${sourceName}: ${excerpt.slice(0, 80)}`
      : `${sourceName} signal (insufficient detail)`,
    aiSummary: relevant
      ? [
          `Source document from ${sourceName} includes concrete public-safety language: "${excerpt}".`,
          dollarMatch
            ? `A specific funding figure appears in the text (${dollarMatch[0]}).`
            : dateMatch
              ? `A specific date appears in the text (${dateMatch[0]}).`
              : "Additional procurement context is present in the excerpted passage.",
          isCampus
            ? "Rapid Cortex Campus maps to campus safety / Clery-related operations when the buyer agency can be confirmed from the document."
            : "Rapid Cortex Core maps to CAD/NG911 and AI coaching needs when the buyer agency can be confirmed from the document.",
          "Confirm the purchasing agency and decision window from the original document before outreach.",
        ].join(" ")
      : "",
    excerpt: excerpt || null,
    dollarValue,
    dollarValueContext: dollarMatch ? "mentioned in source text" : null,
    incumbentVendor: null,
    intentStage: "evaluation",
    rcProduct: isCampus ? "campus" : "core",
    tags: isCampus ? ["CAMPUS SAFETY", "OPPORTUNITY"] : ["OPPORTUNITY", "PSAP SOFTWARE"],
    mentionedEntities: [],
    scoreContrib: relevant ? 12 : 0,
    confidence: "low",
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
- End with a time-sensitive action recommendation ("Contact before the August board vote" / "RFP expected within 60 days").

ANTI-TEMPLATE RULES — CRITICAL:
- NEVER write "The meeting materials from [X] discuss..." — this is a template.
- NEVER write "under active review" — this is filler.
- NEVER write "AI-assisted dispatch tooling" unless those exact words appear in the source.
- NEVER set agencyName to the data source label (e.g. Grants.gov, SAM.gov, FEMA, a state 911 program office). agencyName must be the buying agency / recipient (county, city, PSAP, campus, venue).
- The summary MUST include at least one SPECIFIC detail that only exists in THIS document: a dollar amount, date, vendor name, vote outcome, named technology, or quoted statement.
- If you cannot find a specific detail in the source text, set "isRelevant": false.
- The summary must read differently for every signal.`,
    `Analyze this document for public safety software procurement signals (911/PSAP, campus safety, or venue).
Source label (NOT the agency unless the text proves otherwise): ${sourceName}
URL: ${sourceUrl}
Text: ${rawText.slice(0, 4000)}
Return JSON with keys: isRelevant, signalType, agencyName, agencyType, city, state, county, population, aiHeadline, aiSummary, excerpt, dollarValue, dollarValueContext, incumbentVendor, intentStage, rcProduct, tags, mentionedEntities, scoreContrib, confidence, vertical.
For higher-ed / campus safety set vertical="campus" and rcProduct="campus".
agencyName MUST be the purchasing agency or grant recipient named in the text — never "${sourceName}" unless that string is clearly a county/city/campus buyer.
aiSummary REQUIRED: 3-4 sentences that MUST include:
1. The SPECIFIC document title and date when present (not "meeting materials").
2. A SPECIFIC dollar amount, vendor name, vote outcome, or technology named in the source. If none exist, set isRelevant: false.
3. Why this is a direct Rapid Cortex Core/Campus/Venue opportunity.
4. Time-sensitive action or decision window.
NO TEMPLATES. NO GENERIC LANGUAGE.`,
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
  const fallback = (): string[] => [
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

  // Only reuse non-empty cached points (empty [] means a prior failed generate).
  if (opportunity.talkingPoints && opportunity.talkingPoints.length > 0) {
    return opportunity.talkingPoints;
  }
  if (isCollectorsMockEnabled() || !(await resolveAnthropicKey())) {
    return fallback();
  }
  const text = await callClaude(
    "Generate sales talking points for Rapid Cortex reps. Return ONLY a JSON array of exactly 5 strings.",
    `5 talking points for a call with ${opportunity.agencyName}. Signal: ${opportunity.aiHeadline}. Dollar: ${opportunity.estimatedDollarValue ?? "unknown"}. Incumbent: ${opportunity.incumbentVendor ?? "unknown"}. Product: ${opportunity.rcProduct}`,
    600,
  );
  const parsed = parseJsonLoose<unknown>(text, null);
  let points: string[] = [];
  if (Array.isArray(parsed)) {
    points = parsed.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { points?: unknown }).points)) {
    points = ((parsed as { points: unknown[] }).points).filter(
      (p): p is string => typeof p === "string" && p.trim().length > 0,
    );
  }
  points = points.slice(0, 5);
  if (points.length === 0) {
    console.warn(
      JSON.stringify({
        msg: "rapid_iq_talking_points_fallback",
        opportunityId: opportunity.opportunityId,
        claudeEmpty: !text,
      }),
    );
    return fallback();
  }
  return points;
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

export type RfpResponseOutline = {
  executiveSummary: string;
  requirements: { requirement: string; rcCapability: string; rcFeature: string }[];
  differentiators: string[];
  potentialConcerns: string[];
  recommendedApproach: string;
};

export async function generateRfpResponseOutline(
  rfpText: string,
  sourceUrl: string,
  agencyName: string,
): Promise<RfpResponseOutline> {
  const empty: RfpResponseOutline = {
    executiveSummary: "Could not analyze RFP automatically.",
    requirements: [],
    differentiators: [],
    potentialConcerns: [],
    recommendedApproach: "",
  };
  if (isCollectorsMockEnabled() || !(await resolveAnthropicKey())) {
    return {
      executiveSummary: `Position Rapid Cortex for ${agencyName} against this RFP using Core transcription, CAD integration, and CJIS-aware tenancy.`,
      requirements: [
        {
          requirement: "Real-time call documentation",
          rcCapability: "AI transcription + CAD assist",
          rcFeature: "Live Transcription",
        },
      ],
      differentiators: ["Agency-isolated data", "Multi-vertical (911 / campus / venue)"],
      potentialConcerns: ["Confirm CAD writeback addendum if write path is required"],
      recommendedApproach: "Lead with compliance + dispatcher UX; attach capability matrix.",
    };
  }
  const text = await callClaude(
    `You are a senior solutions engineer for Rapid Cortex, an AI-powered public safety platform for 911 centers, campus safety, and venue security.
Analyze RFP documents and map stated requirements to Rapid Cortex capabilities.

Rapid Cortex key capabilities:
- Real-time call transcription (AI-powered, 40+ languages)
- CAD integration (read/write with major CAD vendors)
- AI coaching and supervisor dashboards
- Silent Text (SMS to caller for location/media sharing)
- LiveLocation (GPS sharing during active call)
- QR/NFC incident reporting
- Ring/camera integration
- CJIS-aware architecture, agency-isolated data
- Cloud-native, AWS-hosted, SOC2-aligned

Return ONLY valid JSON matching the specified schema.`,
    `Analyze this RFP from ${agencyName} and generate a response outline.

Source: ${sourceUrl}
RFP Text:
${rfpText.slice(0, 6000)}

Return JSON:
{
  "executiveSummary": "2-3 sentence executive summary positioning RC for this RFP",
  "requirements": [
    {
      "requirement": "stated RFP requirement",
      "rcCapability": "how RC meets it",
      "rcFeature": "specific RC feature name"
    }
  ],
  "differentiators": ["key RC differentiator vs typical competitors"],
  "potentialConcerns": ["requirement we need to address carefully"],
  "recommendedApproach": "overall response strategy in 2-3 sentences"
}`,
    2000,
  );
  return parseJsonLoose(text, empty);
}

export type AgencyIntelProfile = {
  annualCallVolume: number | null;
  dispatcherCount: number | null;
  populationServed: number | null;
  estimatedBudget: number | null;
  currentCadVendor: string | null;
  cadNotes: string | null;
  agencyWebsite: string | null;
  psapType: string | null;
  notes: string;
};

export async function generateAgencyProfile(
  agencyName: string,
  city: string,
  state: string,
  vertical: string,
): Promise<AgencyIntelProfile> {
  const empty: AgencyIntelProfile = {
    annualCallVolume: null,
    dispatcherCount: null,
    populationServed: null,
    estimatedBudget: null,
    currentCadVendor: null,
    cadNotes: null,
    agencyWebsite: null,
    psapType: null,
    notes: "Profile could not be generated automatically.",
  };
  if (isCollectorsMockEnabled() || !(await resolveAnthropicKey())) {
    return {
      ...empty,
      notes: `Mock profile for ${agencyName} (${city}, ${state}) — ${vertical}. Enable Anthropic for live research.`,
    };
  }
  const text = await callClaude(
    `You are a public safety intelligence analyst. Provide factual, research-based information about government agencies. Only include information you are confident about. Use null for unknown values. Return ONLY valid JSON.`,
    `Research this public safety agency and return what you know:

Agency: ${agencyName}
Location: ${city}, ${state}
Type: ${vertical}

Return JSON:
{
  "annualCallVolume": number or null,
  "dispatcherCount": number or null,
  "populationServed": number or null,
  "estimatedBudget": number or null,
  "currentCadVendor": string or null,
  "cadNotes": string or null,
  "agencyWebsite": string or null,
  "psapType": string or null,
  "notes": "any other relevant intel"
}

Do not fabricate. If you don't know something, use null.`,
    800,
  );
  return parseJsonLoose(text, empty);
}

export async function researchAgency(
  agencyName: string,
  city: string,
  state: string,
): Promise<string> {
  if (isCollectorsMockEnabled() || !(await resolveAnthropicKey())) {
    return `Research stub for ${agencyName} in ${city}, ${state}. Enable Anthropic for a full sales intelligence brief.`;
  }
  const text = await callClaude(
    `You are a public safety technology sales intelligence analyst. Research government agencies and provide actionable sales intelligence. Be specific and factual. Include only what you know confidently.`,
    `Research ${agencyName} in ${city}, ${state}.

Provide:
1. What you know about their current technology stack (CAD, radio, recording)
2. Any known modernization projects or technology initiatives
3. Recent news, incidents, or events that might create technology needs
4. Key leadership if known
5. Budget context (county budget size, recent allocations)
6. How Rapid Cortex Core specifically fits their situation

Be specific and cite what you know vs what is estimated.`,
    1000,
  );
  return text || `No research returned for ${agencyName}.`;
}

export async function generateCompetitorIntel(
  incumbentVendor: string,
  agencyName: string,
): Promise<string> {
  if (isCollectorsMockEnabled() || !(await resolveAnthropicKey())) {
    return `Displacement notes for ${agencyName} vs ${incumbentVendor}: emphasize open integration, multi-language transcription, and agency-isolated CJIS posture.`;
  }
  const text = await callClaude(
    `You are a competitive intelligence analyst for Rapid Cortex. Provide honest competitive analysis to help with displacement opportunities.`,
    `${agencyName} currently uses ${incumbentVendor}.

Provide:
1. Known weaknesses or pain points with ${incumbentVendor} in public safety
2. Common reasons agencies leave ${incumbentVendor}
3. Key Rapid Cortex advantages in this displacement scenario
4. Recommended talking points for this specific situation
Keep it factual and concise.`,
    600,
  );
  return text || `No competitor intel for ${incumbentVendor}.`;
}
