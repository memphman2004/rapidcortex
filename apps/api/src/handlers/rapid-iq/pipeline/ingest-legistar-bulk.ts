/**
 * Legistar bulk ingestion — discovers public clients via Legistar registry,
 * processes rotating batches (DynamoDB cursor), queues relevant board items.
 * Replaces ingest-granicus.ts (hardcoded 7 clients).
 */

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { isCivicDocumentIngestText } from "rapid-cortex-shared";
import { rapidIqIngestLookbackDays } from "../../../lib/rapid-iq/ingest-window.js";
import { pipelineDdb } from "../../../lib/rapid-iq/pipeline-ddb.js";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

const LEGISTAR_BASE = "https://webapi.legistar.com/v1";
const CURSOR_PK = "LEGISTAR#CURSOR";
const CURSOR_SK = "META";
/** ~600 clients / 60 per run ≈ full coverage every ~10 days with daily runs. */
const BATCH_SIZE = 60;

interface LegistarClient {
  ClientId: number;
  ClientName: string;
  ClientURL: string;
  TimeZone?: string;
}

interface LegistarEvent {
  EventId: number;
  EventBodyName: string;
  EventDate: string;
  EventAgendaLastPublishedUTC?: string;
}

interface LegistarEventItem {
  EventItemId: number;
  EventItemTitle?: string;
  EventItemMatterTitle?: string;
  EventItemMatterName?: string;
  EventItemActionName?: string;
}

function signalsTable(): string {
  const t = process.env.RAPID_IQ_PIPELINE_SIGNALS_TABLE?.trim();
  if (!t) throw new Error("RAPID_IQ_PIPELINE_SIGNALS_TABLE_NOT_CONFIGURED");
  return t;
}

async function readCursor(): Promise<number> {
  try {
    const res = await pipelineDdb.send(
      new GetCommand({
        TableName: signalsTable(),
        Key: { pk: CURSOR_PK, sk: CURSOR_SK },
      }),
    );
    const offset = res.Item?.offset;
    return typeof offset === "number" ? offset : 0;
  } catch {
    return 0;
  }
}

async function writeCursor(offset: number, total: number): Promise<void> {
  await pipelineDdb.send(
    new PutCommand({
      TableName: signalsTable(),
      Item: {
        pk: CURSOR_PK,
        sk: CURSOR_SK,
        offset,
        total,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
}

async function fetchAllClients(): Promise<LegistarClient[]> {
  const res = await fetch(`${LEGISTAR_BASE}/clients`, {
    headers: { "User-Agent": "RapidCortex-IQ/1.0 (procurement-monitor)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Legistar client list HTTP ${res.status}`);
  return res.json() as Promise<LegistarClient[]>;
}

async function fetchRecentEvents(clientSlug: string, daysBack: number): Promise<LegistarEvent[]> {
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  const fromStr = from.toISOString().slice(0, 10);

  const url =
    `${LEGISTAR_BASE}/${clientSlug}/events` +
    `?$filter=EventDate+ge+datetime'${fromStr}'` +
    `&$top=30` +
    `&$select=EventId,EventBodyName,EventDate,EventAgendaLastPublishedUTC`;

  const res = await fetch(url, {
    headers: { "User-Agent": "RapidCortex-IQ/1.0 (procurement-monitor)" },
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 404) return [];
  if (!res.ok) {
    console.warn(`Legistar events ${clientSlug}: HTTP ${res.status}`);
    return [];
  }
  return res.json() as Promise<LegistarEvent[]>;
}

async function fetchEventItems(
  clientSlug: string,
  eventId: number,
): Promise<LegistarEventItem[]> {
  const url =
    `${LEGISTAR_BASE}/${clientSlug}/eventitems` +
    `?$filter=EventId+eq+${eventId}` +
    `&$top=100` +
    `&$select=EventItemId,EventItemTitle,EventItemMatterTitle,EventItemMatterName,EventItemActionName`;

  const res = await fetch(url, {
    headers: { "User-Agent": "RapidCortex-IQ/1.0 (procurement-monitor)" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return [];
  return res.json() as Promise<LegistarEventItem[]>;
}

function isRelevantText(text: string): boolean {
  return isCivicDocumentIngestText(text);
}

function clientSlugFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".legistar.com")) {
      return u.hostname.replace(".legistar.com", "");
    }
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] ?? null;
  } catch {
    return null;
  }
}

async function queueItem(
  client: LegistarClient,
  slug: string,
  event: LegistarEvent,
  item: LegistarEventItem,
): Promise<void> {
  const signal: RapidIqPipelineRawSignal = {
    sourceId: "legistar-bulk",
    sourceUrl: client.ClientURL,
    rawTitle:
      `[${client.ClientName}] ${item.EventItemMatterTitle ?? item.EventItemTitle ?? "Board Item"}`.slice(
        0,
        200,
      ),
    rawSnippet: JSON.stringify({
      client: client.ClientName,
      clientUrl: client.ClientURL,
      body: event.EventBodyName,
      date: event.EventDate,
      itemTitle: item.EventItemTitle,
      matterTitle: item.EventItemMatterTitle,
      matterName: item.EventItemMatterName,
      action: item.EventItemActionName,
    }),
    signalDate: (event.EventDate ?? new Date().toISOString()).slice(0, 10),
  };

  await enqueueRawSignal(signal, {
    dedupeId: `legistar-${slug}-${event.EventId}-${item.EventItemId}`,
    groupId: "legistar-bulk",
  });
}

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: Legistar bulk ingestion starting");

  if (await enqueueMockIfEnabled("legistar-bulk")) {
    console.log("Rapid IQ pipeline: Legistar bulk mock path complete");
    return;
  }

  let allClients: LegistarClient[];
  try {
    allClients = await fetchAllClients();
    console.log(`Legistar: ${allClients.length} total clients`);
  } catch (err) {
    console.error("Failed to fetch Legistar client list:", err);
    return;
  }

  if (allClients.length === 0) {
    console.warn("Legistar: empty client list");
    return;
  }

  const cursor = await readCursor();
  const start = cursor % allClients.length;
  const batch = allClients.slice(start, start + BATCH_SIZE);
  const nextOffset = (start + BATCH_SIZE) % allClients.length;

  console.log(
    `Processing clients ${start}–${start + batch.length - 1} of ${allClients.length}`,
  );

  let signalsQueued = 0;

  for (const client of batch) {
    const slug = clientSlugFromUrl(client.ClientURL);
    if (!slug) continue;

    try {
      const events = await fetchRecentEvents(slug, rapidIqIngestLookbackDays());

      for (const event of events) {
        const items = await fetchEventItems(slug, event.EventId);
        for (const item of items) {
          const combinedText = [
            event.EventBodyName,
            item.EventItemTitle,
            item.EventItemMatterTitle,
            item.EventItemMatterName,
            item.EventItemActionName,
          ]
            .filter(Boolean)
            .join(" ");

          if (!isRelevantText(combinedText)) continue;
          await queueItem(client, slug, event, item);
          signalsQueued++;
        }
      }

      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.warn(`Legistar client ${slug} failed:`, (err as Error).message);
    }
  }

  await writeCursor(nextOffset, allClients.length);
  console.log(`Legistar bulk: queued ${signalsQueued} signals. Next cursor: ${nextOffset}`);
}
