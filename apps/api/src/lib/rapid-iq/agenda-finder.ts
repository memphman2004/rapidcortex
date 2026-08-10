import type { Jurisdiction } from "./jurisdiction-registry.js";

export const AGENDA_URL_PATTERNS = [
  "/government/agendas",
  "/commission/agendas",
  "/commissioners/agendas",
  "/council/agendas",
  "/board/agendas",
  "/meetings/agendas",
  "/city-council/agendas",
  "/county-commission",
  "/board-of-commissioners",
  "/public-meetings",
  "/minutes",
];

export type AgendaDocument = {
  url: string;
  title: string;
  publishedAt: string;
};

/**
 * Mock collectors only when explicitly enabled.
 * Live Anthropic / scraping must not collapse to mock solely because SAM.gov is unset.
 */
function collectorsMockEnabled(): boolean {
  const v = process.env.RAPID_IQ_COLLECTORS_MOCK?.trim().toLowerCase();
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  // Unset: mock only in CI / when no Anthropic path is configured
  const hasAnthropic =
    Boolean(process.env.ANTHROPIC_API_KEY?.trim()) ||
    Boolean(process.env.ANTHROPIC_API_KEY_SECRET_ARN?.trim());
  return !hasAnthropic;
}

export function isCollectorsMockEnabled(): boolean {
  return collectorsMockEnabled();
}

function absoluteUrl(base: string, href: string): string {
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${base}${href}`;
  return `${base}/${href}`;
}

function pushUnique(docs: AgendaDocument[], doc: AgendaDocument, limit = 12): void {
  if (docs.length >= limit) return;
  if (docs.some((d) => d.url === doc.url)) return;
  docs.push(doc);
}

export async function findAgendaDocuments(j: Jurisdiction): Promise<AgendaDocument[]> {
  if (collectorsMockEnabled()) {
    const now = new Date().toISOString();
    return [
      {
        url: `${j.agendaBaseUrl}${j.agendaPathHints[0] ?? "/agendas"}/mock-agenda.pdf`,
        title: `${j.name} Commission Agenda (mock)`,
        publishedAt: now,
      },
    ];
  }

  const docs: AgendaDocument[] = [];
  const base = j.agendaBaseUrl.replace(/\/$/, "");
  const hints = j.agendaPathHints.length ? j.agendaPathHints : AGENDA_URL_PATTERNS.slice(0, 3);
  const now = new Date().toISOString();

  for (const hint of hints.slice(0, 4)) {
    try {
      const pageUrl = `${base}${hint.startsWith("/") ? hint : `/${hint}`}`;
      const res = await fetch(pageUrl, {
        headers: { "user-agent": "RapidCortex-RapidIQ/1.0 (+https://rapidcortex.us)" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Prefer PDF agenda/minutes links
      const pdfRe = /href=["']([^"']+\.pdf[^"']*)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = pdfRe.exec(html)) && docs.length < 12) {
        const href = absoluteUrl(base, m[1]);
        pushUnique(docs, {
          url: href,
          title: href.split("/").pop() ?? "Agenda PDF",
          publishedAt: now,
        });
      }

      // Also collect agenda/minutes HTML pages (many counties publish HTML, not PDF)
      const htmlDocRe =
        /href=["']([^"']*(?:agenda|minute|meeting|packet|board)[^"']*)["']/gi;
      while ((m = htmlDocRe.exec(html)) && docs.length < 12) {
        const raw = m[1];
        if (raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("javascript:")) {
          continue;
        }
        const href = absoluteUrl(base, raw);
        pushUnique(docs, {
          url: href,
          title: href.split("/").pop() || `${j.name} meeting page`,
          publishedAt: now,
        });
      }

      // If the listing page itself has public-safety keywords, treat it as a document
      const listingText = stripHtml(html).toLowerCase();
      if (
        /(911|ng911|dispatch|public safety|cad\b|psap|emergency communications)/i.test(listingText)
      ) {
        pushUnique(docs, {
          url: pageUrl,
          title: `${j.name} meetings listing`,
          publishedAt: now,
        });
      }
    } catch {
      /* skip unreachable pages */
    }
  }

  console.log(
    JSON.stringify({
      msg: "agenda_finder_result",
      jurisdiction: j.name,
      docsFound: docs.length,
    }),
  );
  return docs;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract readable text from a PDF or HTML page URL. */
export async function extractPdfText(pdfUrl: string): Promise<string> {
  return extractDocumentText(pdfUrl);
}

export async function extractDocumentText(docUrl: string): Promise<string> {
  if (collectorsMockEnabled()) {
    return [
      "PUBLIC SAFETY TECHNOLOGY BUDGET DISCUSSION",
      "The Commission considers appropriation for computer-aided dispatch and NG911 modernization.",
      "Estimated project value $1,250,000 for public safety software procurement.",
      `Source document: ${docUrl}`,
    ].join("\n");
  }
  try {
    const res = await fetch(docUrl, {
      headers: { "user-agent": "RapidCortex-RapidIQ/1.0 (+https://rapidcortex.us)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return "";
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());

    if (contentType.includes("html") || docUrl.toLowerCase().includes(".htm")) {
      return stripHtml(buf.toString("utf8")).slice(0, 6000);
    }

    // PDF / binary: best-effort printable ASCII extraction
    const raw = buf.toString("latin1");
    const text = raw
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 200) return text.slice(0, 5000);

    // Fallback: try UTF-8 strip if it looked like HTML mislabeled
    const asUtf = stripHtml(buf.toString("utf8"));
    return asUtf.slice(0, 6000);
  } catch {
    return "";
  }
}
