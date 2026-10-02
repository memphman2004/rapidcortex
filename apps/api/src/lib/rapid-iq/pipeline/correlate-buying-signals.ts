/**
 * Correlate a new discovery into an existing Inbox opportunity when the
 * same agency + tech category already has an open card.
 * Never creates Leads or Pipeline rows.
 */

import type { RapidIqPipelineSignal } from "rapid-cortex-shared";
import {
  getSignal,
  getSignalIdByCorrelationKey,
  putCorrelationPointer,
  putSignal,
} from "./rapid-iq-pipeline-db.js";

const STALE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

export type CorrelateResult =
  | { action: "created"; signal: RapidIqPipelineSignal }
  | { action: "merged"; signal: RapidIqPipelineSignal };

/**
 * If an open correlated signal exists, append lifecycle activity + evidence
 * and return that card. Otherwise return the new signal unchanged (caller puts it).
 */
export async function correlateOrKeep(
  incoming: RapidIqPipelineSignal,
): Promise<CorrelateResult> {
  const key = incoming.correlationKey?.trim();
  if (!key) {
    return { action: "created", signal: incoming };
  }

  const existingId = await getSignalIdByCorrelationKey(key);
  if (!existingId || existingId === incoming.signalId) {
    await putCorrelationPointer(key, incoming.signalId);
    return { action: "created", signal: incoming };
  }

  const existing = await getSignal(existingId);
  if (!existing || existing.status === "dismissed" || existing.status === "pushed") {
    await putCorrelationPointer(key, incoming.signalId);
    return { action: "created", signal: incoming };
  }

  const last = existing.lastWatchUpdateAt || existing.processedAt || existing.ingestedAt;
  if (last && Date.now() - new Date(last).getTime() > STALE_MS) {
    await putCorrelationPointer(key, incoming.signalId);
    return { action: "created", signal: incoming };
  }

  const now = new Date().toISOString();
  const activities = [...(existing.activities ?? [])];
  activities.unshift({
    at: now,
    changeType: incoming.buyingSignalType || incoming.signalCategory || "related_signal",
    summary:
      incoming.facts?.[0] ||
      incoming.rawTitle ||
      "Related public-sector signal correlated.",
  });

  const evidence = [...(existing.evidence ?? [])];
  const seen = new Set(evidence.map((e) => e.url));
  if (incoming.sourceUrl && !seen.has(incoming.sourceUrl)) {
    evidence.unshift({
      url: incoming.sourceUrl,
      sourceType: "other",
      retrievedAt: now,
    });
  }
  for (const e of incoming.evidence ?? []) {
    if (seen.has(e.url)) continue;
    evidence.push(e);
    seen.add(e.url);
  }

  const merged: RapidIqPipelineSignal = {
    ...existing,
    activities: activities.slice(0, 40),
    evidence: evidence.slice(0, 25),
    facts: [...new Set([...(existing.facts ?? []), ...(incoming.facts ?? [])])].slice(0, 20),
    inferences: [...new Set([...(existing.inferences ?? []), ...(incoming.inferences ?? [])])].slice(
      0,
      20,
    ),
    competitors: [
      ...new Set([...(existing.competitors ?? []), ...(incoming.competitors ?? [])]),
    ].slice(0, 20),
    matchedCapabilities: [
      ...new Set([
        ...(existing.matchedCapabilities ?? []),
        ...(incoming.matchedCapabilities ?? []),
      ]),
    ].slice(0, 20),
    painPoints: [...(existing.painPoints ?? []), ...(incoming.painPoints ?? [])].slice(0, 20),
    verticals: [...new Set([...(existing.verticals ?? []), ...(incoming.verticals ?? [])])].slice(
      0,
      8,
    ),
    buyingStage: preferLaterStage(existing.buyingStage, incoming.buyingStage),
    signalStrength: preferStronger(existing.signalStrength, incoming.signalStrength),
    priorityBand: preferPriority(existing.priorityBand, incoming.priorityBand),
    priorityReasons: [
      ...new Set([...(existing.priorityReasons ?? []), ...(incoming.priorityReasons ?? [])]),
    ].slice(0, 12),
    watchUpdated: true,
    lastWatchUpdateAt: now,
    fitScore: Math.max(existing.fitScore, incoming.fitScore),
  };

  await putSignal(merged);
  await putCorrelationPointer(key, merged.signalId);
  return { action: "merged", signal: merged };
}

function preferLaterStage(
  a: RapidIqPipelineSignal["buyingStage"],
  b: RapidIqPipelineSignal["buyingStage"],
): RapidIqPipelineSignal["buyingStage"] {
  const order = [
    "awareness",
    "planning",
    "funded",
    "evaluating",
    "procurement_live",
    "award_pending",
    "implementation",
    "renewal",
    "closed",
  ] as const;
  const ai = a ? order.indexOf(a) : -1;
  const bi = b ? order.indexOf(b) : -1;
  if (bi > ai) return b;
  return a ?? b;
}

function preferStronger(
  a: RapidIqPipelineSignal["signalStrength"],
  b: RapidIqPipelineSignal["signalStrength"],
): RapidIqPipelineSignal["signalStrength"] {
  const order = ["weak", "moderate", "strong", "confirmed"] as const;
  const ai = a ? order.indexOf(a) : -1;
  const bi = b ? order.indexOf(b) : -1;
  if (bi > ai) return b;
  return a ?? b;
}

function preferPriority(
  a: RapidIqPipelineSignal["priorityBand"],
  b: RapidIqPipelineSignal["priorityBand"],
): RapidIqPipelineSignal["priorityBand"] {
  const order = ["monitor", "medium", "high", "urgent"] as const;
  const ai = a ? order.indexOf(a) : -1;
  const bi = b ? order.indexOf(b) : -1;
  if (bi > ai) return b;
  return a ?? b;
}
