/**
 * SAM.gov opportunities ingestion — requires RAPID_IQ_SAM_GOV_API_KEY(_SECRET_ARN).
 */

import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { isRelevantSignalText } from "rapid-cortex-shared";
import {
  rapidIqIngestSinceSlashDate,
  rapidIqIngestUntilSlashDate,
} from "../../../lib/rapid-iq/ingest-window.js";
import { resolvePlainOrSecretArn } from "../../../lib/runtimeSecrets.js";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

const TARGET_NAICS = ["541512", "922190", "541519", "511210"];

interface SamOpportunity {
  noticeId: string;
  title: string;
  description?: string;
  organizationName?: string;
  postedDate: string;
  uiLink?: string;
  placeOfPerformance?: {
    state?: { code?: string };
    city?: { name?: string };
  };
  naicsCode?: string;
}

async function resolveSamApiKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.RAPID_IQ_SAM_GOV_API_KEY ?? process.env.SAM_GOV_API_KEY,
    process.env.RAPID_IQ_SAM_GOV_API_KEY_SECRET_ARN,
    { preferredField: "RAPID_IQ_SAM_GOV_API_KEY" },
  );
}

async function fetchOpportunities(apiKey: string): Promise<SamOpportunity[]> {
  const today = new Date();

  const params = new URLSearchParams({
    api_key: apiKey,
    postedFrom: rapidIqIngestSinceSlashDate(today),
    postedTo: rapidIqIngestUntilSlashDate(today),
    ptype: "o,p,k",
    limit: "100",
    offset: "0",
    naics: TARGET_NAICS.join(","),
  });

  const res = await fetch(`https://api.sam.gov/opportunities/v2/search?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`SAM.gov API error ${res.status}`);
  }

  const data = (await res.json()) as { opportunitiesData?: SamOpportunity[] };
  return data.opportunitiesData ?? [];
}

function isRelevant(opp: SamOpportunity): boolean {
  return isRelevantSignalText(`${opp.title} ${opp.description ?? ""}`);
}

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: SAM.gov ingestion starting");

  if (await enqueueMockIfEnabled("sam-gov")) {
    console.log("Rapid IQ pipeline: SAM.gov mock path complete");
    return;
  }

  const apiKey = await resolveSamApiKey();
  if (!apiKey) {
    console.warn("SAM.gov API key not set — skipping SAM.gov ingestion");
    return;
  }

  let opps: SamOpportunity[];
  try {
    opps = await fetchOpportunities(apiKey);
  } catch (err) {
    console.error("SAM.gov fetch failed:", err);
    return;
  }

  const relevant = opps.filter(isRelevant);
  console.log(`SAM.gov: ${opps.length} opportunities → ${relevant.length} relevant`);

  for (const opp of relevant) {
    const signal: RapidIqPipelineRawSignal = {
      sourceId: "sam-gov",
      sourceUrl: opp.uiLink ?? `https://sam.gov/opp/${opp.noticeId}`,
      rawTitle: (opp.title ?? "").slice(0, 200),
      rawSnippet: JSON.stringify({
        title: opp.title,
        description: (opp.description ?? "").slice(0, 1500),
        organization: opp.organizationName,
        state: opp.placeOfPerformance?.state?.code,
        city: opp.placeOfPerformance?.city?.name,
        naics: opp.naicsCode,
        postedDate: opp.postedDate,
      }),
      signalDate: (opp.postedDate ?? new Date().toISOString()).slice(0, 10),
    };

    await enqueueRawSignal(signal, { dedupeId: `sam-gov-${opp.noticeId}` });
  }

  console.log(`SAM.gov: queued ${relevant.length} signals`);
}
