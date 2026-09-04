import { randomBytes } from "node:crypto";
import {
  intelStrategicPriority,
  normalizeIntelUrl,
  type RapidIqIntelAiExtraction,
  type RapidIqIntelMarket,
  type RapidIqIntelOpportunity,
  type RapidIqIntelSourceDocument,
} from "rapid-cortex-shared";
import { intelFingerprint } from "./intel-fingerprint.js";
import {
  getIntelIdByFingerprint,
  getIntelIdBySolicitation,
  getIntelIdByTitle,
  getIntelIdByUrl,
  getIntelOpportunity,
  putIntelOpportunity,
  reserveIntelIndexes,
} from "./intel-db.js";
import { extractSolicitationNumber, mergeIntelExtraction } from "./intel-merge.js";

function newIntelId(): string {
  return `intel_${randomBytes(9).toString("base64url").slice(0, 12)}`;
}

export async function findExistingIntelId(input: {
  agency: string;
  title: string;
  sourceUrl: string;
  solicitationNumber?: string | null;
  fingerprint: string;
}): Promise<string | null> {
  if (input.solicitationNumber?.trim()) {
    const bySol = await getIntelIdBySolicitation(input.agency, input.solicitationNumber);
    if (bySol) return bySol;
  }
  const byUrl = await getIntelIdByUrl(input.sourceUrl);
  if (byUrl) return byUrl;
  const byHash = await getIntelIdByFingerprint(input.fingerprint);
  if (byHash) return byHash;
  return getIntelIdByTitle(input.agency, input.title);
}

export async function upsertIntelOpportunity(input: {
  doc: RapidIqIntelSourceDocument;
  extraction: RapidIqIntelAiExtraction;
  market: RapidIqIntelMarket;
  modelUsed: string;
  watchId?: string;
}): Promise<{ opportunity: RapidIqIntelOpportunity; created: boolean }> {
  const agency = input.extraction.agency || input.doc.sourceName || "Unknown agency";
  const title = input.extraction.title || input.doc.title;
  const solicitation =
    extractSolicitationNumber(`${input.doc.title}\n${input.doc.text}`) ||
    input.extraction.solicitationNumber ||
    undefined;
  const fingerprint = intelFingerprint({
    agency,
    solicitationNumber: solicitation,
    title,
    dueDate: input.extraction.dueDate,
  });
  const existingId = await findExistingIntelId({
    agency,
    title,
    sourceUrl: input.doc.url,
    solicitationNumber: solicitation,
    fingerprint,
  });
  const existing = existingId ? await getIntelOpportunity(existingId) : null;
  const id = existing?.id ?? newIntelId();
  const opportunity = mergeIntelExtraction({
    existing,
    extraction: input.extraction,
    doc: input.doc,
    market: input.market,
    id,
    fingerprint,
    modelUsed: input.modelUsed,
    watchId: input.watchId,
  });
  opportunity.sourceUrl = existing?.sourceUrl || normalizeIntelUrl(input.doc.url) || input.doc.url;
  await putIntelOpportunity(opportunity);
  await reserveIntelIndexes({
    intelId: opportunity.id,
    fingerprint,
    sourceUrl: opportunity.sourceUrl,
    agency: opportunity.agency,
    title: opportunity.title,
    solicitationNumber: opportunity.solicitationNumber,
  });
  return { opportunity, created: !existing };
}

export { intelStrategicPriority };
