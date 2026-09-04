import {
  normalizeIntelTitle,
  normalizeIntelUrl,
  type RapidIqIntelAiExtraction,
  type RapidIqIntelOpportunity,
  type RapidIqIntelSourceDocument,
  type RapidIqIntelSupportingSource,
} from "rapid-cortex-shared";

function nonEmpty(value: string | null | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

export function extractSolicitationNumber(text: string): string | undefined {
  const match = text.match(
    /\b(?:RFP|RFQ|RFI|RFB|IFB|ITB|solicitation)\s*[#:.-]?\s*([A-Z0-9][A-Z0-9/._-]{3,})/i,
  );
  return match?.[1]?.trim();
}

export function extractEstimatedValue(text: string): number | undefined {
  const match = text.match(/\$\s*([\d,.]+)\s*(million|billion|m\b|b\b|k\b)?/i);
  if (!match) return undefined;
  const n = Number.parseFloat(match[1]!.replace(/,/g, ""));
  if (!Number.isFinite(n)) return undefined;
  const unit = (match[2] ?? "").toLowerCase();
  if (unit.startsWith("b")) return n * 1_000_000_000;
  if (unit.startsWith("m")) return n * 1_000_000;
  if (unit.startsWith("k")) return n * 1_000;
  return n;
}

function coalesce<T>(...vals: Array<T | null | undefined>): T | undefined {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && !v.trim()) continue;
    return v;
  }
  return undefined;
}

/** Source-derived facts override AI inference; existing source facts beat new AI guesses. */
export function mergeIntelExtraction(input: {
  existing?: RapidIqIntelOpportunity | null;
  extraction: RapidIqIntelAiExtraction;
  doc: RapidIqIntelSourceDocument;
  market: RapidIqIntelOpportunity["market"];
  id: string;
  fingerprint: string;
  modelUsed: string;
  watchId?: string;
  now?: string;
}): RapidIqIntelOpportunity {
  const { existing, extraction, doc } = input;
  const now = input.now ?? new Date().toISOString();
  const sourceTitle = nonEmpty(doc.title);
  const genericTitle = sourceTitle && existing?.agency && sourceTitle === existing.agency;
  const title = coalesce(
    genericTitle ? undefined : sourceTitle,
    existing?.title,
    extraction.title,
    "Untitled opportunity",
  )!;
  const solicitationNumber = coalesce(
    extractSolicitationNumber(`${doc.title}\n${doc.text}`),
    existing?.solicitationNumber,
    extraction.solicitationNumber ?? undefined,
  );
  const postedDate = coalesce(doc.publishedAt, existing?.postedDate, extraction.postedDate ?? undefined);
  const dueDate = coalesce(existing?.dueDate, extraction.dueDate ?? undefined);
  const estimatedValue = coalesce(
    extractEstimatedValue(`${doc.title}\n${doc.text}`),
    existing?.estimatedValue,
    extraction.estimatedValue ?? undefined,
  );
  const source: RapidIqIntelSupportingSource = {
    url: doc.url,
    title: doc.title,
    sourceType: doc.sourceType,
    retrievedAt: doc.retrievedAt,
  };
  const sources = mergeSources(existing?.sources, source);

  const workflowStatus =
    existing && existing.status !== "NEW" ? existing.status : existing?.status ?? "NEW";

  return {
    id: input.id,
    agencyId: existing?.agencyId ?? doc.agencyId,
    agency: coalesce(existing?.agency, extraction.agency, doc.sourceName, "Unknown agency")!,
    market: input.market,
    title,
    solicitationNumber,
    opportunityType: extraction.opportunityType,
    issuingDepartment: coalesce(existing?.issuingDepartment, extraction.issuingDepartment ?? undefined),
    postedDate,
    dueDate,
    estimatedValue,
    estimatedValueText: coalesce(existing?.estimatedValueText, extraction.estimatedValueText ?? undefined),
    currency: coalesce(existing?.currency, extraction.currency ?? undefined, "USD"),
    contact: extraction.contact ?? existing?.contact,
    sourceUrl: existing?.sourceUrl || normalizeIntelUrl(doc.url) || doc.url,
    sourceName: coalesce(doc.sourceName, existing?.sourceName),
    categories: extraction.categories.length > 0 ? extraction.categories : existing?.categories ?? [],
    rapidCortexProducts:
      extraction.rapidCortexProducts.length > 0
        ? extraction.rapidCortexProducts
        : existing?.rapidCortexProducts ?? ["CORE"],
    fitScore: extraction.fitScore,
    winSignal: extraction.winSignal,
    confidence: extraction.confidence,
    recommendation: extraction.recommendation,
    procurementStage: extraction.procurementStage,
    preRfpSignal: extraction.preRfpSignal,
    reason: extraction.reason,
    recommendedAction: extraction.recommendedAction,
    competitiveNotes: coalesce(extraction.competitiveNotes ?? undefined, existing?.competitiveNotes),
    partnerStrategy: coalesce(extraction.partnerStrategy ?? undefined, existing?.partnerStrategy),
    incumbentTechnology:
      extraction.incumbentTechnology ?? existing?.incumbentTechnology,
    discoveredAt: existing?.discoveredAt ?? now,
    lastUpdatedAt: now,
    status: workflowStatus,
    fingerprint: input.fingerprint,
    retrievedAt: doc.retrievedAt,
    analyzedAt: now,
    modelUsed: input.modelUsed,
    sources,
    aiRecommendation: extraction.recommendation,
    userRecommendation: existing?.userRecommendation,
    userFitScore: existing?.userFitScore,
    userWinSignal: existing?.userWinSignal,
    userProcurementStage: existing?.userProcurementStage,
    pursuitBrief: existing?.pursuitBrief,
    watchId: input.watchId ?? existing?.watchId,
    notes: existing?.notes,
  };
}

export function mergeSources(
  existing: RapidIqIntelSupportingSource[] | undefined,
  next: RapidIqIntelSupportingSource,
): RapidIqIntelSupportingSource[] {
  const list = [...(existing ?? [])];
  const key = normalizeIntelUrl(next.url);
  if (!list.some((s) => normalizeIntelUrl(s.url) === key)) {
    list.push(next);
  }
  return list.slice(0, 12);
}

export function titleIndexKey(agency: string, title: string): string {
  return `INTELTITLE#${agency.trim().toLowerCase()}#${normalizeIntelTitle(title)}`;
}
