/**
 * Natural-language research over pipeline signals. Uses Anthropic when a key
 * is available; otherwise returns a cited extractive summary (never fabricates).
 */

import {
  displayPipelineScores,
  type RapidIqAgencyProfile,
  type RapidIqPipelineSignal,
  type RapidIqResearchRequest,
  type RapidIqResearchResponse,
} from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../../runtimeSecrets.js";
import { isCollectorsMockEnabled } from "../agenda-finder.js";
import { getAgencyProfile, listSignalsForResearch } from "./rapid-iq-pipeline-db.js";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

async function resolveAnthropicKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
}

function inDateRange(signalDate: string, from?: string, to?: string): boolean {
  if (from && signalDate < from) return false;
  if (to && signalDate > to) return false;
  return true;
}

function filterSignals(
  signals: RapidIqPipelineSignal[],
  req: RapidIqResearchRequest,
): RapidIqPipelineSignal[] {
  const q = req.query.toLowerCase();
  const states = req.filters?.states?.map((s) => s.toUpperCase());
  const types = req.filters?.agencyTypes?.map((t) => t.toLowerCase());
  const minIntent = req.filters?.minIntentScore ?? 0;
  const range = req.filters?.dateRange;

  return signals
    .filter((s) => s.status !== "dismissed")
    .filter((s) => {
      if (states?.length && (!s.state || !states.includes(s.state.toUpperCase()))) return false;
      if (types?.length && (!s.agencyType || !types.includes(s.agencyType.toLowerCase()))) return false;
      if (!inDateRange(s.signalDate, range?.from, range?.to)) return false;
      const scores = displayPipelineScores(s);
      if (scores.intent < minIntent) return false;
      const hay = [
        s.agencyName,
        s.state,
        s.rawTitle,
        s.summary,
        s.excerpt,
        s.rawSnippet,
        ...(s.taxonomyTags ?? []),
        s.vendorNamed,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const tokens = q.split(/\s+/).filter((t) => t.length > 2);
      if (tokens.length === 0) return true;
      const hits = tokens.filter((t) => hay.includes(t)).length;
      return hits >= Math.min(2, tokens.length) || hay.includes(q);
    })
    .sort((a, b) => displayPipelineScores(b).combined - displayPipelineScores(a).combined)
    .slice(0, 50);
}

function heuristicAnswer(query: string, signals: RapidIqPipelineSignal[]): string {
  if (signals.length === 0) {
    return `Insufficient public-record signals to answer “${query}”. No matching agencies were found in the current Rapid IQ corpus.`;
  }
  const lines = signals.slice(0, 8).map((s) => {
    const scores = displayPipelineScores(s);
    const agency = s.agencyName ?? s.jurisdiction ?? "Unknown agency";
    const loc = s.state ? `, ${s.state}` : "";
    return `• ${agency}${loc} — ${s.rawTitle} (intent ${scores.intent}, fit ${scores.fit}). Source: ${s.sourceUrl}`;
  });
  return [
    `Based only on stored public-record signals (not inferred beyond the excerpts):`,
    ...lines,
    "",
    "I cannot confirm vendor names, contract dates, dollar amounts, or contacts that are not in these records.",
  ].join("\n");
}

export async function runRapidIqResearch(
  req: RapidIqResearchRequest,
): Promise<RapidIqResearchResponse> {
  const all = await listSignalsForResearch(200);
  const signals = filterSignals(all, req);
  const dates = signals.map((s) => s.signalDate).sort();
  const oldest = dates[0] ?? "n/a";
  const newest = dates[dates.length - 1] ?? "n/a";
  const disclaimer = `Based on ${signals.length} signals collected between ${oldest} and ${newest}. All data sourced from public records. Never treat inferred scores as confirmed procurement facts.`;
  const confidence: RapidIqResearchResponse["confidence"] =
    signals.length >= 5 ? "high" : signals.length >= 2 ? "medium" : "low";

  const agencyIds = [...new Set(signals.map((s) => s.agencyProfileId).filter(Boolean))] as string[];
  const supportingAgencies: RapidIqAgencyProfile[] = [];
  for (const id of agencyIds.slice(0, 10)) {
    const p = await getAgencyProfile(id);
    if (p) supportingAgencies.push(p);
  }

  const citations = signals.slice(0, 10).map((s) => ({
    agencyName: s.agencyName,
    title: s.rawTitle,
    sourceUrl: s.sourceUrl,
    excerpt: s.excerpt ?? s.summary,
  }));

  const supportingSignals = signals.slice(0, 10);
  let mocked = isCollectorsMockEnabled();
  let answer = heuristicAnswer(req.query, signals);

  if (!mocked) {
    const apiKey = await resolveAnthropicKey();
    if (apiKey && signals.length > 0) {
      const context = signals
        .slice(0, 40)
        .map((s) => {
          const scores = displayPipelineScores(s);
          return [
            `Agency: ${s.agencyName ?? s.jurisdiction ?? "Unknown"} (${s.state ?? "n/a"})`,
            `Signal: ${s.rawTitle}`,
            `Source: ${s.sourceUrl} (${s.documentDate ?? s.signalDate})`,
            `Excerpt: "${(s.excerpt ?? s.summary ?? s.rawSnippet).slice(0, 400)}"`,
            `Intent: ${scores.intent}/100  Fit: ${scores.fit}/100`,
            s.recommendedAction ? `Recommended: ${s.recommendedAction}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n---\n");

      try {
        const resp = await fetch(ANTHROPIC_API, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: process.env.ANTHROPIC_MODEL_PRIMARY?.trim() || "claude-sonnet-4-6",
            max_tokens: 1000,
            system: `You are a public-sector sales intelligence analyst for Rapid Cortex,
an AI-powered 911 and public safety technology platform.
Answer the user's question using ONLY the signal data provided below.
Cite specific agencies and source documents in your answer.
Distinguish clearly between confirmed facts and inferred signals.
Never fabricate vendor names, contract dates, dollar amounts, or contact names.
If the data is insufficient to answer confidently, say so.`,
            messages: [
              {
                role: "user",
                content: `Intelligence data:\n${context}\n\nQuestion: ${req.query}`,
              },
            ],
          }),
          signal: AbortSignal.timeout(45_000),
        });
        if (resp.ok) {
          const data = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
          const text = data.content?.find((b) => b.type === "text")?.text?.trim();
          if (text) {
            answer = text;
            mocked = false;
          }
        }
      } catch (err) {
        console.warn(
          JSON.stringify({
            msg: "rapid_iq_research_claude_failed",
            error: err instanceof Error ? err.message : "unknown",
          }),
        );
        mocked = true;
      }
    } else {
      mocked = true;
    }
  }

  return {
    answer,
    supportingAgencies,
    supportingSignals,
    citations,
    confidence,
    disclaimer,
    mocked,
  };
}
