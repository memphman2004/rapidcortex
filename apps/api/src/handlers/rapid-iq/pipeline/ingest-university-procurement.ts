/**
 * University purchasing portals + Bonfire campus-safety search.
 */

import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { classifyProcurementStage, isRelevantSignalText } from "rapid-cortex-shared";
import registryJson from "../../../lib/rapid-iq/university-procurement-registry.json";
import { fetchIngestText, parseIsoDate, sleep, stripHtml } from "../../../lib/rapid-iq/pipeline/ingest-fetch.js";
import { enqueueRelevantPage } from "./enqueue-crawled.js";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

type Institution = {
  name: string;
  state: string;
  enrollment?: number;
  purchasingUrl?: string;
  bonfireHost?: string;
};

const INSTITUTIONS = (registryJson as { institutions: Institution[] }).institutions;
const BATCH_SIZE = 10;
const CAMPUS_TERMS = ["campus safety", "dispatch", "security", "emergency", "communications", "CAD"];

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: university procurement ingestion starting");

  if (await enqueueMockIfEnabled("university-procurement")) {
    console.log("Rapid IQ pipeline: university-procurement mock path complete");
    return;
  }

  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const start = (dayIndex * BATCH_SIZE) % Math.max(INSTITUTIONS.length, 1);
  const batch = Array.from({ length: Math.min(BATCH_SIZE, INSTITUTIONS.length) }, (_, i) => {
    return INSTITUTIONS[(start + i) % INSTITUTIONS.length]!;
  });

  let queued = 0;
  for (const inst of batch) {
    const extra = {
      agencyName: inst.name,
      state: inst.state,
      enrollment: inst.enrollment,
    };
    if (inst.purchasingUrl) {
      const page = await fetchIngestText(inst.purchasingUrl);
      if (page.ok) {
        queued += await enqueueRelevantPage(
          "university-procurement",
          inst.purchasingUrl,
          `${inst.name} purchasing`,
          page.body,
          extra,
          8,
        );
      }
    }
    if (inst.bonfireHost) {
      const bonfireUrl = `https://${inst.bonfireHost}/portal`;
      const page = await fetchIngestText(bonfireUrl);
      if (page.ok) {
        const text = stripHtml(page.body);
        if (isRelevantSignalText(text) || CAMPUS_TERMS.some((t) => text.toLowerCase().includes(t))) {
          const signal: RapidIqPipelineRawSignal = {
            sourceId: "university-procurement",
            sourceUrl: bonfireUrl,
            rawTitle: `${inst.name} Bonfire portal`.slice(0, 200),
            rawSnippet: JSON.stringify({
              ...extra,
              excerpt: text.slice(0, 1500),
              procurementStage: classifyProcurementStage(text),
            }),
            signalDate: parseIsoDate(undefined),
          };
          if (
            await enqueueRawSignal(signal, {
              dedupeId: `univ-bonfire-${inst.bonfireHost}`,
              groupId: "university-procurement",
            })
          ) {
            queued += 1;
          }
        }
      }
    }
    await sleep(300);
  }

  console.log(`University procurement: queued ${queued} signals from ${batch.length} institutions`);
}
