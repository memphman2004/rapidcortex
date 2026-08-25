/**
 * Grants.gov search2 ingest — 911 / NG911 / PSAP / CAD funding opportunities.
 * Maps to pipeline source `grants-gov` at procurementStage `funding-available`.
 */

import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { GRANTS_GOV_SEARCH_KEYWORDS, isRelevantSignalText } from "rapid-cortex-shared";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

type GrantHit = {
  id?: string | number;
  number?: string;
  title?: string;
  agencyName?: string;
  agencyCode?: string;
  openDate?: string;
  closeDate?: string;
  oppStatus?: string;
  synopsis?: string;
  awardCeiling?: string | number;
  awardFloor?: string | number;
  cfdaList?: Array<{ cfdaNumber?: string; programTitle?: string }>;
};

function parseMoney(value: string | number | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const n = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

async function searchGrants(keyword: string): Promise<GrantHit[]> {
  const res = await fetch("https://api.grants.gov/v1/api/search2", {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      keyword,
      oppStatuses: "posted|forecasted",
      rows: 25,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    console.warn(JSON.stringify({ msg: "grants_gov_search_http_error", keyword, status: res.status }));
    return [];
  }
  const body = (await res.json()) as { data?: { oppHits?: GrantHit[] }; oppHits?: GrantHit[] };
  return body.data?.oppHits ?? body.oppHits ?? [];
}

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: Grants.gov ingestion starting");

  if (await enqueueMockIfEnabled("grants-gov")) {
    console.log("Rapid IQ pipeline: Grants.gov mock path complete");
    return;
  }

  const seen = new Set<string>();
  let queued = 0;

  for (const keyword of GRANTS_GOV_SEARCH_KEYWORDS) {
    let hits: GrantHit[] = [];
    try {
      hits = await searchGrants(keyword);
    } catch (err) {
      console.error(`Grants.gov query "${keyword}" failed:`, err);
      continue;
    }

    for (const hit of hits) {
      const opportunityNumber = String(hit.number ?? hit.id ?? "").trim();
      const opportunityId = String(hit.id ?? opportunityNumber);
      if (!opportunityId || seen.has(opportunityId)) continue;
      const title = (hit.title ?? "Untitled grant").slice(0, 200);
      const description = hit.synopsis ?? "";
      if (!isRelevantSignalText(`${title} ${description} ${keyword}`)) continue;
      seen.add(opportunityId);

      const cfda = (hit.cfdaList ?? [])
        .map((c) => c.cfdaNumber)
        .filter((v): v is string => Boolean(v))
        .join(", ");
      const sourceUrl = opportunityNumber
        ? `https://www.grants.gov/search-results-detail/${encodeURIComponent(opportunityNumber)}`
        : "https://www.grants.gov";

      const signal: RapidIqPipelineRawSignal = {
        sourceId: "grants-gov",
        sourceUrl,
        rawTitle: title,
        rawSnippet: JSON.stringify({
          opportunityId,
          opportunityTitle: title,
          opportunityNumber,
          agencyName: hit.agencyName ?? hit.agencyCode ?? "",
          openDate: hit.openDate ?? "",
          closeDate: hit.closeDate ?? "",
          awardCeiling: parseMoney(hit.awardCeiling),
          awardFloor: parseMoney(hit.awardFloor),
          description: description.slice(0, 1500),
          category: hit.oppStatus ?? "posted",
          cfda,
          procurementStage: "funding-available",
        }),
        signalDate: (hit.openDate ?? new Date().toISOString()).slice(0, 10),
      };

      if (
        await enqueueRawSignal(signal, {
          dedupeId: `grants-gov-${opportunityId}`,
          groupId: "grants-gov",
        })
      ) {
        queued += 1;
      }
    }
  }

  console.log(`Grants.gov: queued ${queued} signals from ${seen.size} unique hits`);
}
