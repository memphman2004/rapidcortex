/**
 * CivicClerk agendas for large cities / counties.
 */

import registryJson from "../../../lib/rapid-iq/civiclerk-registry.json";
import { fetchIngestText, sleep } from "../../../lib/rapid-iq/pipeline/ingest-fetch.js";
import { enqueueRelevantPage } from "./enqueue-crawled.js";
import { enqueueMockIfEnabled } from "./queue-raw-signal.js";

type CivicClerkEntity = { slug: string; name: string; state: string };

const ENTITIES = (registryJson as { entities: CivicClerkEntity[] }).entities;

function agendasUrl(slug: string): string {
  return `https://www.civicclerk.com/web/${encodeURIComponent(slug)}/agendas.aspx`;
}

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: CivicClerk ingestion starting");

  if (await enqueueMockIfEnabled("civiclerk")) {
    console.log("Rapid IQ pipeline: CivicClerk mock path complete");
    return;
  }

  let queued = 0;
  for (const entity of ENTITIES) {
    const url = agendasUrl(entity.slug);
    const fetched = await fetchIngestText(url, 15_000);
    if (!fetched.ok) {
      console.warn(JSON.stringify({ msg: "civiclerk_fetch_failed", slug: entity.slug, status: fetched.status }));
      continue;
    }
    queued += await enqueueRelevantPage(
      "civiclerk",
      url,
      `${entity.name} agendas`,
      fetched.body,
      { agencyName: entity.name, state: entity.state },
      8,
    );
    await sleep(300);
  }

  console.log(`CivicClerk: queued ${queued} signals`);
}
