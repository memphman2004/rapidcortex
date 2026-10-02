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
import {
  contentHash,
  getSignal,
  getSignalIdByExternalKey,
  putExternalKeyPointer,
  putSignal,
  reserveExternalKey,
  reserveHash,
} from "./rapid-iq-pipeline-db.js";

export type WatchIngestResult = {
  signal: RapidIqPipelineSignal;
  action: "created" | "updated" | "unchanged";
};

const FIT_SCORES: Record<"high" | "medium" | "low", number> = {
  high: 82,
  medium: 58,
  low: 34,
};

function mapVertical(v: RapidIqWatchIngestBody["vertical"]): RapidIqPipelineFeedTab {
  switch (v) {
    case "911_psap":
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

function normalizeDeadline(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const d = raw.trim();
  // Prefer YYYY-MM-DD when ISO datetime provided
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  return d.slice(0, 32);
}

function agencyTypeForVertical(vertical: RapidIqPipelineFeedTab): string {
  if (vertical === "campus") return "campus";
  if (vertical === "venue") return "venue";
  if (vertical === "competitor") return "competitor_watch";
  if (vertical === "transit") return "transit";
  return "psap";
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
  // Prefer official procurement first
  out.sort((a, b) => {
    const rank = (t: string) =>
      t === "official_procurement" ? 0 : t === "board_agenda" ? 1 : t === "news" ? 2 : 3;
    return rank(a.sourceType) - rank(b.sourceType);
  });
  return out.slice(0, 20);
}

function buildActivity(
  body: RapidIqWatchIngestBody,
  prior: RapidIqPipelineSignal | null,
  now: string,
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

export async function ingestWatchSignal(body: RapidIqWatchIngestBody): Promise<WatchIngestResult> {
  const now = new Date().toISOString();
  const externalKey = body.external_key.trim();
  const existingId = await getSignalIdByExternalKey(externalKey);
  const existing = existingId ? await getSignal(existingId) : null;

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
  const activity = buildActivity(body, existing, now);

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
      dollarAmount:
        body.opportunity.estimated_value != null
          ? body.opportunity.estimated_value
          : existing.dollarAmount,
      summary: snippet.slice(0, 2000),
      recommendedAction: body.next_action?.trim() || existing.recommendedAction,
      procurementStage,
      fitScore: Math.max(existing.fitScore, fitScore),
      fitLabel: fitScore >= existing.fitScore ? fitLabel : existing.fitLabel,
      vertical,
      watchName: body.watch,
      externalKey,
      evidence: mergeEvidence(existing.evidence, body.evidence, now),
      activities: activities.slice(0, 40),
      watchUpdated: Boolean(activity) || body.opportunity.status === "updated",
      lastWatchUpdateAt: now,
      // Stay in inbox unless already pushed/dismissed
      status:
        existing.status === "pushed" || existing.status === "dismissed"
          ? existing.status
          : "new",
    };

    const unchanged =
      !activity &&
      existing.deadline === updated.deadline &&
      existing.sourceUrl === updated.sourceUrl &&
      existing.rawTitle === updated.rawTitle;

    if (!unchanged) {
      await putSignal(updated);
      await putExternalKeyPointer(externalKey, updated.signalId);
    }
    return { signal: updated, action: unchanged ? "unchanged" : "updated" };
  }

  const signalId = randomUUID();
  const hash = contentHash(`chatgpt-watch|${externalKey}|${sourceUrl}|${title}`, snippet);
  try {
    await reserveExternalKey(externalKey, signalId);
  } catch {
    const racedId = await getSignalIdByExternalKey(externalKey);
    if (racedId) {
      const raced = await getSignal(racedId);
      if (raced) return { signal: raced, action: "unchanged" };
    }
    throw new Error("WATCH_EXTKEY_RESERVE_FAILED");
  }
  try {
    await reserveHash(hash, signalId);
  } catch {
    // Secondary dedupe only — EXTKEY already reserved
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
    dollarAmount: body.opportunity.estimated_value ?? undefined,
    summary: snippet.slice(0, 2000),
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
    watchUpdated: false,
    evidence: mergeEvidence(undefined, body.evidence, now),
    activities: activity
      ? [{ at: now, changeType: activity.changeType, summary: activity.summary }]
      : [{ at: now, changeType: "new", summary: "Created from ChatGPT Watch." }],
  };

  await putSignal(signal);
  return { signal, action: "created" };
}
