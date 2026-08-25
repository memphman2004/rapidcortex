import { customProcurementPageUrls, customProcurementPathHint } from "./county-procurement.js";
import type { Jurisdiction, JurisdictionType } from "./jurisdiction-registry.js";

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

/** Same-host county/city purchasing boards (tried in addition to agenda hints). */
export const DEFAULT_PROCUREMENT_PATHS = [
  "/bids",
  "/procurement",
  "/purchasing",
  "/current-solicitations",
  "/rfps",
  "/bid-opportunities",
];

const LOCAL_GOV_TYPES: ReadonlySet<JurisdictionType> = new Set(["county", "city"]);
const CRAWL_HINT_CAP = 6;
const PROCUREMENT_HINT_CAP = 3;

/** County bid/RFP and agenda URLs that should be classified (not generic nav). */
const PROCUREMENT_OR_AGENDA_HREF_RE =
  /agenda|minute|meeting|packet|board|solicitation|procurement|esinet|ng911|ng-911|9-1-1|ngcs|dispatch|\/rfp(?:\/|$|\?|#|-)|\/rfq(?:\/|$|\?|#|-)|\/bids?(?:\/|$|\?|#|-)/i;

const PROCUREMENT_LISTING_PATH_RE =
  /(?:^|\/)(?:bids?|bid[-_]?opportunit(?:y|ies)|current[-_]?bids?|open[-_]?bids?|active[-_]?solicitations?|current[-_]?solicitations?|open[-_]?solicitations?|solicitations?|procurement|purchasing|rfps?|doing[-_]?business|vendors?)(?:\/|$|\.aspx)/i;

const BID_LISTING_TEXT_RE =
  /\b(rfp|rfq|ifb|itb|rfi|itn|solicitation|invitation to bid|request for propos|ng911|ng-911|9-1-1|\b911\b|esinet|ngcs|psap|dispatch|computer.?aided|public safety comm)/i;

const LISTING_PUBLIC_SAFETY_RE =
  /(911|9-1-1|ng911|esinet|ngcs|dispatch|public safety|cad\b|psap|emergency communications)/i;

const PUBLIC_SAFETY_SCORE_RE = /911|9-1-1|ng911|esinet|ngcs|psap|emergency communications|public safety comm/;
const DISPATCH_SCORE_RE = /dispatch|cad(?:[^a-z]|$)/;
const PROCUREMENT_SCORE_RE = /rfp|rfq|solicitation|procurement|bid/;

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

/** Hunter/Apollo must not skip solely because Anthropic is unset. */
export function isExplicitCollectorsMockEnabled(): boolean {
  const v = process.env.RAPID_IQ_COLLECTORS_MOCK?.trim().toLowerCase();
  return v === "1" || v === "true";
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

function pushUnique(docs: AgendaDocument[], doc: AgendaDocument): void {
  if (docs.some((d) => d.url === doc.url)) return;
  docs.push(doc);
}

function normalizeHint(path: string): string {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
}

function pathnameOf(urlOrPath: string): string {
  try {
    if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
      return new URL(urlOrPath).pathname;
    }
  } catch {
    /* fall through */
  }
  return urlOrPath;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * County/city crawls always include purchasing board paths. Agenda-only seeds
 * (most of the registry) would otherwise never hit /bids or /procurement.
 */
export function resolveCrawlPathHints(
  j: Pick<Jurisdiction, "type" | "agendaPathHints"> &
    Partial<Pick<Jurisdiction, "procurementPathHints" | "stateCode" | "name" | "agendaBaseUrl">>,
): string[] {
  const agenda = j.agendaPathHints ?? [];
  const registryPath =
    !j.procurementPathHints?.length &&
    j.stateCode &&
    j.name &&
    j.agendaBaseUrl &&
    LOCAL_GOV_TYPES.has(j.type)
      ? customProcurementPathHint({
          stateCode: j.stateCode,
          name: j.name,
          agendaBaseUrl: j.agendaBaseUrl,
        })
      : undefined;
  const procurement =
    j.procurementPathHints?.length
      ? j.procurementPathHints
      : LOCAL_GOV_TYPES.has(j.type)
        ? [...(registryPath ? [registryPath] : []), ...DEFAULT_PROCUREMENT_PATHS]
        : [];
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string, cap: number): void => {
    if (out.length >= cap) return;
    const norm = normalizeHint(raw);
    const key = norm.toLowerCase();
    if (!norm || seen.has(key)) return;
    seen.add(key);
    out.push(norm);
  };
  for (const p of procurement) add(p, PROCUREMENT_HINT_CAP);
  for (const p of agenda) add(p, CRAWL_HINT_CAP);
  for (const p of procurement) add(p, CRAWL_HINT_CAP);
  if (out.length === 0) {
    for (const p of AGENDA_URL_PATTERNS.slice(0, 3)) add(p, CRAWL_HINT_CAP);
  }
  return out;
}

export function isProcurementListingPath(pathOrUrl: string): boolean {
  return PROCUREMENT_LISTING_PATH_RE.test(pathnameOf(pathOrUrl));
}

export function isProcurementOrAgendaHref(href: string): boolean {
  const lower = href.toLowerCase();
  if (lower.startsWith("#") || lower.startsWith("mailto:") || lower.startsWith("javascript:")) {
    return false;
  }
  return PROCUREMENT_OR_AGENDA_HREF_RE.test(lower);
}

export function publicSafetyDocumentScore(doc: AgendaDocument): number {
  const t = `${doc.url} ${doc.title}`.toLowerCase();
  let score = 0;
  if (PUBLIC_SAFETY_SCORE_RE.test(t)) score += 10;
  if (DISPATCH_SCORE_RE.test(t)) score += 6;
  if (PROCUREMENT_SCORE_RE.test(t)) score += 2;
  return score;
}

export function collectDocumentLinksFromHtml(
  html: string,
  base: string,
  jurisdictionName: string,
  publishedAt: string,
  listingPageUrl?: string,
): AgendaDocument[] {
  const docs: AgendaDocument[] = [];
  const onProcurementListing = listingPageUrl ? isProcurementListingPath(listingPageUrl) : false;
  const seenHref = new Set<string>();

  const consider = (raw: string, label: string): void => {
    if (raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("javascript:")) {
      return;
    }
    const isPdf = /\.pdf(\?|#|$)/i.test(raw);
    const blob = `${label} ${raw}`;
    const fromHref = isPdf || isProcurementOrAgendaHref(raw);
    const fromListingText = onProcurementListing && BID_LISTING_TEXT_RE.test(blob);
    if (!fromHref && !fromListingText) return;
    const href = absoluteUrl(base, raw);
    if (seenHref.has(href)) return;
    seenHref.add(href);
    pushUnique(docs, {
      url: href,
      title:
        label ||
        href.split("/").pop() ||
        (isPdf ? "Agenda PDF" : `${jurisdictionName} ${onProcurementListing ? "bid" : "meeting"} page`),
      publishedAt,
    });
  };

  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html))) {
    const titleAttr = /\btitle=["']([^"']+)["']/i.exec(m[0])?.[1] ?? "";
    consider(m[1], stripTags(m[2] ?? "") || titleAttr);
  }

  const hrefRe = /href=["']([^"']+)["']/gi;
  while ((m = hrefRe.exec(html))) {
    consider(m[1], "");
  }

  if (listingPageUrl && LISTING_PUBLIC_SAFETY_RE.test(stripHtml(html))) {
    pushUnique(docs, {
      url: listingPageUrl,
      title: `${jurisdictionName} ${onProcurementListing ? "procurement" : "meetings"} listing`,
      publishedAt,
    });
  }

  docs.sort((a, b) => publicSafetyDocumentScore(b) - publicSafetyDocumentScore(a));
  return docs.slice(0, 12);
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
  const hints = resolveCrawlPathHints(j);
  const now = new Date().toISOString();
  const pageUrls = [
    ...hints.map((hint) => `${base}${hint.startsWith("/") ? hint : `/${hint}`}`),
    ...customProcurementPageUrls(j),
  ].filter((url, i, all) => all.indexOf(url) === i);

  for (const pageUrl of pageUrls) {
    try {
      const res = await fetch(pageUrl, {
        headers: { "user-agent": "RapidCortex-RapidIQ/1.0 (+https://rapidcortex.us)" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      let pageBase = base;
      try {
        pageBase = new URL(pageUrl).origin;
      } catch {
        pageBase = base;
      }
      for (const doc of collectDocumentLinksFromHtml(html, pageBase, j.name, now, pageUrl)) {
        pushUnique(docs, doc);
      }
    } catch {
      /* skip unreachable pages */
    }
  }

  docs.sort((a, b) => publicSafetyDocumentScore(b) - publicSafetyDocumentScore(a));
  const ranked = docs.slice(0, 12);

  console.log(
    JSON.stringify({
      msg: "agenda_finder_result",
      jurisdiction: j.name,
      crawlHints: hints,
      docsFound: ranked.length,
    }),
  );
  return ranked;
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
