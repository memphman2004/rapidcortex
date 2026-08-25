/**
 * Manual Rapid IQ signal from public-record sources.
 */

import { randomUUID } from "node:crypto";
import type {
  CreateManualRapidIqPipelineSignalBody,
  RapidIqPipelineSignal,
} from "rapid-cortex-shared";
import { applySignalIntelligence } from "./apply-signal-intelligence.js";
import { enrichAgencyIntelligence } from "./enrich-agency-contacts.js";
import { contentHash, getSignal, getSignalIdByHash, putSignal, reserveHash } from "./rapid-iq-pipeline-db.js";
import { resolveAgency } from "./resolve-agency.js";

function parseDollar(raw?: string): number | undefined {
  if (!raw?.trim()) return undefined;
  const cleaned = raw.replace(/[$,]/g, "").trim();
  const m = cleaned.match(/^([\d.]+)\s*(k|m|million)?$/i);
  if (!m) return undefined;
  let n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  const suffix = (m[2] ?? "").toLowerCase();
  if (suffix === "k") n *= 1_000;
  if (suffix === "m" || suffix === "million") n *= 1_000_000;
  return n;
}

export async function createManualPipelineSignal(
  body: CreateManualRapidIqPipelineSignalBody,
  enteredBy: string,
): Promise<{ signal: RapidIqPipelineSignal; alreadyQueued: boolean }> {
  const hay = `${body.title}\n${body.excerpt ?? ""}`;
  const hash = contentHash(`manual|${body.sourceUrl}|${body.title}`, hay);
  const existingId = await getSignalIdByHash(hash);
  if (existingId) {
    const existing = await getSignal(existingId);
    if (existing) return { signal: existing, alreadyQueued: true };
  }

  const now = new Date().toISOString();
  const signalId = randomUUID();
  const sourceUrl = body.sourceUrl;
  const intel = applySignalIntelligence({
    hay,
    sourceId: "manual",
    sourceUrl,
    signalDate: (body.documentDate || now).slice(0, 10),
    agencyType: body.agencyType,
    excerpt: body.excerpt,
    sourceTitle: body.sourceName || body.title,
    documentDate: body.documentDate,
    procurementStage: body.procurementStage,
  });

  const signal: RapidIqPipelineSignal = {
    signalId,
    sourceId: "manual",
    sourceUrl,
    rawTitle: body.title,
    rawSnippet: (body.excerpt ?? body.title).slice(0, 2000),
    contentHash: hash,
    signalDate: (body.documentDate || now).slice(0, 10),
    ingestedAt: now,
    processedAt: now,
    agencyName: body.agencyName,
    state: body.state.toUpperCase(),
    agencyType: body.agencyType,
    dollarAmount: parseDollar(body.estimatedValue),
    summary: body.excerpt,
    procurementStage: body.procurementStage,
    status: "new",
    manualEntry: true,
    enteredBy,
    deadline: body.deadline,
    ...intel,
    sourceTitle: body.sourceName || intel.sourceTitle || body.title,
  };

  try {
    await reserveHash(hash, signalId);
  } catch {
    const racedId = await getSignalIdByHash(hash);
    if (racedId) {
      const raced = await getSignal(racedId);
      if (raced) return { signal: raced, alreadyQueued: true };
    }
    throw new Error("PIPELINE_HASH_RESERVE_FAILED");
  }

  await putSignal(signal);
  try {
    const agencyId = await resolveAgency(signal);
    if (agencyId) {
      await enrichAgencyIntelligence(agencyId, { ...signal, agencyProfileId: agencyId });
    }
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "rapid_iq_manual_agency_resolve_failed",
        signalId,
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
  }
  return { signal, alreadyQueued: false };
}
