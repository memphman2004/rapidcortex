import type { RapidIqPipelineRawSignal, RapidIqPipelineSourceId } from "rapid-cortex-shared";
import { classifyProcurementStage, isCivicDocumentIngestText } from "rapid-cortex-shared";
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
  options?: { forcePage?: boolean },
): Promise<number> {
  let queued = 0;
  const pageText = stripHtml(html).slice(0, 4000);
  const month = new Date().toISOString().slice(0, 7);
  if (options?.forcePage || isCivicDocumentIngestText(`${pageName} ${pageText}`)) {
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
    if (
      await enqueueRawSignal(signal, {
        dedupeId: `${sourceId}-${pageUrl}-${month}`,
        groupId: sourceId,
      })
    ) {
      queued += 1;
    }
  }

  const seen = new Set<string>([pageUrl]);
  for (const link of extractLinks(html, pageUrl)) {
    if (queued >= limit) break;
    if (seen.has(link.href)) continue;
    const hay = `${link.text} ${link.href}`;
    const looksLikeDoc =
      /\.(pdf|docx?|xlsx?|pptx?)(\?|$)/i.test(link.href) ||
      /\b(agenda|minutes|meeting|procurement|bid|rfp|grant|budget|ng911|psap)\b/i.test(hay);
    if (!isCivicDocumentIngestText(hay) && !(options?.forcePage && looksLikeDoc)) continue;
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
