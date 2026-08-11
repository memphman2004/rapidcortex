import { extractPdfText, findAgendaDocuments } from "../../../lib/rapid-iq/agenda-finder.js";
import { classifySignal } from "../../../lib/rapid-iq/claude-classifier.js";
import type { Jurisdiction } from "../../../lib/rapid-iq/jurisdiction-registry.js";
import { upsertSignalAndOpportunity } from "./upsert-signal.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Takes the prioritized batch from the scheduler — NOT a static list. */
export async function runAgendaCollector(
  batch: Jurisdiction[],
): Promise<{ signalsFound: number }> {
  if (!Array.isArray(batch)) {
    throw new Error("runAgendaCollector requires a Jurisdiction[] batch");
  }

  let total = 0;
  for (const jurisdiction of batch) {
    try {
      const mockOn =
        process.env.RAPID_IQ_COLLECTORS_MOCK?.trim().toLowerCase() === "1" ||
        process.env.RAPID_IQ_COLLECTORS_MOCK?.trim().toLowerCase() === "true";
      await sleep(mockOn ? 10 : 2000);
      const docs = await findAgendaDocuments(jurisdiction);
      for (const doc of docs.slice(0, 5)) {
        const pdfText = await extractPdfText(doc.url);
        if (!pdfText || pdfText.length < 80) continue;
        const signal = await classifySignal(pdfText, doc.url, jurisdiction.name);
        if (signal.isRelevant) {
          if (!signal.state) signal.state = jurisdiction.stateCode;
          if (!signal.population) signal.population = jurisdiction.population;
          if (jurisdiction.type === "university" || jurisdiction.type === "university_system") {
            signal.vertical = "campus";
            signal.rcProduct = "campus";
            signal.agencyType = signal.agencyType ?? jurisdiction.type;
            signal.tags = Array.from(
              new Set(["CAMPUS SAFETY", ...(signal.tags ?? [])]),
            );
          }
          signal.sourceDocUrl = doc.url;
          // Prefer classified buyer; fall back to jurisdiction registry name (a real agency)
          if (!signal.agencyName?.trim()) signal.agencyName = jurisdiction.name;
          if (!signal.state?.trim()) signal.state = jurisdiction.stateCode;
          const result = await upsertSignalAndOpportunity(
            signal,
            doc.url,
            jurisdiction.name,
            "government_doc",
            jurisdiction.jurisdictionId,
          );
          if (result.saved) total++;
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "agenda_collector_error",
          jurisdiction: jurisdiction.name,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
  return { signalsFound: total };
}
