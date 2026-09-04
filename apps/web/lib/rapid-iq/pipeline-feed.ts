import type { RapidIqOpportunity } from "@/lib/rapid-iq/types";
import type { RapidIqPipelineSignal, RapidIqPipelineSignalStatus } from "rapid-cortex-shared";
import { isCompetitorOpportunity, isKnownCompetitor } from "./competitor-registry";

export type PipelineFeedTab = "911" | "campus" | "venue" | "transit" | "competitor";

const CAMPUS_RE =
  /\b(university|college|campus|school district|k-12|higher education|student safety|dormitory)\b/i;
const VENUE_RE =
  /\b(stadium|arena|amphitheatre|amphitheater|venue|concert|festival|racetrack|ballpark|convention center)\b/i;
const TRANSIT_RE =
  /\b(transit|metro|subway|light rail|commuter rail|bus rapid|ferry|paratransit|ridership|mta|wmata|mbta|bart|trimet)\b/i;

/** Map a collector / pipeline signal onto 911, Campus, Venue, or Competitors. */
export function classifyPipelineFeedTab(input: {
  sourceId?: string;
  agencyType?: string;
  vendorNamed?: string;
  rawTitle?: string;
  summary?: string;
  rawSnippet?: string;
  vertical?: string;
}): PipelineFeedTab {
  if (
    input.vertical === "911" ||
    input.vertical === "campus" ||
    input.vertical === "venue" ||
    input.vertical === "transit" ||
    input.vertical === "competitor"
  ) {
    return input.vertical;
  }
  if (input.agencyType === "competitor_watch") return "competitor";
  if (input.sourceId === "competitor-intel") return "competitor";
  if (input.sourceId === "university-procurement") return "campus";
  if (
    input.sourceId === "state-911-board" ||
    input.sourceId === "911-gov" ||
    input.sourceId === "grants-gov" ||
    input.sourceId === "fcc-reports"
  ) {
    return "911";
  }

  const hay = [input.agencyType, input.vendorNamed, input.rawTitle, input.summary, input.rawSnippet]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join(" ");

  if (/\bcompetitor\b|displacement/i.test(hay)) return "competitor";
  if (CAMPUS_RE.test(hay)) return "campus";
  if (VENUE_RE.test(hay)) return "venue";
  if (TRANSIT_RE.test(hay)) return "transit";
  return "911";
}

export function isPipelineInboxSignal(signal: {
  status: RapidIqPipelineSignalStatus;
  sourceId: string;
}): boolean {
  return signal.status === "new" && signal.sourceId !== "rapid-iq";
}

export function isPipelineQueueSignal(signal: {
  status: RapidIqPipelineSignalStatus;
  sourceId: string;
}): boolean {
  if (signal.status === "reviewed") return true;
  return signal.status === "new" && signal.sourceId === "rapid-iq";
}

export function opportunityFeedTab(opportunity: RapidIqOpportunity): PipelineFeedTab {
  if (isCompetitorOpportunity(opportunity)) return "competitor";
  return opportunity.vertical;
}

export function isInboxOpportunity(opportunity: RapidIqOpportunity): boolean {
  return opportunity.status !== "dismissed" && opportunity.status !== "converted";
}

export function feedTabForPipelineSignal(signal: RapidIqPipelineSignal): PipelineFeedTab {
  const vertical = (signal as RapidIqPipelineSignal & { vertical?: string }).vertical;
  if (vertical === "competitor") return "competitor";
  if (signal.agencyType === "competitor_watch" || isKnownCompetitor(signal.vendorNamed)) {
    return "competitor";
  }
  return classifyPipelineFeedTab({ ...signal, vertical });
}

export function pipelineSignalsForTab(
  items: RapidIqPipelineSignal[],
  tab: PipelineFeedTab,
): RapidIqPipelineSignal[] {
  return items.filter((s) => feedTabForPipelineSignal(s) === tab);
}

export function inboxPipelineSignals(
  items: RapidIqPipelineSignal[],
  tab: PipelineFeedTab,
): RapidIqPipelineSignal[] {
  return pipelineSignalsForTab(items, tab).filter(isPipelineInboxSignal);
}

export function queuedPipelineSignals(
  items: RapidIqPipelineSignal[],
  tab: PipelineFeedTab,
): RapidIqPipelineSignal[] {
  return pipelineSignalsForTab(items, tab).filter((s) => {
    if (isPipelineQueueSignal(s) || s.status === "pushed") return true;
    return s.status === "dismissed";
  });
}

export function countQueuedUnworked(
  items: RapidIqPipelineSignal[],
  tab?: PipelineFeedTab,
): number {
  const scoped = tab ? pipelineSignalsForTab(items, tab) : items;
  return scoped.filter(isPipelineQueueSignal).length;
}
