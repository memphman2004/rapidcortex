/**
 * Competitor newsroom + SAM.gov keyword watch.
 * Customer wins are future displacement opportunities (typical 3–5 year contracts).
 */

import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { classifyProcurementStage, isRelevantSignalText, KEYWORDS } from "rapid-cortex-shared";
import {
  fetchIngestText,
  parseIsoDate,
  parseRssOrAtomItems,
  sleep,
} from "../../../lib/rapid-iq/pipeline/ingest-fetch.js";
import {
  rapidIqIngestSinceSlashDate,
  rapidIqIngestUntilSlashDate,
} from "../../../lib/rapid-iq/ingest-window.js";
import { resolvePlainOrSecretArn } from "../../../lib/runtimeSecrets.js";
import { enqueueRelevantPage } from "./enqueue-crawled.js";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

const NEWSROOMS: Array<{ name: string; product?: string; url: string; rss?: string }> = [
  {
    name: "Motorola Solutions",
    product: "VESTA",
    url: "https://newsroom.motorolasolutions.com/",
    rss: "https://newsroom.motorolasolutions.com/rss",
  },
  { name: "CentralSquare", url: "https://www.centralsquare.com/news/" },
  { name: "Tyler Technologies", product: "Enterprise Public Safety", url: "https://www.tylertech.com/resources/newsroom" },
  { name: "Hexagon", product: "HxGN OnCall", url: "https://hexagon.com/company/newsroom" },
  { name: "RapidDeploy", url: "https://www.rapiddeploy.com/blog" },
  { name: "Intrado", url: "https://www.intrado.com/news" },
  { name: "Prepared", url: "https://www.prepared.com/blog" },
  { name: "Carbyne", url: "https://carbyne.com/news/" },
  { name: "Versaterm", url: "https://www.versaterm.com/news/" },
  { name: "Mark43", url: "https://mark43.com/news/" },
  { name: "Axon", product: "Axon 911", url: "https://www.axon.com/newsroom" },
];

const WIN_RE = /\b(selects?|awards?|awarded|deploys?|deployment|goes live|contract|customer)\b/i;

function estimatedContractEnd(from = new Date()): string {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + 4);
  return d.toISOString().slice(0, 10);
}

async function resolveSamApiKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.RAPID_IQ_SAM_GOV_API_KEY ?? process.env.SAM_GOV_API_KEY,
    process.env.RAPID_IQ_SAM_GOV_API_KEY_SECRET_ARN,
    { preferredField: "RAPID_IQ_SAM_GOV_API_KEY" },
  );
}

async function enqueueSnippet(args: {
  title: string;
  url: string;
  snippet: string;
  vendor: string;
  product?: string;
  fromSam?: boolean;
}): Promise<boolean> {
  const hay = `${args.title} ${args.snippet} ${args.vendor}`;
  if (!isRelevantSignalText(hay) && !KEYWORDS.competitors.some((n) => hay.toLowerCase().includes(n.toLowerCase()))) {
    return false;
  }
  const isWin = WIN_RE.test(hay);
  const signal: RapidIqPipelineRawSignal = {
    sourceId: "competitor-intel",
    sourceUrl: args.url,
    rawTitle: args.title.slice(0, 200),
    rawSnippet: JSON.stringify({
      competitorName: args.vendor,
      competitorProduct: args.product,
      signalType: args.fromSam || isWin ? "competitor-contract-award" : "competitor-win",
      estimatedContractEnd: estimatedContractEnd(),
      procurementStage: "future-opportunity",
      excerpt: args.snippet.slice(0, 1500),
      classifiedStage: classifyProcurementStage(hay),
    }),
    signalDate: parseIsoDate(undefined),
  };
  return enqueueRawSignal(signal, {
    dedupeId: `competitor-${args.url}`,
    groupId: "competitor-intel",
  });
}

async function searchSamForVendor(apiKey: string, vendor: string): Promise<number> {
  const today = new Date();
  const params = new URLSearchParams({
    api_key: apiKey,
    postedFrom: rapidIqIngestSinceSlashDate(today),
    postedTo: rapidIqIngestUntilSlashDate(today),
    limit: "25",
    offset: "0",
    title: vendor,
  });
  const res = await fetch(`https://api.sam.gov/opportunities/v2/search?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    console.warn(JSON.stringify({ msg: "competitor_sam_http_error", vendor, status: res.status }));
    return 0;
  }
  const data = (await res.json()) as {
    opportunitiesData?: Array<{
      noticeId: string;
      title: string;
      description?: string;
      uiLink?: string;
      organizationName?: string;
    }>;
  };
  let queued = 0;
  for (const opp of data.opportunitiesData ?? []) {
    const hay = `${opp.title} ${opp.description ?? ""}`;
    if (!isRelevantSignalText(hay)) continue;
    const ok = await enqueueSnippet({
      title: opp.title,
      url: opp.uiLink ?? `https://sam.gov/opp/${opp.noticeId}`,
      snippet: `${opp.organizationName ?? ""} ${opp.description ?? ""}`.slice(0, 1500),
      vendor,
      fromSam: true,
    });
    if (ok) queued += 1;
  }
  return queued;
}

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: competitor intel ingestion starting");

  if (await enqueueMockIfEnabled("competitor-intel")) {
    console.log("Rapid IQ pipeline: competitor-intel mock path complete");
    return;
  }

  let queued = 0;

  for (const vendor of NEWSROOMS) {
    if (vendor.rss) {
      const rss = await fetchIngestText(vendor.rss);
      if (rss.ok) {
        for (const item of parseRssOrAtomItems(rss.body)) {
          const ok = await enqueueSnippet({
            title: item.title,
            url: item.link,
            snippet: item.description,
            vendor: vendor.name,
            product: vendor.product,
          });
          if (ok) queued += 1;
        }
      }
    }
    const page = await fetchIngestText(vendor.url);
    if (page.ok) {
      queued += await enqueueRelevantPage(
        "competitor-intel",
        vendor.url,
        `${vendor.name} newsroom`,
        page.body,
        {
          competitorName: vendor.name,
          competitorProduct: vendor.product,
          procurementStage: "future-opportunity",
          estimatedContractEnd: estimatedContractEnd(),
        },
        12,
      );
    }
    await sleep(350);
  }

  const samKey = await resolveSamApiKey();
  if (samKey) {
    for (const name of ["Motorola Solutions", "CentralSquare", "Tyler Technologies", "Axon", "Hexagon"]) {
      try {
        queued += await searchSamForVendor(samKey, name);
      } catch (err) {
        console.error(`Competitor SAM search ${name} failed:`, err);
      }
      await sleep(400);
    }
  }

  console.log(JSON.stringify({ msg: "competitor_intel_complete", queued }));
}
