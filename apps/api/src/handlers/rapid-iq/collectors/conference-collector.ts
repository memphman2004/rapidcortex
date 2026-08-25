import type { Jurisdiction } from "../../../lib/rapid-iq/jurisdiction-registry.js";
import { isCollectorsMockEnabled, findAgendaDocuments } from "../../../lib/rapid-iq/agenda-finder.js";
import { classifySignal } from "../../../lib/rapid-iq/claude-classifier.js";
import { upsertSignalAndOpportunity } from "./upsert-signal.js";

const CONFERENCES = [
  {
    name: "APCO 2026",
    url: "https://www.apco911.org/annual-conference",
    date: "2026-08-16",
    pathHints: ["/agenda", "/speakers", "/exhibitors", "/attendees"],
    vertical: "911" as const,
  },
  {
    name: "NENA 2026",
    url: "https://www.nena.org/page/Conference",
    date: "2026-06-15",
    pathHints: ["/agenda", "/exhibitors"],
    vertical: "911" as const,
  },
  {
    name: "IACP 2026",
    url: "https://www.theiacpannualconference.org",
    date: "2026-10-12",
    pathHints: ["/program", "/exhibitors", "/speakers"],
    vertical: "911" as const,
  },
  {
    name: "IACLEA Annual Conference",
    url: "https://www.iaclea.org/annual-conference",
    date: "2026-06-20",
    pathHints: ["/agenda", "/speakers", "/attendees"],
    vertical: "campus" as const,
  },
  {
    name: "Campus Safety Conference",
    url: "https://www.campussafetyconference.com",
    date: "2026-07-15",
    pathHints: ["/agenda", "/speakers", "/expo"],
    vertical: "campus" as const,
  },
  {
    name: "VenuesNow Conference 2026",
    url: "https://www.venuesnow.com/conference",
    date: "2026-09-29",
    pathHints: ["/agenda", "/speakers", "/exhibitors"],
    vertical: "venue" as const,
  },
  {
    name: "Georgia Emergency Communications Conference",
    url: "https://ga911.com",
    date: "2027-03-07",
    pathHints: ["/register", "/hotels", "/agenda", "/exhibitors"],
    vertical: "911" as const,
  },
  {
    name: "NENA Annual Conference 2027",
    url: "https://www.nena.org/page/Conference",
    date: "2027-06-26",
    pathHints: ["/agenda", "/exhibitors"],
    vertical: "911" as const,
  },
  {
    name: "APCO International 2027",
    url: "https://www.apco911.org/annual-conference",
    date: "2027-07-25",
    pathHints: ["/agenda", "/exhibitors", "/speakers"],
    vertical: "911" as const,
  },
  {
    name: "NCS4 National Sports Safety Conference",
    url: "https://ncs4.usm.edu/events/annual-conference/",
    date: "2027-06-22",
    pathHints: ["/agenda", "/exhibitors"],
    vertical: "venue" as const,
  },
  {
    name: "AAAE Annual Conference 2027",
    url: "https://www.aaae.org",
    date: "2027-05-16",
    pathHints: ["/agenda", "/exhibitors"],
    vertical: "venue" as const,
  },
  {
    name: "GSX 2026",
    url: "https://www.gsx.org",
    date: "2026-09-14",
    pathHints: ["/agenda", "/exhibitors"],
    vertical: "venue" as const,
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function conferenceAsJurisdiction(conf: (typeof CONFERENCES)[number]): Jurisdiction {
  return {
    jurisdictionId: `conference#${conf.name.replace(/\s+/g, "-").toLowerCase()}`,
    type: "state_agency",
    name: conf.name,
    stateCode: "XX",
    stateName: "Conference",
    population: 0,
    tier: 3,
    tierWeight: 1,
    intervalHours: 24,
    agendaBaseUrl: conf.url,
    agendaPathHints: conf.pathHints,
    lastScannedAt: new Date(0).toISOString(),
    lastSignalAt: null,
    totalSignalsFound: 0,
    isActive: true,
    priorityBoost: 0,
    notes: null,
  };
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "RapidCortex-RapidIQ/1.0 (+https://rapidcortex.us)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000);
  } catch {
    return "";
  }
}

export async function runConferenceCollector(): Promise<{ signalsFound: number }> {
  let total = 0;
  const now = new Date();

  for (const conf of CONFERENCES) {
    const confDate = new Date(conf.date);
    const daysUntil = Math.floor((confDate.getTime() - now.getTime()) / 86_400_000);
    const daysAfter = Math.floor((now.getTime() - confDate.getTime()) / 86_400_000);

    // Only monitor within 60 days before or 7 days after the conference.
    if (daysUntil > 60 || daysAfter > 7) continue;

    try {
      await sleep(isCollectorsMockEnabled() ? 0 : 3000);

      if (isCollectorsMockEnabled()) {
        const mockText = [
          `${conf.name} session agenda discusses public safety technology modernization`,
          "NG911, CAD integration, and AI transcription for emergency communications",
          `Conference date ${conf.date} — ${daysUntil > 0 ? `${daysUntil} days away` : "currently ongoing"}.`,
        ].join(". ");
        const signal = await classifySignal(mockText, conf.url, conf.name);
        if (signal.isRelevant) {
          await upsertSignalAndOpportunity(
            {
              ...signal,
              vertical: conf.vertical,
              tags: [...new Set([...(signal.tags ?? []), conf.name.toUpperCase()])],
              aiSummary: signal.aiSummary
                ? `${signal.aiSummary} Note: ${conf.name} takes place ${conf.date} — ${
                    daysUntil > 0 ? `${daysUntil} days away` : "currently ongoing"
                  }.`
                : signal.aiSummary,
            },
            conf.url,
            conf.name,
            "news",
            `conference#${conf.name.replace(/\s+/g, "-").toLowerCase()}`,
          );
          total++;
        }
        continue;
      }

      const docs = await findAgendaDocuments(conferenceAsJurisdiction(conf));

      for (const doc of docs.slice(0, 3)) {
        const text = await fetchPageText(doc.url);
        if (!text) continue;

        const signal = await classifySignal(text, doc.url, conf.name);
        if (!signal.isRelevant) continue;

        await upsertSignalAndOpportunity(
          {
            ...signal,
            vertical: conf.vertical,
            tags: [...new Set([...(signal.tags ?? []), conf.name.toUpperCase()])],
            aiSummary: signal.aiSummary
              ? `${signal.aiSummary} Note: ${conf.name} takes place ${conf.date} — ${
                  daysUntil > 0 ? `${daysUntil} days away` : "currently ongoing"
                }.`
              : signal.aiSummary,
          },
          doc.url,
          conf.name,
          "news",
          `conference#${conf.name.replace(/\s+/g, "-").toLowerCase()}`,
        );
        total++;
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "conference_collector_error",
          conference: conf.name,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  return { signalsFound: total };
}
