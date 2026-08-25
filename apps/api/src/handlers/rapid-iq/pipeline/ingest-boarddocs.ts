/**
 * BoardDocs agenda/minutes crawl for large public-safety-relevant entities.
 */

import registryJson from "../../../lib/rapid-iq/boarddocs-registry.json";
import { fetchIngestText, sleep } from "../../../lib/rapid-iq/pipeline/ingest-fetch.js";
import { enqueueRelevantPage } from "./enqueue-crawled.js";
import { enqueueMockIfEnabled } from "./queue-raw-signal.js";

type BoardDocsEntity = {
  state: string;
  slug: string;
  name: string;
  kind?: string;
};

const ENTITIES = (registryJson as { entities: BoardDocsEntity[] }).entities;
const BATCH_SIZE = 12;

function publicUrl(entity: BoardDocsEntity): string {
  return `https://go.boarddocs.com/${entity.state}/${entity.slug}/Board.nsf/Public`;
}

function meetingListUrl(entity: BoardDocsEntity): string {
  return `https://go.boarddocs.com/${entity.state}/${entity.slug}/Board.nsf/BD-PEOPLE-PUB-REST-API/meeting-list`;
}

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: BoardDocs ingestion starting");

  if (await enqueueMockIfEnabled("boarddocs")) {
    console.log("Rapid IQ pipeline: BoardDocs mock path complete");
    return;
  }

  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const start = (dayIndex * BATCH_SIZE) % Math.max(ENTITIES.length, 1);
  const batch = Array.from({ length: Math.min(BATCH_SIZE, ENTITIES.length) }, (_, i) => {
    return ENTITIES[(start + i) % ENTITIES.length]!;
  });

  let queued = 0;
  for (const entity of batch) {
    const extra = { agencyName: entity.name, state: entity.state.toUpperCase(), kind: entity.kind };
    for (const url of [publicUrl(entity), meetingListUrl(entity)]) {
      const fetched = await fetchIngestText(url, 15_000);
      if (!fetched.ok) continue;
      queued += await enqueueRelevantPage(
        "boarddocs",
        url === publicUrl(entity) ? publicUrl(entity) : url,
        `${entity.name} BoardDocs`,
        fetched.body,
        extra,
        8,
      );
    }
    await sleep(300);
  }

  console.log(`BoardDocs: queued ${queued} signals from ${batch.length} entities`);
}
