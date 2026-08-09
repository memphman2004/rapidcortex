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

function collectorsMockEnabled(): boolean {
  const v = process.env.RAPID_IQ_COLLECTORS_MOCK?.trim().toLowerCase();
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  // Default mock when no live keys / CI
  return !process.env.RAPID_IQ_SAM_GOV_API_KEY_SECRET_ARN?.trim();
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

  // Live path: try path hints; extract .pdf links (best-effort, rate-limited by caller).
  const docs: AgendaDocument[] = [];
  const base = j.agendaBaseUrl.replace(/\/$/, "");
  const hints = j.agendaPathHints.length ? j.agendaPathHints : AGENDA_URL_PATTERNS.slice(0, 3);
  for (const hint of hints.slice(0, 3)) {
    try {
      const pageUrl = `${base}${hint.startsWith("/") ? hint : `/${hint}`}`;
      const res = await fetch(pageUrl, {
        headers: { "user-agent": "RapidCortex-RapidIQ/1.0 (+https://rapidcortex.us)" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const pdfRe = /href=["']([^"']+\.pdf[^"']*)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = pdfRe.exec(html)) && docs.length < 8) {
        let href = m[1];
        if (href.startsWith("//")) href = `https:${href}`;
        else if (href.startsWith("/")) href = `${base}${href}`;
        else if (!href.startsWith("http")) href = `${base}/${href}`;
        docs.push({
          url: href,
          title: href.split("/").pop() ?? "Agenda PDF",
          publishedAt: new Date().toISOString(),
        });
      }
    } catch {
      /* skip unreachable pages */
    }
  }
  return docs;
}

export async function extractPdfText(pdfUrl: string): Promise<string> {
  if (collectorsMockEnabled()) {
    return [
      "PUBLIC SAFETY TECHNOLOGY BUDGET DISCUSSION",
      "The Commission considers appropriation for computer-aided dispatch and NG911 modernization.",
      "Estimated project value $1,250,000 for public safety software procurement.",
      `Source document: ${pdfUrl}`,
    ].join("\n");
  }
  try {
    const res = await fetch(pdfUrl, {
      headers: { "user-agent": "RapidCortex-RapidIQ/1.0 (+https://rapidcortex.us)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    // Best-effort: extract printable ASCII from PDF streams (no pdf-parse dependency required).
    const raw = buf.toString("latin1");
    const text = raw
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 5000);
  } catch {
    return "";
  }
}

export function isCollectorsMockEnabled(): boolean {
  return collectorsMockEnabled();
}
