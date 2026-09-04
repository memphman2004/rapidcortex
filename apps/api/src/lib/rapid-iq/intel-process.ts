import { isCollectorsMockEnabled } from "./agenda-finder.js";
import { getIntelWatch } from "./intel-db.js";
import { collectWatchSourceDocuments, mockWatchDocuments } from "./intel-sources.js";
import { upsertIntelOpportunity } from "./intel-upsert.js";
import { analyzeOpportunity, classifyProcurementSignal } from "./openai-service.js";
import type { RapidIqIntelOpportunity, RapidIqIntelSourceDocument, RapidIqIntelWatch } from "rapid-cortex-shared";

export async function processSourceDocument(input: {
  doc: RapidIqIntelSourceDocument;
  watch: RapidIqIntelWatch;
}): Promise<RapidIqIntelOpportunity | null> {
  const started = Date.now();
  const classified = await classifyProcurementSignal(input.doc, input.watch.market);
  if (!classified.result.relevant && classified.result.estimatedFit < input.watch.minimumFitScore) {
    console.log(
      JSON.stringify({
        msg: "rapid_iq_intel_skip_low_fit",
        watchId: input.watch.id,
        agency: input.watch.agency,
        sourceUrl: input.doc.url,
        fitScore: classified.result.estimatedFit,
        recommendation: "IGNORE",
        model: classified.model,
        durationMs: Date.now() - started,
        result: "skipped",
      }),
    );
    return null;
  }

  const analyzed = await analyzeOpportunity(input.doc, input.watch.market, classified.result);
  const effectiveFit = analyzed.result.fitScore;
  if (effectiveFit < input.watch.minimumFitScore && !analyzed.result.preRfpSignal) {
    console.log(
      JSON.stringify({
        msg: "rapid_iq_intel_below_watch_threshold",
        watchId: input.watch.id,
        agency: input.watch.agency,
        sourceUrl: input.doc.url,
        fitScore: effectiveFit,
        winSignal: analyzed.result.winSignal,
        recommendation: analyzed.result.recommendation,
        model: analyzed.model,
        durationMs: Date.now() - started,
        result: "filtered",
      }),
    );
    return null;
  }

  const { opportunity, created } = await upsertIntelOpportunity({
    doc: input.doc,
    extraction: analyzed.result,
    market: input.watch.market,
    modelUsed: analyzed.model,
    watchId: input.watch.id,
  });

  console.log(
    JSON.stringify({
      msg: "rapid_iq_intel_analyzed",
      watchId: input.watch.id,
      agency: opportunity.agency,
      sourceUrl: opportunity.sourceUrl,
      fitScore: opportunity.fitScore,
      winSignal: opportunity.winSignal,
      recommendation: opportunity.recommendation,
      model: analyzed.model,
      durationMs: Date.now() - started,
      result: created ? "created" : "updated",
    }),
  );
  return opportunity;
}

export async function processWatch(watchId: string): Promise<{
  watchId: string;
  agency: string;
  processed: number;
  upserted: number;
}> {
  const watch = await getIntelWatch(watchId);
  if (!watch) throw new Error(`Watch ${watchId} not found`);
  if (!watch.enabled) {
    return { watchId, agency: watch.agency, processed: 0, upserted: 0 };
  }

  const docs = isCollectorsMockEnabled() ? mockWatchDocuments(watch) : await collectWatchSourceDocuments(watch);
  let upserted = 0;
  for (const doc of docs) {
    try {
      const row = await processSourceDocument({ doc, watch });
      if (row) upserted += 1;
    } catch (err) {
      console.warn(
        JSON.stringify({
          msg: "rapid_iq_intel_doc_failed",
          watchId: watch.id,
          agency: watch.agency,
          sourceUrl: doc.url,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
  return { watchId, agency: watch.agency, processed: docs.length, upserted };
}
