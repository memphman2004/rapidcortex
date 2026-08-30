/**
 * NLP extraction for pipeline signals — Claude when available, heuristic when mock.
 */

import type { RapidIqPipelineExtraction, RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../../runtimeSecrets.js";
import { isCollectorsMockEnabled } from "../agenda-finder.js";

const CLAUDE_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

async function resolveAnthropicKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
}

function parseJsonLoose<T>(text: string, fallback: T): T {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const objStart = cleaned.indexOf("{");
    const objEnd = cleaned.lastIndexOf("}");
    if (objStart >= 0 && objEnd > objStart) {
      try {
        return JSON.parse(cleaned.slice(objStart, objEnd + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    return fallback;
  }
}

function cleanOptional(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t || t.toLowerCase() === "null") return undefined;
  return t;
}

function normalizeExtraction(raw: Record<string, unknown>): RapidIqPipelineExtraction {
  const proc = cleanOptional(raw.procurementType);
  const procurementType =
    proc === "new-cad" ||
    proc === "upgrade" ||
    proc === "ai-overlay" ||
    proc === "hardware" ||
    proc === "unknown"
      ? proc
      : undefined;

  const dollar =
    typeof raw.dollarAmount === "number"
      ? raw.dollarAmount
      : typeof raw.dollarAmount === "string"
        ? Number(String(raw.dollarAmount).replace(/[$,]/g, ""))
        : undefined;

  const hints = Array.isArray(raw.contactHints)
    ? raw.contactHints
        .filter((h): h is Record<string, unknown> => !!h && typeof h === "object")
        .map((h) => ({
          name: String(h.name ?? "").trim(),
          title: cleanOptional(h.title),
          source: (h.source === "extracted" ? "extracted" : "mentioned") as
            | "mentioned"
            | "extracted",
        }))
        .filter((h) => h.name.length > 0)
    : undefined;

  return {
    agencyName: cleanOptional(raw.agencyName),
    jurisdiction: cleanOptional(raw.jurisdiction),
    state: cleanOptional(raw.state)?.slice(0, 2).toUpperCase(),
    agencyType: cleanOptional(raw.agencyType),
    vendorNamed: cleanOptional(raw.vendorNamed),
    fundingSource: cleanOptional(raw.fundingSource),
    procurementType,
    dollarAmount: Number.isFinite(dollar) ? dollar : undefined,
    summary: cleanOptional(raw.summary),
    contactHints: hints,
  };
}

/** Heuristic extraction used when RAPID_IQ_COLLECTORS_MOCK=1 or Claude is unavailable. */
export function extractSignalDataHeuristic(raw: RapidIqPipelineRawSignal): RapidIqPipelineExtraction {
  const text = `${raw.rawTitle}\n${raw.rawSnippet}`;
  const lower = text.toLowerCase();

  let vendorNamed: string | undefined;
  if (lower.includes("tyler")) vendorNamed = "Tyler Technologies";
  else if (lower.includes("hexagon")) vendorNamed = "Hexagon";
  else if (lower.includes("centralsquare") || lower.includes("central square"))
    vendorNamed = "CentralSquare";
  else if (lower.includes("motorola")) vendorNamed = "Motorola Solutions";
  else if (lower.includes("axon")) vendorNamed = "Axon";

  let fundingSource: string | undefined;
  if (lower.includes("arpa") || lower.includes("slfrf")) fundingSource = "ARPA";
  else if (lower.includes("cops")) fundingSource = "COPS";
  else if (lower.includes("federal grant")) fundingSource = "Federal Grant";
  else if (lower.includes("state grant")) fundingSource = "State Grant";

  let procurementType: RapidIqPipelineExtraction["procurementType"] = "unknown";
  if (
    lower.includes("new cad") ||
    lower.includes("computer aided dispatch") ||
    (lower.includes("cad") && (lower.includes("purchase") || lower.includes("approv")))
  ) {
    procurementType = "new-cad";
  } else if (lower.includes("ai overlay") || lower.includes("artificial intelligence")) {
    procurementType = "ai-overlay";
  } else if (lower.includes("upgrade") || lower.includes("moderniz")) {
    procurementType = "upgrade";
  } else if (lower.includes("radio") || lower.includes("vehicle") || lower.includes("hardware")) {
    procurementType = "hardware";
  }

  let agencyType: string | undefined;
  if (lower.includes("911") || lower.includes("dispatch") || lower.includes("psap") || lower.includes("ecc")) {
    agencyType = "911";
  } else if (lower.includes("sheriff")) agencyType = "sheriff";
  else if (lower.includes("fire")) agencyType = "fire";
  else if (lower.includes("ems")) agencyType = "ems";

  const dollarMatch = text.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(k|m|million)?/i);
  let dollarAmount: number | undefined;
  if (dollarMatch) {
    let n = Number(dollarMatch[1]!.replace(/,/g, ""));
    const suffix = (dollarMatch[2] ?? "").toLowerCase();
    if (suffix === "k") n *= 1_000;
    if (suffix === "m" || suffix === "million") n *= 1_000_000;
    if (Number.isFinite(n)) dollarAmount = n;
  }

  let jurisdiction: string | undefined;
  const countyMatch = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County\b/);
  if (countyMatch) jurisdiction = `${countyMatch[1]} County`;

  let state: string | undefined;
  const stateMatch = text.match(/\b([A-Z]{2})\b(?!\w)/);
  if (stateMatch && ["ID", "TX", "NV", "GA", "IA", "CA", "FL", "NY"].includes(stateMatch[1]!)) {
    state = stateMatch[1];
  } else if (lower.includes(", id") || lower.includes("idaho")) {
    state = "ID";
  }

  const agencyName =
    jurisdiction && agencyType === "911"
      ? `${jurisdiction} 911`
      : jurisdiction
        ? `${jurisdiction} Sheriff's Office`
        : undefined;

  return {
    agencyName,
    jurisdiction,
    state,
    agencyType,
    vendorNamed,
    fundingSource,
    procurementType,
    dollarAmount,
    summary: text.replace(/\s+/g, " ").trim().slice(0, 400),
    contactHints: [],
  };
}

async function extractViaClaude(raw: RapidIqPipelineRawSignal): Promise<RapidIqPipelineExtraction | null> {
  const apiKey = await resolveAnthropicKey();
  if (!apiKey) return null;

  const prompt = `You are a public safety procurement analyst. Extract structured data from the following government signal.

Signal title: ${raw.rawTitle}
Signal content: ${raw.rawSnippet.slice(0, 1500)}

Respond ONLY with a valid JSON object (no markdown, no explanation) with these fields:
{
  "agencyName": "Full agency name or null",
  "jurisdiction": "County or city name or null",
  "state": "2-letter state code or null",
  "agencyType": "911 | sheriff | police | fire | ems | ema | county | city | unknown",
  "vendorNamed": "Vendor company name or null",
  "fundingSource": "ARPA | COPS | State Grant | Federal Grant | PSAP | General Fund | Unknown",
  "procurementType": "new-cad | upgrade | ai-overlay | hardware | unknown",
  "dollarAmount": number or null,
  "summary": "2-3 sentence plain-English summary of the procurement opportunity and why it matters for a public safety AI vendor. Focus on the window of opportunity.",
  "contactHints": [
    { "name": "Full name", "title": "Role title", "source": "mentioned" }
  ]
}`;

  const resp = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.warn(
      JSON.stringify({
        msg: "rapid_iq_pipeline_claude_error",
        status: resp.status,
        body: text.slice(0, 200),
      }),
    );
    return null;
  }

  const data = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((b) => b.type === "text")?.text ?? "{}";
  const parsed = parseJsonLoose<Record<string, unknown>>(text, {});
  return normalizeExtraction(parsed);
}

export async function extractSignalData(
  raw: RapidIqPipelineRawSignal,
): Promise<RapidIqPipelineExtraction> {
  if (isCollectorsMockEnabled()) {
    return extractSignalDataHeuristic(raw);
  }
  const viaClaude = await extractViaClaude(raw);
  if (viaClaude) return viaClaude;
  return extractSignalDataHeuristic(raw);
}

/** Jefferson County-style sample used when collectors mock is on. */
export function jeffersonCountyMockRawSignal(
  sourceId: RapidIqPipelineRawSignal["sourceId"] = "legistar-bulk",
): RapidIqPipelineRawSignal {
  return {
    sourceId,
    sourceUrl: "https://jefferson-id.legistar.com",
    rawTitle:
      "Jefferson County Commission approves $200K ARPA for Tyler Technologies CAD dispatch system",
    rawSnippet: JSON.stringify({
      client: "jefferson-id",
      body: "Board of County Commissioners",
      title: "ARPA appropriation — Tyler Technologies computer aided dispatch",
      matterTitle:
        "Approve $200,000 ARPA funding for new Tyler Technologies CAD / 911 dispatch system for Jefferson County, ID",
      date: "2026-07-06",
      state: "ID",
      jurisdiction: "Jefferson County",
      amount: 200_000,
      vendor: "Tyler Technologies",
      funding: "ARPA",
    }),
    signalDate: "2026-07-06",
  };
}
