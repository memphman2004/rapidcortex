import type { SalesLeadCrmRecord } from "rapid-cortex-shared";

export type LeadScoreBucket = "hot" | "warm" | "qualified" | "early" | "cold";

export type LeadScore = {
  total: number;
  bucket: LeadScoreBucket;
  reasons: string[];
};

export const SCORE_CONFIG: Record<
  LeadScoreBucket,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  hot: {
    label: "Hot",
    color: "text-rose-300",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    dot: "bg-rose-400",
  },
  warm: {
    label: "Warm",
    color: "text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
  },
  qualified: {
    label: "Qualified",
    color: "text-sky-300",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    dot: "bg-sky-400",
  },
  early: {
    label: "Early",
    color: "text-slate-300",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    dot: "bg-slate-400",
  },
  cold: {
    label: "Cold",
    color: "text-blue-200",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    dot: "bg-blue-300",
  },
};

function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

export function scoreLead(lead: SalesLeadCrmRecord): LeadScore {
  let total = 20;
  const reasons: string[] = [];

  const stage = lead.pipelineStage;
  const stagePts: Record<string, number> = {
    NEW: 5,
    CONTACTED: 12,
    QUALIFIED: 22,
    DISCOVERY: 28,
    PROPOSAL: 35,
    NEGOTIATION: 42,
    PILOT: 48,
    WON: 60,
    LOST: 0,
  };
  total += stagePts[stage] ?? 0;
  reasons.push(`Stage ${stage}`);

  if ((lead.estimatedValue ?? 0) >= 100_000) {
    total += 15;
    reasons.push("High estimated value");
  } else if ((lead.estimatedValue ?? 0) >= 25_000) {
    total += 8;
    reasons.push("Mid estimated value");
  }

  if ((lead.probability ?? 0) >= 70) {
    total += 12;
    reasons.push("High probability");
  } else if ((lead.probability ?? 0) >= 40) {
    total += 6;
  }

  const idle = daysSince(lead.lastContactedAt ?? lead.stageUpdatedAt ?? lead.updatedAt);
  if (idle !== null && idle >= 21 && stage !== "WON" && stage !== "LOST") {
    total -= 25;
    reasons.push(`Cold ${idle}d`);
  } else if (idle !== null && idle >= 10 && stage !== "WON" && stage !== "LOST") {
    total -= 10;
    reasons.push(`Stale ${idle}d`);
  }

  if (lead.assignedTo || lead.assignee) total += 5;
  if (lead.vertical && lead.vertical !== "unknown") total += 5;

  total = Math.max(0, Math.min(100, total));

  let bucket: LeadScoreBucket = "early";
  if (total >= 75) bucket = "hot";
  else if (total >= 60) bucket = "warm";
  else if (total >= 45) bucket = "qualified";
  else if (total >= 25) bucket = "early";
  else bucket = "cold";

  return { total, bucket, reasons };
}

export function isColdLead(lead: SalesLeadCrmRecord, thresholdDays = 14): boolean {
  if (lead.pipelineStage === "WON" || lead.pipelineStage === "LOST") return false;
  const idle = daysSince(lead.lastContactedAt ?? lead.stageUpdatedAt ?? lead.updatedAt);
  return idle !== null && idle >= thresholdDays;
}
