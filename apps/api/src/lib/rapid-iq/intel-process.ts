import { isCollectorsMockEnabled } from "./agenda-finder.js";
import { getIntelWatch } from "./intel-db.js";
import { collectWatchSourceDocuments, mockWatchDocuments } from "./intel-sources.js";
import { upsertIntelOpportunity } from "./intel-upsert.js";
import { analyzeOpportunity, classifyProcurementSignal } from "./openai-service.js";
import { discoverUrlsForWatch } from "./openai-web-search-discoverer.js";
import type { RapidIqIntelOpportunity, RapidIqIntelSourceDocument, RapidIqIntelWatch } from "rapid-cortex-shared";

function watchFitFloor(watch: RapidIqIntelWatch, preRfp: boolean): number {
  if (preRfp) return watch.preRfpFloor ?? Math.min(5, watch.minimumFitScore);
  return watch.minimumFitScore;
}

export async function processSourceDocument(input: {
  doc: RapidIqIntelSourceDocument;
  watch: RapidIqIntelWatch;
}): Promise<RapidIqIntelOpportunity | null> {
  const started = Date.now();
  const classified = await classifyProcurementSignal(input.doc, input.watch.market);
  const classifyFloor = watchFitFloor(input.watch, classified.result.preRfpSignal);
  if (!classified.result.relevant && classified.result.estimatedFit < classifyFloor) {
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
  const analyzeFloor = watchFitFloor(input.watch, analyzed.result.preRfpSignal);
  if (effectiveFit < analyzeFloor) {
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

export type ProcessWatchResult = {
  watchId: string;
  agency: string;
  processed: number;
  upserted: number;
  urls_fetched: number;
  intel_rows_written: number;
  web_search_urls_discovered: number;
  web_search_source_ids: string[];
  web_search_skipped: boolean;
  web_search_skip_reason?: string;
};

export async function processWatch(watchId: string): Promise<ProcessWatchResult> {
  const watch = await getIntelWatch(watchId);
  if (!watch) throw new Error(`Watch ${watchId} not found`);
  if (!watch.enabled) {
    return {
      watchId,
      agency: watch.agency,
      processed: 0,
      upserted: 0,
      urls_fetched: 0,
      intel_rows_written: 0,
      web_search_urls_discovered: 0,
      web_search_source_ids: [],
      web_search_skipped: true,
      web_search_skip_reason: "watch_disabled",
    };
  }

  const extraUrls: Array<{ url: string; sourceType: "openai_web_search" }> = [];
  let discoverySkipped = true;
  let discoverySkipReason: string | undefined = "not_run";
  if (!isCollectorsMockEnabled()) {
    const discovery = await discoverUrlsForWatch(watch);
    discoverySkipped = discovery.skipped;
    discoverySkipReason = discovery.skipReason;
    for (const url of discovery.discoveredUrls) {
      extraUrls.push({ url, sourceType: "openai_web_search" });
    }
  } else {
    discoverySkipReason = "collectors_mock";
  }
  const docs = isCollectorsMockEnabled()
    ? mockWatchDocuments(watch)
    : await collectWatchSourceDocuments(watch, 8, extraUrls);
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
  return {
    watchId,
    agency: watch.agency,
    processed: docs.length,
    upserted,
    urls_fetched: docs.length,
    intel_rows_written: upserted,
    web_search_urls_discovered: extraUrls.length,
    web_search_source_ids: extraUrls.length ? (["openai-web-search"] as string[]) : [],
    web_search_skipped: discoverySkipped,
    web_search_skip_reason: discoverySkipReason,
  };
}
