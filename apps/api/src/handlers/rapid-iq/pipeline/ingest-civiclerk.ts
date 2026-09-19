/**
 * CivicClerk agendas for large cities / counties.
 */

import registryJson from "../../../lib/rapid-iq/civiclerk-registry.json";
import { fetchIngestText, sleep } from "../../../lib/rapid-iq/pipeline/ingest-fetch.js";
import { enqueueRelevantPage } from "./enqueue-crawled.js";
import { enqueueMockIfEnabled } from "./queue-raw-signal.js";

type CivicClerkEntity = { slug: string; name: string; state: string };

const ENTITIES = (registryJson as { entities: CivicClerkEntity[] }).entities;

function civicClerkUrls(slug: string): string[] {
  return [
    `https://${encodeURIComponent(slug)}.portal.civicclerk.com/`,
    `https://www.civicclerk.com/web/${encodeURIComponent(slug)}/agendas.aspx`,
  ];
}

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: CivicClerk ingestion starting");

  if (await enqueueMockIfEnabled("civiclerk")) {
    console.log("Rapid IQ pipeline: CivicClerk mock path complete");
    return;
  }

  let queued = 0;
  for (const entity of ENTITIES) {
    let fetched: { ok: boolean; status: number; body: string } | null = null;
    let usedUrl = civicClerkUrls(entity.slug)[0]!;
    for (const url of civicClerkUrls(entity.slug)) {
      const attempt = await fetchIngestText(url, 15_000, { browserLike: true });
      if (attempt.ok && attempt.body.trim()) {
        fetched = attempt;
        usedUrl = url;
        break;
      }
      fetched = attempt;
      usedUrl = url;
    }
    if (!fetched?.ok) {
      console.warn(JSON.stringify({ msg: "civiclerk_fetch_failed", slug: entity.slug, status: fetched?.status ?? 0 }));
      continue;
    }
    queued += await enqueueRelevantPage(
      "civiclerk",
      usedUrl,
      `${entity.name} agendas`,
      fetched.body,
      { agencyName: entity.name, state: entity.state },
      8,
      { forcePage: true },
    );
    await sleep(300);
  }

  console.log(`CivicClerk: queued ${queued} signals`);
}
