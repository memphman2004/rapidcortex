/**
 * ChatGPT Watch → NexiQ Inbox upsert (external_key dedupe + lifecycle updates).
 * Never auto-pushes to Leads CRM — status stays `new` / existing inbox status.
 */

import { randomUUID } from "node:crypto";
import type {
  RapidIqPipelineFeedTab,
  RapidIqPipelineFitLabel,
  RapidIqPipelineSignal,
  RapidIqProcurementStage,
  RapidIqWatchIngestBody,
} from "rapid-cortex-shared";
import { normalizeWatchExternalKey, watchPayloadHash } from "rapid-cortex-shared";
import { applyBuyingIntelligence } from "./apply-buying-intelligence.js";
import {
  contentHash,
  getSignal,
  getSignalIdByExternalKey,
  getSignalIdByHash,
  putExternalKeyPointer,
  putSignal,
  reserveExternalKey,
  reserveHash,
} from "./rapid-iq-pipeline-db.js";

export type WatchIngestResult = {
  signal: RapidIqPipelineSignal;
  action: "created" | "updated" | "unchanged";
  changes?: string[];
};

const FIT_SCORES: Record<"high" | "medium" | "low", number> = {
  high: 82,
  medium: 58,
  low: 34,
};

function mapVertical(v: RapidIqWatchIngestBody["vertical"]): RapidIqPipelineFeedTab {
  switch (v) {
    case "911_psap":
    case "law_enforcement":
      return "911";
    case "campus":
      return "campus";
    case "venue":
      return "venue";
    case "transit":
      return "transit";
    case "competitors":
      return "competitor";
    default:
      return "911";
  }
}

function mapStage(signalType: RapidIqWatchIngestBody["signal_type"]): RapidIqProcurementStage {
  switch (signalType) {
    case "rfp":
      return "rfp";
    case "planning":
      return "rfi-planning";
    case "funded":
      return "budget-funded";
    case "early_signal":
      return "early-awareness";
    case "competitor":
      return "competitor-win";
    default:
      return "monitoring";
  }
}

function mapFit(label: "high" | "medium" | "low" | undefined): {
  fitLabel: RapidIqPipelineFitLabel;
  fitScore: number;
} {
  const fitLabel = label ?? "medium";
  return { fitLabel, fitScore: FIT_SCORES[fitLabel] };
}

/** Preserve full due_date string when present; also expose YYYY-MM-DD for filters. */
function normalizeDeadline(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const d = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  return d.slice(0, 64);
}

function agencyTypeForVertical(vertical: RapidIqPipelineFeedTab): string {
  if (vertical === "campus") return "campus";
  if (vertical === "venue") return "venue";
  if (vertical === "competitor") return "competitor_watch";
  if (vertical === "transit") return "transit";
  return "psap";
}

function resolveContractValue(opp: RapidIqWatchIngestBody["opportunity"]): number | undefined {
  if (opp.estimated_contract_value != null) return opp.estimated_contract_value;
  if (opp.estimated_value != null) return opp.estimated_value;
  return undefined;
}

function mergeEvidence(
  existing: RapidIqPipelineSignal["evidence"],
  incoming: RapidIqWatchIngestBody["evidence"],
  now: string,
): RapidIqPipelineSignal["evidence"] {
  const out = [...(existing ?? [])];
  const seen = new Set(out.map((e) => e.url));
  for (const e of incoming ?? []) {
    if (seen.has(e.url)) continue;
    out.push({
      url: e.url,
      sourceType: e.source_type ?? "other",
      retrievedAt: now,
    });
    seen.add(e.url);
  }
  out.sort((a, b) => {
    const rank = (t: string) => {
      if (t === "official_procurement") return 0;
      if (t === "board_agenda") return 1;
      if (t === "budget" || t === "grant") return 2;
      if (t === "news") return 3;
      return 4;
    };
    return rank(a.sourceType) - rank(b.sourceType);
  });
  return out.slice(0, 25);
}

function buildActivity(
  body: RapidIqWatchIngestBody,
  prior: RapidIqPipelineSignal | null,
): { changeType: string; summary: string } | null {
  const change = body.lifecycle?.change_type ?? (prior ? "none" : "new");
  if (change === "none" && prior) {
    const nextDeadline = normalizeDeadline(body.opportunity.due_date);
    if (nextDeadline && prior.deadline && nextDeadline !== prior.deadline) {
      return {
        changeType: "deadline_change",
        summary: `Deadline changed: ${prior.deadline} → ${nextDeadline}`,
      };
    }
    if (body.opportunity.status === "cancelled") {
      return { changeType: "cancel", summary: "Opportunity marked cancelled by Watch." };
    }
    if (body.opportunity.status === "awarded") {
      return { changeType: "award", summary: "Opportunity marked awarded by Watch." };
    }
    return null;
  }
  if (change === "new" && !prior) return null;
  if (change === "none" || change === "new") return null;
  return {
    changeType: change,
    summary:
      body.lifecycle?.summary?.trim() ||
      `Watch lifecycle update: ${change.replace(/_/g, " ")}`,
  };
}

function detectMaterialChanges(
  prior: RapidIqPipelineSignal,
  next: RapidIqPipelineSignal,
  activity: { changeType: string; summary: string } | null,
): string[] {
  const changes: string[] = [];
  if (prior.deadline !== next.deadline) changes.push("due_date");
  if (prior.sourceUrl !== next.sourceUrl) changes.push("procurement_url");
  if (prior.rawTitle !== next.rawTitle) changes.push("title");
  if (prior.dollarAmount !== next.dollarAmount) changes.push("estimated_contract_value");
  if (prior.projectBudget !== next.projectBudget) changes.push("project_budget");
  if (prior.fundingAmount !== next.fundingAmount) changes.push("funding_amount");
  if (prior.solicitationNumber !== next.solicitationNumber) changes.push("solicitation_number");
  if (prior.recommendedAction !== next.recommendedAction) changes.push("next_action");
  if (prior.watchStrategy !== next.watchStrategy) changes.push("strategy");
  if ((prior.evidence?.length ?? 0) !== (next.evidence?.length ?? 0)) changes.push("evidence");
  if (activity) changes.push("lifecycle");
  return [...new Set(changes)];
}

function secondaryDedupeKey(body: RapidIqWatchIngestBody): string | null {
  const state = body.agency.state.toUpperCase();
  const sol = body.opportunity.solicitation_number?.trim();
  if (sol) {
    return contentHash(`sol|${state}|${sol.toUpperCase()}`, body.agency.name);
  }
  try {
    const host = new URL(body.opportunity.procurement_url).hostname.toLowerCase();
    const path = new URL(body.opportunity.procurement_url).pathname.toLowerCase();
    return contentHash(`url|${host}|${path}`, body.agency.name);
  } catch {
    return null;
  }
}

export async function ingestWatchSignal(body: RapidIqWatchIngestBody): Promise<WatchIngestResult> {
  const now = new Date().toISOString();
  const externalKey = normalizeWatchExternalKey(body.external_key);
  const payloadHash = watchPayloadHash({
    ...body,
    external_key: externalKey,
  });
  const existingId = await getSignalIdByExternalKey(externalKey);
  const existing = existingId ? await getSignal(existingId) : null;

  if (existing?.watchPayloadHash && existing.watchPayloadHash === payloadHash) {
    return { signal: existing, action: "unchanged", changes: [] };
  }

  const vertical = mapVertical(body.vertical);
  const { fitLabel, fitScore } = mapFit(body.qualification?.fit);
  const procurementStage = mapStage(body.signal_type);
  const deadline = normalizeDeadline(body.opportunity.due_date);
  const posted = normalizeDeadline(body.opportunity.posted_date) ?? now.slice(0, 10);
  const sourceUrl = body.opportunity.procurement_url;
  const title = body.opportunity.title.trim();
  const snippet =
    body.qualification?.reason?.trim() ||
    body.next_action?.trim() ||
    title;
  const activity = buildActivity(body, existing);
  const contractValue = resolveContractValue(body.opportunity);
  const solicitationNumber =
    body.opportunity.solicitation_number?.trim() || existing?.solicitationNumber;

  let possibleDuplicate = false;
  let possibleDuplicateOf: string | undefined;

  if (!existing) {
    const sec = secondaryDedupeKey(body);
    if (sec) {
      const otherId = await getSignalIdByHash(sec);
      if (otherId) {
        possibleDuplicate = true;
        possibleDuplicateOf = otherId;
      }
    }
  }

  if (existing) {
    const activities = [...(existing.activities ?? [])];
    if (activity) {
      activities.unshift({
        at: now,
        changeType: activity.changeType,
        summary: activity.summary,
      });
    }
    const updated: RapidIqPipelineSignal = {
      ...existing,
      sourceUrl,
      rawTitle: title,
      rawSnippet: snippet.slice(0, 2000),
      agencyName: body.agency.name.trim(),
      state: body.agency.state.toUpperCase(),
      jurisdiction: body.agency.city?.trim() || existing.jurisdiction,
      deadline: deadline ?? existing.deadline,
      // Never treat project_budget as NexCort contract value
      dollarAmount: contractValue != null ? contractValue : existing.dollarAmount,
      estimatedContractValue:
        contractValue != null ? contractValue : existing.estimatedContractValue,
      projectBudget:
        body.opportunity.project_budget != null
          ? body.opportunity.project_budget
          : existing.projectBudget,
      fundingAmount:
        body.opportunity.funding_amount != null
          ? body.opportunity.funding_amount
          : existing.fundingAmount,
      annualRecurringBudget:
        body.opportunity.annual_recurring_budget != null
          ? body.opportunity.annual_recurring_budget
          : existing.annualRecurringBudget,
      fundingSource:
        body.opportunity.funding_source?.trim() || existing.fundingSource,
      fundingNotes:
        body.opportunity.funding_notes?.trim() || existing.fundingNotes,
      solicitationNumber,
      summary: snippet.slice(0, 3000),
      recommendedAction: body.next_action?.trim() || existing.recommendedAction,
      procurementStage,
      fitScore: Math.max(existing.fitScore, fitScore),
      fitLabel: fitScore >= existing.fitScore ? fitLabel : existing.fitLabel,
      vertical,
      watchName: body.watch,
      watchStrategy: body.qualification?.strategy ?? existing.watchStrategy,
      externalKey,
      watchPayloadHash: payloadHash,
      evidence: mergeEvidence(existing.evidence, body.evidence, now),
      activities: activities.slice(0, 40),
      watchUpdated: Boolean(activity) || body.opportunity.status === "updated",
      lastWatchUpdateAt: now,
      status:
        existing.status === "pushed" || existing.status === "dismissed"
          ? existing.status
          : "new",
    };

    const changes = detectMaterialChanges(existing, updated, activity);
    const unchanged = changes.length === 0;

    if (!unchanged) {
      await putSignal(updated);
      await putExternalKeyPointer(externalKey, updated.signalId);
    } else {
      // Still persist hash so future identical posts short-circuit
      if (existing.watchPayloadHash !== payloadHash) {
        await putSignal({ ...existing, watchPayloadHash: payloadHash });
      }
    }
    return {
      signal: unchanged ? { ...existing, watchPayloadHash: payloadHash } : updated,
      action: unchanged ? "unchanged" : "updated",
      changes: unchanged ? [] : changes,
    };
  }

  const signalId = randomUUID();
  const hash = contentHash(`chatgpt-watch|${externalKey}|${sourceUrl}|${title}`, snippet);
  try {
    await reserveExternalKey(externalKey, signalId);
  } catch {
    const racedId = await getSignalIdByExternalKey(externalKey);
    if (racedId) {
      const raced = await getSignal(racedId);
      if (raced) return { signal: raced, action: "unchanged", changes: [] };
    }
    throw new Error("WATCH_EXTKEY_RESERVE_FAILED");
  }
  try {
    await reserveHash(hash, signalId);
  } catch {
    /* secondary content hash only */
  }
  const sec = secondaryDedupeKey(body);
  if (sec && !possibleDuplicate) {
    try {
      await reserveHash(sec, signalId);
    } catch {
      const otherId = await getSignalIdByHash(sec);
      if (otherId && otherId !== signalId) {
        possibleDuplicate = true;
        possibleDuplicateOf = otherId;
      }
    }
  }

  const contactHints =
    body.contact?.name?.trim()
      ? [
          {
            name: body.contact.name.trim(),
            title: body.contact.title?.trim() || undefined,
            source: "extracted" as const,
          },
        ]
      : undefined;

  const buying = applyBuyingIntelligence({
    title,
    text: `${title}\n${snippet}`,
    sourceUrl,
    agencyName: body.agency.name.trim(),
    state: body.agency.state.toUpperCase(),
    procurementStage,
  });

  const signal: RapidIqPipelineSignal = {
    signalId,
    sourceId: "chatgpt-watch",
    sourceUrl,
    rawTitle: title,
    rawSnippet: snippet.slice(0, 2000),
    contentHash: hash,
    signalDate: posted,
    ingestedAt: now,
    processedAt: now,
    agencyName: body.agency.name.trim(),
    jurisdiction: body.agency.city?.trim() || undefined,
    state: body.agency.state.toUpperCase(),
    agencyType: agencyTypeForVertical(vertical),
    dollarAmount: contractValue,
    estimatedContractValue: contractValue,
    projectBudget: body.opportunity.project_budget ?? undefined,
    fundingAmount: body.opportunity.funding_amount ?? undefined,
    annualRecurringBudget: body.opportunity.annual_recurring_budget ?? undefined,
    fundingSource: body.opportunity.funding_source?.trim() || undefined,
    fundingNotes: body.opportunity.funding_notes?.trim() || undefined,
    solicitationNumber,
    summary: snippet.slice(0, 3000),
    contactHints,
    fitScore,
    fitLabel,
    buyingIntentScore: fitScore,
    productFitScore: fitScore,
    combinedScore: fitScore,
    excerpt: snippet.slice(0, 500),
    sourceTitle: body.watch,
    sourceDomain: (() => {
      try {
        return new URL(sourceUrl).hostname.replace(/^www\./i, "");
      } catch {
        return undefined;
      }
    })(),
    documentDate: posted,
    recommendedAction: body.next_action?.trim(),
    deadline,
    procurementStage,
    status: "new",
    vertical,
    externalKey,
    watchName: body.watch,
    watchStrategy: body.qualification?.strategy,
    watchPayloadHash: payloadHash,
    watchUpdated: false,
    possibleDuplicate: possibleDuplicate || undefined,
    possibleDuplicateOf,
    evidence: mergeEvidence(undefined, body.evidence, now),
    activities: activity
      ? [{ at: now, changeType: activity.changeType, summary: activity.summary }]
      : [{ at: now, changeType: "new", summary: "Created from ChatGPT Watch." }],
    ...buying,
  };

  await putSignal(signal);
  return { signal, action: "created", changes: ["created"] };
}
