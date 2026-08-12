/**
 * Rapid IQ — LA28 Olympic procurement monitor (RAMPLA.org).
 *
 * ## Live site inspection (2026-08-11)
 * - Correct base: https://www.rampla.org/s/  (https://www.rampla.org/opportunities → 404)
 * - Search: https://www.rampla.org/s/opportunities
 * - Detail: https://www.rampla.org/s/opportunity-details?id=006… (Salesforce Opportunity Id)
 * - Announcement: https://www.rampla.org/s/procurement-announcement-details
 * - Stack: Salesforce Experience Cloud (Aura/LWC SPA). Guest HTML is a loading shell;
 *   Aura remoting returns "Guest user access is not allowed".
 * - Filter chrome observed: Category, Status (Open/Closed/…), Type (RFP, RFI, RFQ, IFB, …).
 * - Optional: set RAPID_IQ_RAMP_SESSION_COOKIE for an authenticated session that can load rows.
 * - Supplier.IO (https://supplier.io/la28) is Cloudflare-gated for bots — skipped with a log.
 */
import { isCollectorsMockEnabled } from "../../../lib/rapid-iq/agenda-finder.js";
import { classifySignal } from "../../../lib/rapid-iq/claude-classifier.js";
import {
  classifyRampType,
  isRampRelevantText,
  RAMP_SIGNAL_SCORES,
  type RampOppType,
} from "../../../lib/rapid-iq/ramp-keywords.js";
import { sendTeamsAlert } from "../../../lib/rapid-iq/teams-notifier.js";
import { upsertSignalAndOpportunity } from "./upsert-signal.js";

export const RAMP_BASE = "https://www.rampla.org";
export const RAMP_HOME = `${RAMP_BASE}/s/`;
export const RAMP_SEARCH = `${RAMP_BASE}/s/opportunities`;
export const RAMP_DETAIL_PREFIX = `${RAMP_BASE}/s/opportunity-details`;
export const SUPPLIER_IO_URL = "https://supplier.io/la28";

const USER_AGENT =
  "Mozilla/5.0 (compatible; RapidCortex/1.0; +https://rapidcortex.us; LA28-RAMP-monitor)";

const RAMP_SEARCHES = [
  { keyword: "security", category: "Security" },
  { keyword: "technology", category: "Technology" },
  { keyword: "safety", category: "Safety" },
  { keyword: "communications", category: "Technology" },
  { keyword: "software", category: "Technology" },
  { keyword: "operations", category: "Operations" },
] as const;

export type RampOpportunity = {
  title: string;
  type: RampOppType;
  category: string;
  status: string;
  deadline: string | null;
  description: string;
  url: string;
  postedDate: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(href: string): string {
  if (href.startsWith("http")) return href.split("#")[0]!;
  if (href.startsWith("/")) return `${RAMP_BASE}${href.split("#")[0]}`;
  return `${RAMP_BASE}/s/${href.split("#")[0]}`;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** True when the response is the Salesforce Experience Cloud shell with no listing rows. */
export function isRampSpaShell(html: string): boolean {
  const lower = html.toLowerCase();
  const hasAura =
    lower.includes("auracss") ||
    lower.includes("aura loading") ||
    lower.includes('id="auraerrorbox"') ||
    lower.includes("lightning");
  const hasDetail = /opportunity-details\?id=006/i.test(html);
  const hasRows =
    /forceRecordLayout|opportunity-card|bid-item|slds-hint-parent/i.test(html) &&
    /RFP|RFQ|EOI|RFI|IFB/i.test(html);
  return hasAura && !hasDetail && !hasRows;
}

/**
 * Parse RAMP HTML using structures observed on rampla.org Experience Cloud pages.
 * Does NOT invent opportunities from the guest SPA shell (that would Teams-spam every scan).
 */
export function parseRampHtml(
  html: string,
  keyword: string,
  categoryHint = "General",
): RampOpportunity[] {
  if (isRampSpaShell(html)) return [];

  const opportunities: RampOpportunity[] = [];
  const seen = new Set<string>();

  const push = (opp: RampOpportunity) => {
    const key = `${opp.title.toLowerCase()}|${opp.url}`;
    if (!opp.title.trim() || seen.has(key)) return;
    seen.add(key);
    opportunities.push(opp);
  };

  // Strategy 1 — opportunity-details / announcement links
  const linkRe =
    /href=["']([^"']*(?:opportunity-details|procurement-announcement-details)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRe.exec(html)) !== null) {
    const url = absoluteUrl(decodeHtmlEntities(linkMatch[1]!));
    const title = stripTags(linkMatch[2]!).slice(0, 240) || `RAMP opportunity ${url.slice(-18)}`;
    const nearby = html.slice(Math.max(0, linkMatch.index - 200), linkMatch.index + 800);
    const type = classifyRampType(`${title} ${nearby}`);
    push({
      title,
      type,
      category: categoryHint,
      status: /closed/i.test(nearby) ? "Closed" : "Open",
      deadline: extractDateNear(nearby, /(?:bid\s*due|due\s*date|deadline)/i),
      description: stripTags(nearby).slice(0, 2000),
      url,
      postedDate: extractDateNear(nearby, /posted/i),
    });
  }

  // Strategy 2 — bare opportunity-details?id=006… URLs
  const idRe = /(?:opportunity-details)\?id=(006[A-Za-z0-9]{12,18})/g;
  let idMatch: RegExpExecArray | null;
  while ((idMatch = idRe.exec(html)) !== null) {
    const id = idMatch[1]!;
    const url = `${RAMP_DETAIL_PREFIX}?id=${id}`;
    if ([...seen].some((k) => k.includes(url))) continue;
    const nearby = html.slice(Math.max(0, idMatch.index - 300), idMatch.index + 500);
    push({
      title: stripTags(nearby).slice(0, 160) || `LA28 RAMP opportunity ${id}`,
      type: classifyRampType(nearby),
      category: categoryHint,
      status: /closed/i.test(nearby) ? "Closed" : "Open",
      deadline: extractDateNear(nearby, /due|deadline/i),
      description: stripTags(nearby).slice(0, 2000) || `Salesforce opportunity ${id}`,
      url,
      postedDate: extractDateNear(nearby, /posted/i),
    });
  }

  // Strategy 3 — embedded JSON
  for (const jsonBlob of extractJsonObjects(html)) {
    for (const row of findOpportunityArrays(jsonBlob)) {
      const title = stringField(row, ["title", "Name", "name", "opportunityName", "Subject"]);
      const urlRaw = stringField(row, ["url", "Url", "detailUrl", "link", "Id", "id"]);
      if (!title) continue;
      const url = urlRaw
        ? urlRaw.startsWith("006")
          ? `${RAMP_DETAIL_PREFIX}?id=${urlRaw}`
          : absoluteUrl(urlRaw)
        : `${RAMP_SEARCH}?keyword=${encodeURIComponent(keyword)}`;
      const type = classifyRampType(
        `${title} ${stringField(row, ["type", "Type", "bidMethod", "BidMethod"]) ?? ""}`,
      );
      push({
        title,
        type,
        category: stringField(row, ["category", "Category"]) ?? categoryHint,
        status: stringField(row, ["status", "Status"]) ?? "Open",
        deadline: stringField(row, ["deadline", "bidDue", "BidDue", "dueDate"]) ?? null,
        description: stringField(row, ["description", "Description", "summary"]) ?? title,
        url,
        postedDate: stringField(row, ["postedDate", "Posted", "createdDate"]) ?? null,
      });
    }
  }

  // Strategy 4 — HTML table / card rows
  const rowRe =
    /<(?:tr|div|li|article)[^>]{0,200}class=["'][^"']*(?:opportunity|bid|listing|slds-hint-parent|forceRecordLayout)[^"']*["'][^>]*>([\s\S]*?)<\/(?:tr|div|li|article)>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const chunk = rowMatch[1]!;
    const text = stripTags(chunk);
    if (text.length < 20) continue;
    if (
      !/\b(RFP|RFQ|RFI|EOI|IFB|ITB|LA\s*28|Olympic)\b/i.test(text) &&
      !text.toLowerCase().includes(keyword.toLowerCase())
    ) {
      continue;
    }
    const href = chunk.match(/href=["']([^"']+)["']/i)?.[1];
    const title =
      stripTags(chunk.match(/<(?:h[1-4]|a|span)[^>]*>([\s\S]*?)<\/(?:h[1-4]|a|span)>/i)?.[1] ?? "") ||
      text.slice(0, 160);
    push({
      title,
      type: classifyRampType(text),
      category: categoryHint,
      status: /closed/i.test(text) ? "Closed" : "Open",
      deadline: extractDateNear(text, /due|deadline/i),
      description: text.slice(0, 2000),
      url: href ? absoluteUrl(href) : `${RAMP_SEARCH}?keyword=${encodeURIComponent(keyword)}`,
      postedDate: extractDateNear(text, /posted/i),
    });
  }

  // Strategy 5 — SSR-style text blocks with solicitation badges (not Aura shell)
  if (opportunities.length === 0) {
    const pageText = stripTags(html);
    const solicitationHits = pageText.match(/\b(RFP|RFQ|EOI|RFI|IFB|ITB)\b/gi) ?? [];
    const hasConcreteListing =
      solicitationHits.length >= 2 &&
      /deadline|bid due|due date|posted/i.test(pageText) &&
      pageText.toLowerCase().includes(keyword.toLowerCase());
    if (hasConcreteListing) {
      push({
        title: `LA28 RAMP — ${keyword} opportunities`,
        type: classifyRampType(pageText),
        category: categoryHint,
        status: "Open",
        deadline: extractDateNear(pageText, /due|deadline/i),
        description: pageText.slice(0, 3000),
        url: `${RAMP_SEARCH}?keyword=${encodeURIComponent(keyword)}&status=Open`,
        postedDate: new Date().toISOString().slice(0, 10),
      });
    }
  }

  return opportunities;
}

function extractDateNear(text: string, label: RegExp): string | null {
  const m = text.match(
    new RegExp(
      `${label.source}[^\\d]{0,40}(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|[A-Z][a-z]{2,8}\\s+\\d{1,2},?\\s+\\d{4})`,
      "i",
    ),
  );
  return m?.[1] ?? null;
}

function extractJsonObjects(html: string): unknown[] {
  const out: unknown[] = [];
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    const body = m[1]!;
    if (!/opportun|announcement|records|bid/i.test(body)) continue;
    for (const slice of body.match(/\{[\s\S]{20,80000}?\}/g) ?? []) {
      try {
        out.push(JSON.parse(slice));
      } catch {
        /* ignore */
      }
    }
    for (const slice of body.match(/\[[\s\S]{20,80000}?\]/g) ?? []) {
      try {
        out.push(JSON.parse(slice));
      } catch {
        /* ignore */
      }
    }
  }
  return out;
}

function findOpportunityArrays(node: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 8 || node == null) return [];
  if (Array.isArray(node)) {
    const asObjs = node.filter(
      (x): x is Record<string, unknown> =>
        Boolean(x) &&
        typeof x === "object" &&
        ("title" in (x as object) || "Name" in (x as object) || "name" in (x as object)),
    );
    if (asObjs.length) return asObjs;
    return node.flatMap((x) => findOpportunityArrays(x, depth + 1));
  }
  if (typeof node === "object") {
    return Object.values(node as Record<string, unknown>).flatMap((v) =>
      findOpportunityArrays(v, depth + 1),
    );
  }
  return [];
}

function stringField(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/json",
    };
    const session = process.env.RAPID_IQ_RAMP_SESSION_COOKIE?.trim();
    if (session) headers.Cookie = session;

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(20_000),
      redirect: "follow",
    });
    if (!res.ok) {
      console.warn(
        JSON.stringify({ msg: "ramp_fetch_failed", status: res.status, url: url.slice(0, 120) }),
      );
      return null;
    }
    return await res.text();
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ramp_fetch_error",
        url: url.slice(0, 120),
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return null;
  }
}

async function fetchRampOpportunities(
  keyword: string,
  category: string,
): Promise<{ opportunities: RampOpportunity[]; spaShell: boolean }> {
  const urls = [
    `${RAMP_SEARCH}?keyword=${encodeURIComponent(keyword)}&status=Open`,
    `${RAMP_SEARCH}?keyword=${encodeURIComponent(keyword)}`,
  ];
  const found: RampOpportunity[] = [];
  const seen = new Set<string>();
  let spaShell = false;

  for (const url of urls) {
    await sleep(isCollectorsMockEnabled() ? 0 : 1500);
    const html = await fetchHtml(url);
    if (!html) continue;
    if (isRampSpaShell(html)) {
      spaShell = true;
      continue;
    }
    for (const opp of parseRampHtml(html, keyword, category)) {
      const key = `${opp.title}|${opp.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(opp);
    }
  }
  return { opportunities: found, spaShell };
}

/** Secondary LA28 portal — often Cloudflare-blocked for automated clients. */
async function fetchSupplierIoHints(): Promise<RampOpportunity[]> {
  try {
    const res = await fetch(SUPPLIER_IO_URL, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok) {
      console.warn(
        JSON.stringify({
          msg: "supplier_io_skipped",
          status: res.status,
          note: "Cloudflare or auth gate — register manually at supplier.io/la28",
        }),
      );
      return [];
    }
    const html = await res.text();
    const text = stripTags(html);
    if (!/security|technology|procurement|rfp|eoi/i.test(text)) return [];
    return [
      {
        title: "LA28 Supplier.IO procurement portal",
        type: "EOI",
        category: "LA28",
        status: "Open",
        deadline: null,
        description: text.slice(0, 2500),
        url: SUPPLIER_IO_URL,
        postedDate: new Date().toISOString().slice(0, 10),
      },
    ];
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "supplier_io_skipped",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return [];
  }
}

function mockRampOpportunities(): RampOpportunity[] {
  return [
    {
      title: "Security Technology Platform — Expression of Interest",
      type: "EOI",
      category: "Security",
      status: "Open",
      deadline: "2026-09-30",
      description:
        "LA28 seeks expressions of interest for venue security technology, incident reporting, " +
        "crowd management, and emergency communications platforms across Olympic venues.",
      url: `${RAMP_DETAIL_PREFIX}?id=006MOCKSECURITYEOI01`,
      postedDate: new Date().toISOString().slice(0, 10),
    },
    {
      title: "Venue Operations Software RFP",
      type: "RFP",
      category: "Technology",
      status: "Open",
      deadline: "2026-10-15",
      description:
        "Request for Proposal for stadium and venue operations software including public safety " +
        "notification, guest incident reporting, and dispatch integration.",
      url: `${RAMP_DETAIL_PREFIX}?id=006MOCKVENUERFP00001`,
      postedDate: new Date().toISOString().slice(0, 10),
    },
  ];
}

function isActNowType(type: RampOppType): boolean {
  return type === "RFP" || type === "RFQ";
}

export async function runRampCollector(): Promise<{ signalsFound: number }> {
  let total = 0;
  const seenTitles = new Set<string>();
  const batches: RampOpportunity[] = [];
  let sawSpaShell = false;

  if (isCollectorsMockEnabled()) {
    batches.push(...mockRampOpportunities());
  } else {
    for (const search of RAMP_SEARCHES) {
      try {
        await sleep(2000);
        const { opportunities, spaShell } = await fetchRampOpportunities(
          search.keyword,
          search.category,
        );
        if (spaShell) sawSpaShell = true;
        batches.push(...opportunities);
      } catch (err) {
        console.error(
          JSON.stringify({
            msg: "ramp_collector_error",
            keyword: search.keyword,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }

    try {
      batches.push(...(await fetchSupplierIoHints()));
    } catch {
      /* optional */
    }
  }

  if (sawSpaShell && batches.length === 0) {
    console.warn(
      JSON.stringify({
        msg: "ramp_spa_shell_no_listings",
        note:
          "RAMPLA.org returned the Salesforce Experience Cloud guest shell without opportunity rows. " +
          "Set RAPID_IQ_RAMP_SESSION_COOKIE for an authenticated supplier session, or register for " +
          "Sports & Entertainment / Security NAICS email alerts on rampla.org.",
        searchUrl: RAMP_SEARCH,
      }),
    );
  }

  for (const opp of batches) {
    if (seenTitles.has(opp.title.toLowerCase())) continue;
    seenTitles.add(opp.title.toLowerCase());
    if (opp.status?.toLowerCase() === "closed") continue;
    if (!isRampRelevantText(opp.title, opp.description)) continue;

    const actNow = isActNowType(opp.type);
    const rawText = [
      `SOURCE: LA28 Olympic Procurement (RAMPLA.org)`,
      `Opportunity: ${opp.title}`,
      `Type: ${opp.type}`,
      `Category: ${opp.category}`,
      `Status: ${opp.status}`,
      `Deadline: ${opp.deadline ?? "Not specified"}`,
      `Posted: ${opp.postedDate ?? "Unknown"}`,
      ``,
      `Description: ${opp.description}`,
      ``,
      `Context: This is an official LA28 Olympic and Paralympic Games procurement opportunity.`,
      `LA28 will host the 2028 Summer Olympics in Los Angeles across 35+ venues with 15,000+ athletes`,
      `and 5M+ spectators. Rapid Cortex provides venue safety, guest incident reporting, and 911`,
      `emergency communications integration — directly relevant to Security and Technology categories.`,
      `Register at RAMPLA.org (Sports & Entertainment / Security NAICS) and respond promptly.`,
    ].join("\n");

    const classified = await classifySignal(rawText, opp.url, "LA28 RAMP");
    const scoreContrib = RAMP_SIGNAL_SCORES[opp.type] ?? 15;

    const result = await upsertSignalAndOpportunity(
      {
        ...classified,
        isRelevant: true,
        signalType: actNow ? "rfp" : "rfi",
        agencyName: "LA28 Olympic and Paralympic Games",
        agencyType: "olympic_organizing_committee",
        city: "Los Angeles",
        state: "CA",
        county: "Los Angeles",
        population: 3_979_576,
        vertical: "venue",
        rcProduct: "venue",
        intentStage: opp.type === "RFP" ? "active_rfp" : "evaluation",
        scoreContrib,
        dollarValue: null,
        tags: [
          "OPPORTUNITY",
          actNow ? "RFP LIVE" : "EOI",
          "LA28 OLYMPICS",
          "HIGH PRIORITY",
          opp.type,
        ],
        aiHeadline: classified.aiHeadline ?? `LA28 ${opp.type}: ${opp.title}`,
        aiSummary:
          classified.aiSummary ??
          `LA28 Olympic Games issued a ${opp.type} for ${opp.title}. ` +
            `Official Olympic procurement via RAMPLA.org — relevant to Rapid Cortex venue safety ` +
            `and emergency communications. ${opp.deadline ? `Deadline: ${opp.deadline}.` : ""} ` +
            `Log in to RAMP and respond immediately.`,
        incumbentVendor: null,
        confidence: classified.confidence ?? "medium",
        mentionedEntities: classified.mentionedEntities ?? [],
      },
      opp.url,
      "LA28 RAMP",
      "procurement_portal",
      "ramp#la28",
    );

    // Every LA28 RAMP opportunity → immediate Teams alert (regardless of score).
    // Upsert skips Teams for LA28 tags so this branded card is the single notification.
    if (result.saved) {
      await sendTeamsAlert({
        opportunityId: result.opportunityId,
        agencyName: "🏅 LA28 Olympics",
        state: "CA",
        opportunityScore: opp.type === "RFP" ? 95 : actNow ? 90 : 80,
        intentStage: opp.type === "RFP" ? "active_rfp" : "evaluation",
        estimatedDollarValue: null,
        tags: ["LA28 OLYMPICS", opp.type, "RESPOND NOW"],
        aiHeadline: `LA28 ${opp.type}: ${opp.title}`,
        incumbentVendor: null,
        agencyType: "olympic_organizing_committee",
        sourceUrl: opp.url,
      }).catch((err) => {
        console.warn(
          JSON.stringify({
            msg: "ramp_teams_alert_failed",
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      });

      console.log(
        JSON.stringify({
          msg: "ramp_opportunity_found",
          title: opp.title,
          type: opp.type,
          deadline: opp.deadline,
          opportunityId: result.opportunityId,
          created: result.created,
          isActNow: actNow,
        }),
      );
      total++;
    }
  }

  console.log(JSON.stringify({ msg: "ramp_collector_complete", signalsFound: total }));
  return { signalsFound: total };
}
