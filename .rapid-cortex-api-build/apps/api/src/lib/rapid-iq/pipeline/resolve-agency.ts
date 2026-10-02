/**
 * Resolve or create an agency intelligence profile in the pipeline table
 * (pk=AGENCY#{id}, sk=PROFILE). Does not create a separate Dynamo table.
 */

import { createHash } from "node:crypto";
import {
  displayPipelineScores,
  highestProcurementStage,
  recommendedActionFromStage,
  type RapidIqAgencyProfile,
  type RapidIqPipelineSignal,
} from "rapid-cortex-shared";
import {
  getAgencyProfile,
  getSignal,
  listAgencyProfiles,
  listAgencySignalLinks,
  putAgencyProfile,
  putAgencySignalLink,
  updateSignalFields,
} from "./rapid-iq-pipeline-db.js";

const STOP = new Set([
  "the",
  "county",
  "parish",
  "office",
  "department",
  "dept",
  "psap",
  "ecc",
  "of",
  "and",
]);

export function normalizeAgencyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .join(" ")
    .trim();
}

export function agencyIdFromName(name: string, state?: string): string {
  const key = `${normalizeAgencyName(name)}|${(state ?? "").toUpperCase().slice(0, 2)}`;
  const slug = key.replace(/[^a-zA-Z0-9|]+/g, "-").replace(/-+/g, "-").slice(0, 48);
  if (slug.length >= 8) return slug;
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function tokenOverlap(a: string, b: string): number {
  const aSet = new Set(a.split(" ").filter(Boolean));
  const bSet = new Set(b.split(" ").filter(Boolean));
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let hit = 0;
  for (const t of aSet) if (bSet.has(t)) hit += 1;
  return hit / Math.max(aSet.size, bSet.size);
}

function inferAgencyType(signal: RapidIqPipelineSignal): string {
  const hay = `${signal.agencyType ?? ""} ${signal.rawTitle} ${signal.summary ?? ""}`.toLowerCase();
  if (/\bcampus|university|college|k-12\b/.test(hay)) return "campus";
  if (/\bvenue|stadium|arena|airport\b/.test(hay)) return "venue";
  if (/\b911|psap|ecc|dispatch\b/.test(hay)) return "psap";
  if (/\bsheriff\b/.test(hay)) return "sheriff";
  if (/\bpolice\b/.test(hay)) return "police";
  if (/\bfire|ems\b/.test(hay)) return "fire";
  if (/\bema|emergency management\b/.test(hay)) return "ema";
  return signal.agencyType?.trim() || "unknown";
}

async function recomputeProfile(
  existing: RapidIqAgencyProfile | null,
  signal: RapidIqPipelineSignal,
  agencyId: string,
): Promise<RapidIqAgencyProfile> {
  const now = new Date().toISOString();
  const links = await listAgencySignalLinks(agencyId);
  const linkedSignals: RapidIqPipelineSignal[] = [];
  for (const link of links) {
    const s = await getSignal(link.signalId);
    if (s) linkedSignals.push(s);
  }
  if (!linkedSignals.some((s) => s.signalId === signal.signalId)) {
    linkedSignals.push(signal);
  }

  const scores = linkedSignals.map((s) => displayPipelineScores(s));
  let buyingIntentScore = Math.max(0, ...scores.map((s) => s.intent));
  const productFitScore = Math.max(0, ...scores.map((s) => s.fit));
  if (linkedSignals.length >= 3) {
    buyingIntentScore = Math.min(100, buyingIntentScore + 10);
  }
  const combinedScore = Math.round(buyingIntentScore * 0.6 + productFitScore * 0.4);
  const procurementStage = highestProcurementStage(linkedSignals.map((s) => s.procurementStage));
  const dates = linkedSignals.map((s) => s.signalDate).sort();
  const vendors = [
    ...new Set(
      linkedSignals
        .flatMap((s) => [s.vendorNamed, s.competitorName])
        .filter((v): v is string => Boolean(v?.trim())),
    ),
  ];

  const name = signal.agencyName?.trim() || existing?.name || "Unknown agency";
  return {
    agencyId,
    name: existing?.name && existing.name.length >= name.length ? existing.name : name,
    agencyType: existing?.agencyType && existing.agencyType !== "unknown" ? existing.agencyType : inferAgencyType(signal),
    state: (signal.state ?? existing?.state)?.toUpperCase().slice(0, 2),
    county: existing?.county,
    city: signal.jurisdiction ?? existing?.city,
    buyingIntentScore,
    productFitScore,
    combinedScore,
    procurementStage,
    signalCount: linkedSignals.length,
    lastSignalDate: dates[dates.length - 1] ?? signal.signalDate,
    firstSignalDate: existing?.firstSignalDate ?? dates[0] ?? signal.signalDate,
    incumbentVendors: vendors,
    estimatedValue:
      signal.dollarAmount != null && signal.dollarAmount > 0
        ? `$${Math.round(signal.dollarAmount).toLocaleString()}`
        : existing?.estimatedValue,
    recommendedAction: recommendedActionFromStage(procurementStage, buyingIntentScore),
    updatedAt: now,
    createdAt: existing?.createdAt ?? now,
    knownContracts: existing?.knownContracts,
    websiteUrl: existing?.websiteUrl,
    contactEmail: existing?.contactEmail,
    population: existing?.population,
    nextAction: existing?.nextAction,
  };
}

/**
 * Link a processed signal to an agency profile. Returns agencyId.
 */
export async function resolveAgency(signal: RapidIqPipelineSignal): Promise<string | null> {
  const name = signal.agencyName?.trim() || signal.jurisdiction?.trim();
  if (!name) return null;

  const proposedId = agencyIdFromName(name, signal.state);
  let match = await getAgencyProfile(proposedId);

  if (!match) {
    const normalized = normalizeAgencyName(name);
    const state = (signal.state ?? "").toUpperCase().slice(0, 2);
    const profiles = await listAgencyProfiles(200);
    match =
      profiles.find((p) => {
        if (state && p.state && p.state.toUpperCase() !== state) return false;
        return tokenOverlap(normalizeAgencyName(p.name), normalized) >= 0.5;
      }) ?? null;
  }

  const agencyId = match?.agencyId ?? proposedId;
  await putAgencySignalLink(agencyId, signal);
  const profile = await recomputeProfile(match, signal, agencyId);
  await putAgencyProfile(profile);
  await updateSignalFields(signal.signalId, {
    agencyProfileId: agencyId,
    recommendedAction: profile.recommendedAction,
  });
  return agencyId;
}
