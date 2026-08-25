/**
 * Cooperative purchasing (Sourcewell, OMNIA, NASPO ValuePoint, HGACBuy).
 */

import { fetchIngestText, sleep } from "../../../lib/rapid-iq/pipeline/ingest-fetch.js";
import { enqueueRelevantPage } from "./enqueue-crawled.js";
import { enqueueMockIfEnabled } from "./queue-raw-signal.js";

const PAGES = [
  { url: "https://www.sourcewell-mn.gov/cooperative-purchasing", name: "Sourcewell cooperative purchasing" },
  { url: "https://www.sourcewell-mn.gov/current-solicitations", name: "Sourcewell current solicitations" },
  { url: "https://www.omniapartners.com/publicsector", name: "OMNIA Partners public sector" },
  { url: "https://www.naspovaluepoint.org/portfolios/", name: "NASPO ValuePoint portfolios" },
  { url: "https://www.hgacbuy.org/", name: "HGACBuy" },
];

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: Sourcewell/OMNIA ingestion starting");

  if (await enqueueMockIfEnabled("sourcewell-omnia")) {
    console.log("Rapid IQ pipeline: sourcewell-omnia mock path complete");
    return;
  }

  let queued = 0;
  for (const page of PAGES) {
    const fetched = await fetchIngestText(page.url);
    if (!fetched.ok) {
      console.warn(JSON.stringify({ msg: "coop_purchasing_fetch_failed", url: page.url, status: fetched.status }));
      continue;
    }
    queued += await enqueueRelevantPage("sourcewell-omnia", page.url, page.name, fetched.body, {
      cooperative: page.name,
    });
    await sleep(400);
  }

  console.log(`Sourcewell/OMNIA/NASPO/HGAC: queued ${queued} signals`);
}
