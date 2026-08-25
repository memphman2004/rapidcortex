/**
 * State 911 board / PSAP committee site crawl.
 * Includes Idaho (isp.idaho.gov/911) — Jefferson County coverage note.
 */

import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { isRelevantSignalText } from "rapid-cortex-shared";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

interface State911Source {
  state: string;
  stateName: string;
  boardName: string;
  primaryUrl: string;
  rssUrl?: string;
  grantsUrl?: string;
  minutesUrl?: string;
  newsUrl?: string;
}

const STATE_911_SOURCES: State911Source[] = [
  {
    state: "TX",
    stateName: "Texas",
    boardName: "Texas Commission on State Emergency Communications (CSEC)",
    primaryUrl: "https://csec.texas.gov",
    newsUrl: "https://csec.texas.gov/news/",
    grantsUrl: "https://csec.texas.gov/grant-programs/",
    minutesUrl: "https://csec.texas.gov/meetings/",
  },
  {
    state: "GA",
    stateName: "Georgia",
    boardName: "Georgia Emergency Management and Homeland Security Agency — E911",
    primaryUrl: "https://gema.georgia.gov/911",
    newsUrl: "https://gema.georgia.gov/news",
    grantsUrl: "https://gema.georgia.gov/grants",
  },
  {
    state: "FL",
    stateName: "Florida",
    boardName: "Florida 911 Coordination Office",
    primaryUrl: "https://www.fcc.state.fl.us/telecommunications/911",
    newsUrl: "https://www.fcc.state.fl.us/telecommunications/911/news",
    grantsUrl: "https://www.fcc.state.fl.us/telecommunications/911/grant",
  },
  {
    state: "NC",
    stateName: "North Carolina",
    boardName: "NC 911 Board",
    primaryUrl: "https://nc911.nc.gov",
    newsUrl: "https://nc911.nc.gov/news",
    grantsUrl: "https://nc911.nc.gov/grants",
    minutesUrl: "https://nc911.nc.gov/board-meetings",
  },
  {
    state: "PA",
    stateName: "Pennsylvania",
    boardName: "Pennsylvania Emergency Management Agency — 911",
    primaryUrl: "https://www.pema.pa.gov/911-Program",
    newsUrl: "https://www.pema.pa.gov/911-Program/Pages/News.aspx",
    grantsUrl: "https://www.pema.pa.gov/911-Program/Pages/Grants.aspx",
  },
  {
    state: "OH",
    stateName: "Ohio",
    boardName: "Ohio Statewide Emergency Telecommunications Board (SETB)",
    primaryUrl: "https://publicsafety.ohio.gov/setb",
    minutesUrl: "https://publicsafety.ohio.gov/setb/board-meetings",
    grantsUrl: "https://publicsafety.ohio.gov/setb/grants",
  },
  {
    state: "VA",
    stateName: "Virginia",
    boardName: "Virginia E-911 Services Board",
    primaryUrl: "https://www.vita.virginia.gov/its-agencies/e-911/",
    minutesUrl: "https://www.vita.virginia.gov/its-agencies/e-911/meetings/",
    grantsUrl: "https://www.vita.virginia.gov/its-agencies/e-911/grants/",
  },
  {
    state: "TN",
    stateName: "Tennessee",
    boardName: "Tennessee Emergency Communications Board (TECB)",
    primaryUrl: "https://www.tn.gov/commerce/divisions/fire/emergency-communications.html",
    newsUrl: "https://www.tn.gov/commerce/news.html",
  },
  {
    state: "MI",
    stateName: "Michigan",
    boardName: "Michigan Public Safety Communications System (MPSCS) / 911 Program",
    primaryUrl: "https://www.michigan.gov/msp/divisions/emhsd/911",
    minutesUrl: "https://www.michigan.gov/msp/divisions/emhsd/911/advisory-board",
    grantsUrl: "https://www.michigan.gov/msp/divisions/emhsd/911/grant-program",
  },
  {
    state: "IN",
    stateName: "Indiana",
    boardName: "Indiana Statewide 911 Board",
    primaryUrl: "https://www.in.gov/sboa/911-board/",
    minutesUrl: "https://www.in.gov/sboa/911-board/meetings/",
    grantsUrl: "https://www.in.gov/sboa/911-board/grants/",
  },
  {
    state: "IL",
    stateName: "Illinois",
    boardName: "Illinois Emergency Telephone Safety Board (ETSB)",
    primaryUrl: "https://www.illinois.gov/agencies/index/state-911-program",
    minutesUrl: "https://www.illinois.gov/agencies/index/state-911-program/meetings",
  },
  {
    state: "MO",
    stateName: "Missouri",
    boardName: "Missouri Public Safety Wireless Taskforce / 911 Program",
    primaryUrl: "https://dps.mo.gov/dir/programs/ohs/911/",
    minutesUrl: "https://dps.mo.gov/dir/programs/ohs/911/meetings.php",
  },
  {
    state: "WI",
    stateName: "Wisconsin",
    boardName: "Wisconsin Interoperability Council / 911 Program",
    primaryUrl: "https://dma.wi.gov/DMA/eis/911",
    minutesUrl: "https://dma.wi.gov/DMA/eis/911/meetings",
  },
  {
    state: "MN",
    stateName: "Minnesota",
    boardName: "Minnesota 911 Program",
    primaryUrl: "https://dps.mn.gov/divisions/ecp/programs/911/Pages/default.aspx",
    minutesUrl: "https://dps.mn.gov/divisions/ecp/programs/911/Pages/advisory-board.aspx",
    grantsUrl: "https://dps.mn.gov/divisions/ecp/programs/911/Pages/grants.aspx",
  },
  {
    state: "CO",
    stateName: "Colorado",
    boardName: "Colorado 911 Advisory Committee / DHSEM",
    primaryUrl: "https://dhsem.colorado.gov/911",
    minutesUrl: "https://dhsem.colorado.gov/911/advisory-committee",
    grantsUrl: "https://dhsem.colorado.gov/911/grants",
  },
  {
    state: "AZ",
    stateName: "Arizona",
    boardName: "Arizona Department of Administration — 911 Program",
    primaryUrl: "https://azdoa.gov/agencies/statewide-911-program",
    minutesUrl: "https://azdoa.gov/agencies/statewide-911-program/meetings",
    grantsUrl: "https://azdoa.gov/agencies/statewide-911-program/grants",
  },
  {
    state: "WA",
    stateName: "Washington",
    boardName: "Washington State Enhanced 911 Coordination Office",
    primaryUrl: "https://www.commerce.wa.gov/growing-the-economy/public-safety/911/",
    minutesUrl:
      "https://www.commerce.wa.gov/growing-the-economy/public-safety/911/advisory-committee/",
    grantsUrl: "https://www.commerce.wa.gov/growing-the-economy/public-safety/911/grant-program/",
  },
  {
    state: "OR",
    stateName: "Oregon",
    boardName: "Oregon 911 Program Advisory Committee",
    primaryUrl: "https://www.oregon.gov/osp/programs/911/Pages/default.aspx",
    minutesUrl: "https://www.oregon.gov/osp/programs/911/Pages/advisory-board.aspx",
  },
  {
    state: "KY",
    stateName: "Kentucky",
    boardName: "Kentucky Office of Homeland Security — E-911",
    primaryUrl: "https://homelandsecurity.ky.gov/911/Pages/default.aspx",
    minutesUrl: "https://homelandsecurity.ky.gov/911/Pages/meetings.aspx",
    grantsUrl: "https://homelandsecurity.ky.gov/911/Pages/grants.aspx",
  },
  {
    state: "AL",
    stateName: "Alabama",
    boardName: "Alabama 911 Board",
    primaryUrl: "https://www.alabama911.org",
    newsUrl: "https://www.alabama911.org/news",
    grantsUrl: "https://www.alabama911.org/grants",
    minutesUrl: "https://www.alabama911.org/meetings",
    rssUrl: "https://www.alabama911.org/feed",
  },
  {
    state: "SC",
    stateName: "South Carolina",
    boardName: "South Carolina 911 Advisory Committee",
    primaryUrl: "https://www.scemd.org/prepare/public-safety/911/",
    minutesUrl: "https://www.scemd.org/prepare/public-safety/911/meetings/",
  },
  {
    state: "LA",
    stateName: "Louisiana",
    boardName: "Louisiana Public Safety and Corrections — 911",
    primaryUrl: "https://www.dps.louisiana.gov/page/911",
    minutesUrl: "https://www.dps.louisiana.gov/page/911-meetings",
  },
  {
    state: "OK",
    stateName: "Oklahoma",
    boardName: "Oklahoma 911 Management Authority",
    primaryUrl: "https://www.ok.gov/911/",
    newsUrl: "https://www.ok.gov/911/News/",
    grantsUrl: "https://www.ok.gov/911/Funding/",
    minutesUrl: "https://www.ok.gov/911/Board_Meetings/",
  },
  {
    state: "KS",
    stateName: "Kansas",
    boardName: "Kansas 911 Coordinating Council",
    primaryUrl: "https://kcc.ks.gov/911/",
    minutesUrl: "https://kcc.ks.gov/911/meetings/",
    grantsUrl: "https://kcc.ks.gov/911/grants/",
  },
  {
    state: "NE",
    stateName: "Nebraska",
    boardName: "Nebraska 911 Operations Division",
    primaryUrl: "https://nsp.nebraska.gov/911/",
    minutesUrl: "https://nsp.nebraska.gov/911/advisory-board/",
  },
  {
    state: "IA",
    stateName: "Iowa",
    boardName: "Iowa Homeland Security & Emergency Management — 911 Program",
    primaryUrl: "https://homelandsecurity.iowa.gov/programs/911",
    minutesUrl: "https://homelandsecurity.iowa.gov/programs/911/advisory-council",
  },
  {
    state: "ID",
    stateName: "Idaho",
    boardName: "Idaho State Police — 911 Program",
    primaryUrl: "https://isp.idaho.gov/911/",
    minutesUrl: "https://isp.idaho.gov/911/advisory-board/",
    grantsUrl: "https://isp.idaho.gov/911/grants/",
    // NOTE: Jefferson County, ID would be visible here. This source WOULD have
    // caught the July 2026 signal had it been running.
  },
  {
    state: "MT",
    stateName: "Montana",
    boardName: "Montana 911 Advisory Council",
    primaryUrl: "https://doj.mt.gov/911/",
    minutesUrl: "https://doj.mt.gov/911/advisory-council/",
  },
  {
    state: "ND",
    stateName: "North Dakota",
    boardName: "North Dakota 911 Advisory Committee",
    primaryUrl: "https://www.nd.gov/des/911/",
    minutesUrl: "https://www.nd.gov/des/911/advisory-committee/",
  },
  {
    state: "SD",
    stateName: "South Dakota",
    boardName: "South Dakota 911 Program",
    primaryUrl: "https://dci.sd.gov/911/",
  },
  {
    state: "WY",
    stateName: "Wyoming",
    boardName: "Wyoming Office of Homeland Security — 911",
    primaryUrl: "https://www.wyomingOHS.gov/911/",
  },
  {
    state: "NM",
    stateName: "New Mexico",
    boardName: "New Mexico 911 Fund Administrator",
    primaryUrl: "https://www.prc.state.nm.us/telecommunications/911/",
    minutesUrl: "https://www.prc.state.nm.us/telecommunications/911/meetings/",
  },
  {
    state: "NV",
    stateName: "Nevada",
    boardName: "Nevada Commission on Homeland Security — 911 Program",
    primaryUrl: "https://dhhs.nv.gov/Programs/emerymgmt/911/",
    minutesUrl: "https://dhhs.nv.gov/Programs/emerymgmt/911/meetings/",
    grantsUrl: "https://dhhs.nv.gov/Programs/emerymgmt/911/grants/",
  },
  {
    state: "UT",
    stateName: "Utah",
    boardName: "Utah Communications Authority (UCA)",
    primaryUrl: "https://uca.utah.gov",
    newsUrl: "https://uca.utah.gov/news/",
    grantsUrl: "https://uca.utah.gov/911-grants/",
    minutesUrl: "https://uca.utah.gov/board-meetings/",
    rssUrl: "https://uca.utah.gov/feed/",
  },
  {
    state: "MA",
    stateName: "Massachusetts",
    boardName: "Massachusetts State 911 Department",
    primaryUrl: "https://www.mass.gov/state-911-department",
    newsUrl: "https://www.mass.gov/orgs/state-911-department/news",
    grantsUrl: "https://www.mass.gov/service-details/911-grant-program",
    minutesUrl: "https://www.mass.gov/service-details/advisory-board-meetings",
  },
  {
    state: "NY",
    stateName: "New York",
    boardName: "New York State Division of Homeland Security — 911 Program",
    primaryUrl: "https://www.dhses.ny.gov/911",
    minutesUrl: "https://www.dhses.ny.gov/911/advisory-board",
    grantsUrl: "https://www.dhses.ny.gov/911/grants",
  },
  {
    state: "CT",
    stateName: "Connecticut",
    boardName: "Connecticut 911 Advisory Council",
    primaryUrl: "https://portal.ct.gov/DESPP/Division-of-Fire-Prevention-and-Control/911",
    minutesUrl:
      "https://portal.ct.gov/DESPP/Division-of-Fire-Prevention-and-Control/911/Advisory-Council",
  },
  {
    state: "NJ",
    stateName: "New Jersey",
    boardName: "New Jersey Office of Emergency Telecommunications Services",
    primaryUrl: "https://www.nj.gov/oem/911/",
    minutesUrl: "https://www.nj.gov/oem/911/advisory-council/",
  },
  {
    state: "MD",
    stateName: "Maryland",
    boardName: "Maryland Emergency Management Agency — 911 Program",
    primaryUrl: "https://mema.maryland.gov/Pages/911.aspx",
    grantsUrl: "https://mema.maryland.gov/Pages/911-grants.aspx",
    minutesUrl: "https://mema.maryland.gov/Pages/911-advisory-committee.aspx",
  },
];

function isRelevant(text: string): boolean {
  return isRelevantSignalText(text);
}

async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "RapidCortex-IQ/1.0 (public-safety-procurement-monitor)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i");
  const match = xml.match(re);
  return (match?.[1] ?? "").trim();
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  for (const match of itemMatches) {
    const block = match[1] ?? "";
    items.push({
      title: extractTag(block, "title"),
      link: extractTag(block, "link"),
      description: extractTag(block, "description")
        .replace(/<[^>]+>/g, "")
        .slice(0, 1000),
      pubDate: extractTag(block, "pubDate"),
      guid: extractTag(block, "guid") || extractTag(block, "link"),
    });
  }
  return items;
}

async function queueSignal(
  source: State911Source,
  title: string,
  snippet: string,
  date: string,
): Promise<void> {
  const signal: RapidIqPipelineRawSignal = {
    sourceId: "state-911-board",
    sourceUrl: source.primaryUrl,
    rawTitle: `[${source.stateName} 911 Board] ${title}`.slice(0, 200),
    rawSnippet: snippet.slice(0, 2000),
    signalDate: date.slice(0, 10) || new Date().toISOString().slice(0, 10),
  };

  await enqueueRawSignal(signal, {
    dedupeId: `911board-${source.state}-${title}-${date}`,
    groupId: "state-911-board",
  });
}

async function crawlSource(source: State911Source): Promise<void> {
  const urlsToCheck: Array<{ url: string; pageType: string }> = [];

  if (source.grantsUrl) urlsToCheck.push({ url: source.grantsUrl, pageType: "grants" });
  if (source.minutesUrl) urlsToCheck.push({ url: source.minutesUrl, pageType: "minutes" });
  if (source.newsUrl) urlsToCheck.push({ url: source.newsUrl, pageType: "news" });
  if (urlsToCheck.length === 0) urlsToCheck.push({ url: source.primaryUrl, pageType: "primary" });

  if (source.rssUrl) {
    try {
      const res = await fetch(source.rssUrl, {
        headers: { "User-Agent": "RapidCortex-IQ/1.0" },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const xml = await res.text();
        const items = parseRssItems(xml);
        for (const item of items.filter((i) => isRelevant(`${i.title} ${i.description}`))) {
          await queueSignal(
            source,
            item.title,
            `${item.title}\n\n${item.description}`,
            item.pubDate.slice(0, 10) || new Date().toISOString().slice(0, 10),
          );
        }
        return;
      }
    } catch {
      // Fall through to HTML crawl
    }
  }

  for (const { url, pageType } of urlsToCheck.slice(0, 2)) {
    try {
      const pageText = await fetchPageText(url);
      if (!isRelevant(pageText)) continue;

      const pageTitle = `${source.boardName} — ${pageType.charAt(0).toUpperCase() + pageType.slice(1)}`;

      await queueSignal(
        source,
        pageTitle,
        `URL: ${url}\n\nPage type: ${pageType}\n\nContent: ${pageText.slice(0, 2000)}`,
        new Date().toISOString().slice(0, 10),
      );

      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.warn(`State 911 board ${source.state} (${url}): ${(err as Error).message}`);
    }
  }
}

export async function handler(): Promise<void> {
  console.log(
    `Rapid IQ pipeline: State 911 boards ingestion starting — ${STATE_911_SOURCES.length} states`,
  );

  if (await enqueueMockIfEnabled("state-911-board")) {
    console.log("Rapid IQ pipeline: State 911 boards mock path complete");
    return;
  }

  const PARALLEL = 5;
  for (let i = 0; i < STATE_911_SOURCES.length; i += PARALLEL) {
    const batch = STATE_911_SOURCES.slice(i, i + PARALLEL);
    await Promise.allSettled(batch.map((s) => crawlSource(s)));
    await new Promise((r) => setTimeout(r, 1_000));
  }

  console.log("Rapid IQ pipeline: State 911 boards ingestion complete");
}
