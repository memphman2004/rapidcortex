import type { RapidIqPipelineRawSignal, RapidIqPipelineSourceId } from "rapid-cortex-shared";
import { classifyProcurementStage, isRelevantSignalText } from "rapid-cortex-shared";
import {
  extractLinks,
  parseIsoDate,
  stripHtml,
} from "../../../lib/rapid-iq/pipeline/ingest-fetch.js";
import { enqueueRawSignal } from "./queue-raw-signal.js";

export async function enqueueRelevantPage(
  sourceId: RapidIqPipelineSourceId,
  pageUrl: string,
  pageName: string,
  html: string,
  extra: Record<string, unknown> = {},
  limit = 20,
): Promise<number> {
  let queued = 0;
  const pageText = stripHtml(html).slice(0, 4000);
  if (isRelevantSignalText(`${pageName} ${pageText}`)) {
    const signal: RapidIqPipelineRawSignal = {
      sourceId,
      sourceUrl: pageUrl,
      rawTitle: pageName.slice(0, 200),
      rawSnippet: JSON.stringify({
        page: pageName,
        excerpt: pageText.slice(0, 1500),
        procurementStage: classifyProcurementStage(`${pageName} ${pageText}`),
        ...extra,
      }),
      signalDate: parseIsoDate(undefined),
    };
    if (await enqueueRawSignal(signal, { dedupeId: `${sourceId}-${pageUrl}`, groupId: sourceId })) {
      queued += 1;
    }
  }

  const seen = new Set<string>([pageUrl]);
  for (const link of extractLinks(html, pageUrl)) {
    if (queued >= limit) break;
    if (seen.has(link.href)) continue;
    const hay = `${link.text} ${link.href}`;
    if (!isRelevantSignalText(hay)) continue;
    seen.add(link.href);
    const signal: RapidIqPipelineRawSignal = {
      sourceId,
      sourceUrl: link.href,
      rawTitle: link.text.slice(0, 200) || pageName,
      rawSnippet: JSON.stringify({
        page: pageName,
        parentUrl: pageUrl,
        excerpt: link.text,
        procurementStage: classifyProcurementStage(hay),
        ...extra,
      }),
      signalDate: parseIsoDate(undefined),
    };
    if (
      await enqueueRawSignal(signal, {
        dedupeId: `${sourceId}-${link.href}`,
        groupId: sourceId,
      })
    ) {
      queued += 1;
    }
  }
  return queued;
}
