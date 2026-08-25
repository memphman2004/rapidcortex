/**
 * APCO / NENA / NASNA trade association news — high-value 911 industry signals.
 */

import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { classifyProcurementStage, isRelevantSignalText } from "rapid-cortex-shared";
import {
  fetchIngestText,
  parseIsoDate,
  parseRssOrAtomItems,
  sleep,
} from "../../../lib/rapid-iq/pipeline/ingest-fetch.js";
import { enqueueRelevantPage } from "./enqueue-crawled.js";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

const RSS_FEEDS = [
  { id: "apco-rss", url: "https://www.apcointl.org/feed/", label: "APCO International" },
];

const HTML_PAGES = [
  { url: "https://www.apcointl.org/news/", name: "APCO news" },
  { url: "https://www.nena.org/news/", name: "NENA news" },
  { url: "https://nasna911.org/news/", name: "NASNA news" },
];

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: APCO/NENA/NASNA ingestion starting");

  if (await enqueueMockIfEnabled("trade-publication")) {
    console.log("Rapid IQ pipeline: trade-publication mock path complete");
    return;
  }

  let queued = 0;

  for (const feed of RSS_FEEDS) {
    const fetched = await fetchIngestText(feed.url);
    if (!fetched.ok) continue;
    for (const item of parseRssOrAtomItems(fetched.body)) {
      const hay = `${item.title} ${item.description}`;
      if (!isRelevantSignalText(hay)) continue;
      const signal: RapidIqPipelineRawSignal = {
        sourceId: "trade-publication",
        sourceUrl: item.link,
        rawTitle: item.title.slice(0, 200),
        rawSnippet: JSON.stringify({
          outlet: feed.label,
          excerpt: item.description.slice(0, 1500),
          procurementStage: classifyProcurementStage(hay),
        }),
        signalDate: parseIsoDate(item.pubDate),
      };
      if (
        await enqueueRawSignal(signal, {
          dedupeId: `trade-${item.guid || item.link}`,
          groupId: "trade-publication",
        })
      ) {
        queued += 1;
      }
    }
  }

  for (const page of HTML_PAGES) {
    const fetched = await fetchIngestText(page.url);
    if (!fetched.ok) {
      console.warn(JSON.stringify({ msg: "trade_pub_fetch_failed", url: page.url, status: fetched.status }));
      continue;
    }
    queued += await enqueueRelevantPage("trade-publication", page.url, page.name, fetched.body, {
      outlet: page.name,
    });
    await sleep(400);
  }

  console.log(`APCO/NENA/NASNA: queued ${queued} signals`);
}
