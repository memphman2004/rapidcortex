/**
 * Queue a Rapid IQ opportunity into the procurement pipeline (status: new)
 * so it can be reviewed and pushed to CRM without converting immediately.
 */

import { randomUUID } from "node:crypto";
import {
  classifyProcurementStage,
  type EnqueueRapidIqPipelineFromOpportunityBody,
  type RapidIqPipelineSignal,
} from "rapid-cortex-shared";
import { applySignalIntelligence } from "./apply-signal-intelligence.js";
import { enrichAgencyIntelligence } from "./enrich-agency-contacts.js";
import {
  contentHash,
  getSignal,
  getSignalIdByHash,
  putSignal,
  reserveHash,
  updateSignalStatus,
} from "./rapid-iq-pipeline-db.js";
import { resolveAgency } from "./resolve-agency.js";

export function opportunityPipelineHash(opportunityId: string): string {
  return contentHash(`rapid-iq-opp|${opportunityId}`, opportunityId);
}

export function opportunityPipelineSourceUrl(opportunityId: string): string {
  return `https://app.rapidcortex.us/rc-admin/rapid-iq#${encodeURIComponent(opportunityId)}`;
}

export async function enqueueOpportunityToPipeline(
  body: EnqueueRapidIqPipelineFromOpportunityBody,
): Promise<{ signal: RapidIqPipelineSignal; alreadyQueued: boolean }> {
  const hash = opportunityPipelineHash(body.opportunityId);
  const existingId = await getSignalIdByHash(hash);
  if (existingId) {
    const existing = await getSignal(existingId);
    if (existing) {
      if (existing.status === "dismissed") {
        const updated = await updateSignalStatus(existingId, "new");
        return { signal: updated, alreadyQueued: false };
      }
      return { signal: existing, alreadyQueued: true };
    }
  }

  const now = new Date().toISOString();
  const signalId = randomUUID();
  const headline = body.headline?.trim() || body.agencyName;
  const hay = `${headline}\n${body.summary ?? ""}`;
  const procurementStage = classifyProcurementStage(hay);
  const intel = applySignalIntelligence({
    hay,
    sourceId: "rapid-iq",
    sourceUrl: opportunityPipelineSourceUrl(body.opportunityId),
    signalDate: now.slice(0, 10),
    agencyType: body.agencyType,
    sourceTitle: headline,
    documentDate: now.slice(0, 10),
    procurementStage,
    excerpt: (body.summary ?? "").slice(0, 500),
    legacyExtractScore: body.fitScore,
  });

  const signal: RapidIqPipelineSignal = {
    signalId,
    sourceId: "rapid-iq",
    sourceUrl: opportunityPipelineSourceUrl(body.opportunityId),
    rawTitle: headline,
    rawSnippet: (body.summary ?? "").slice(0, 2000),
    contentHash: hash,
    signalDate: now.slice(0, 10),
    ingestedAt: now,
    processedAt: now,
    agencyName: body.agencyName,
    jurisdiction: body.city,
    state: body.state,
    agencyType: body.agencyType,
    vendorNamed: body.vendorNamed,
    dollarAmount: body.estimatedDollarValue,
    summary: body.summary,
    procurementStage,
    status: "new",
    opportunityId: body.opportunityId,
    vertical: body.vertical,
    ...intel,
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
    if (agencyId && (signal.combinedScore ?? signal.fitScore) >= 60) {
      await enrichAgencyIntelligence(agencyId, { ...signal, agencyProfileId: agencyId });
    }
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "rapid_iq_enqueue_agency_resolve_failed",
        signalId,
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
  }
  return { signal, alreadyQueued: false };
}
