/**
 * 911.gov + FCC 911 fee/report crawl — highest-fit source for RC Core.
 */

import { fetchIngestText, sleep } from "../../../lib/rapid-iq/pipeline/ingest-fetch.js";
import { enqueueRelevantPage } from "./enqueue-crawled.js";
import { enqueueMockIfEnabled } from "./queue-raw-signal.js";

const PAGES: Array<{ url: string; name: string; sourceId: "911-gov" | "fcc-reports" }> = [
  { url: "https://www.911.gov/projects/federal-funding/", name: "Federal 911 Funding", sourceId: "911-gov" },
  { url: "https://www.911.gov/issues/ng911/", name: "NG911 state implementation", sourceId: "911-gov" },
  { url: "https://www.911.gov/projects/national-911-profile/", name: "National 911 Profile Database", sourceId: "911-gov" },
  { url: "https://www.911.gov/news/", name: "911.gov news", sourceId: "911-gov" },
  { url: "https://www.911.gov/docs-and-tools/", name: "911.gov documents library", sourceId: "911-gov" },
  {
    url: "https://www.fcc.gov/general/911-fee-collection-and-disposition",
    name: "FCC 911 fee collection and disposition",
    sourceId: "fcc-reports",
  },
  {
    url: "https://www.fcc.gov/ecfs/search/search-filings?q=911",
    name: "FCC ECFS 911 filings",
    sourceId: "fcc-reports",
  },
];

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: 911.gov ingestion starting");

  if (await enqueueMockIfEnabled("911-gov")) {
    console.log("Rapid IQ pipeline: 911.gov mock path complete");
    return;
  }

  let queued = 0;
  for (const page of PAGES) {
    const fetched = await fetchIngestText(page.url);
    if (!fetched.ok) {
      console.warn(JSON.stringify({ msg: "nine11_gov_fetch_failed", url: page.url, status: fetched.status }));
      continue;
    }
    queued += await enqueueRelevantPage(
      page.sourceId,
      page.url,
      page.name,
      fetched.body,
      { site: page.sourceId },
      15,
    );
    await sleep(400);
  }

  console.log(`911.gov / FCC: queued ${queued} signals`);
}
