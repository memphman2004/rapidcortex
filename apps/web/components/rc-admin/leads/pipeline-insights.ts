import {
  ACTIVE_PIPELINE_STAGES,
  STAGE_CONFIG,
  type PipelineStage,
  type SalesLeadCrmRecord,
} from "rapid-cortex-shared";
import { leadAgency, leadDisplayName, staleLevel } from "./leads-utils";

/** Default close chance when a lead has no probability of its own. */
export const STAGE_WIN_PROBABILITY: Record<PipelineStage, number> = {
  NEW: 5,
  CONTACTED: 10,
  QUALIFIED: 20,
  DISCOVERY: 35,
  PROPOSAL: 50,
  NEGOTIATION: 70,
  PILOT: 85,
  WON: 100,
  LOST: 0,
};

const LATER_STAGES = new Set<PipelineStage>([
  "QUALIFIED",
  "DISCOVERY",
  "PROPOSAL",
  "NEGOTIATION",
  "PILOT",
]);

const SOURCE_POINTS: Record<string, number> = {
  contact_sales: 12,
  referral: 12,
  email_campaign: 8,
  linkedin: 8,
  organic_search: 6,
  ring_waitlist: 4,
  inside_the_cortex: 4,
  direct: 4,
};

export function isOpenDeal(stage: PipelineStage): boolean {
  return stage !== "WON" && stage !== "LOST";
}

export function dealProbability(lead: SalesLeadCrmRecord): number {
  const own = lead.probability;
  if (typeof own === "number" && Number.isFinite(own)) {
    return Math.max(0, Math.min(100, Math.round(own)));
  }
  return STAGE_WIN_PROBABILITY[lead.pipelineStage];
}

export function weightedDealValue(lead: SalesLeadCrmRecord): number {
  const value = lead.estimatedValue ?? 0;
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (lead.pipelineStage === "LOST") return 0;
  if (lead.pipelineStage === "WON") return Math.round(value);
  return Math.round(value * (dealProbability(lead) / 100));
}

export function daysSince(iso: string | undefined | null, now = Date.now()): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((now - time) / 86_400_000));
}

/** 1–100 fit from stage, value, owner, source, and recent contact. Not a model score. */
export function pipelineFitScore(lead: SalesLeadCrmRecord, now = Date.now()): number {
  let score = 8;
  if (lead.pipelineStage === "WON") {
    score += 40;
  } else if (lead.pipelineStage !== "LOST") {
    const index = ACTIVE_PIPELINE_STAGES.indexOf(lead.pipelineStage);
    if (index >= 0) {
      score += Math.round(((index + 1) / ACTIVE_PIPELINE_STAGES.length) * 28);
    }
  }
  if ((lead.estimatedValue ?? 0) > 0) score += 14;
  if (lead.nextAction?.trim()) score += 8;
  if (lead.assignedTo || lead.assignedToName || lead.assignee) score += 8;
  if (lead.vertical && lead.vertical !== "unknown") score += 6;
  const source = lead.attribution?.channel ?? lead.source ?? "";
  score += SOURCE_POINTS[source] ?? 0;
  const contacted = daysSince(lead.lastContactedAt, now);
  if (contacted != null && contacted <= 7) score += 16;
  else if (contacted != null && contacted <= 14) score += 8;
  score += Math.min(10, (lead.activities?.length ?? 0) * 2);
  if (isOpenDeal(lead.pipelineStage) && lead.pipelineStage !== "NEW" && staleLevel(lead) === 2) {
    score -= 18;
  }
  return Math.max(1, Math.min(100, score));
}

export function fitBand(score: number): "hot" | "warm" | "cold" {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

/** One next step from the fields already on the lead. */
export function suggestedNextStep(lead: SalesLeadCrmRecord, now = Date.now()): string {
  if (lead.pipelineStage === "WON") {
    return lead.packageSold && lead.packageSold !== "none"
      ? "Package is recorded."
      : "Record the package that was sold.";
  }
  if (lead.pipelineStage === "LOST") {
    return lead.lostReason?.trim() ? `Lost: ${lead.lostReason.trim()}.` : "Record why this deal was lost.";
  }
  if (!(lead.assignedTo || lead.assignedToName || lead.assignee)) {
    return "Assign an owner before the next touch.";
  }
  if (lead.pipelineStage === "PILOT" && !lead.pilotStartDate) {
    return "Set the pilot start date.";
  }
  if ((lead.estimatedValue ?? 0) <= 0 && LATER_STAGES.has(lead.pipelineStage)) {
    return "Add an estimated value so this deal is in the forecast.";
  }
  if (lead.nextActionDate) {
    const due = new Date(lead.nextActionDate).getTime();
    if (!Number.isNaN(due) && due < now) {
      const action = lead.nextAction?.trim();
      return action ? `Past due: ${action}` : "The follow-up date has passed. Set a new next action.";
    }
  }
  if (staleLevel(lead) === 2) {
    if (lead.pipelineStage === "PROPOSAL" || lead.pipelineStage === "NEGOTIATION") {
      return "No recent contact. Ask who still has to approve.";
    }
    return "No contact in 14 days. Log a follow-up or move the stage.";
  }
  if (!lead.nextAction?.trim()) return "Write the next action for this deal.";
  return lead.nextAction.trim();
}

export type StageMixRow = {
  stage: PipelineStage;
  label: string;
  count: number;
  value: number;
  weighted: number;
};

export type RepLoad = {
  name: string;
  openCount: number;
  value: number;
  weighted: number;
  quietCount: number;
};

export type QuietDeal = {
  leadId: string;
  title: string;
  agency: string;
  stage: PipelineStage;
  value: number;
  quietDays: number | null;
  suggestion: string;
};

export type PilotRow = {
  leadId: string;
  title: string;
  agency: string;
  start: string | null;
  value: number;
};

export type PipelineInsight = {
  openCount: number;
  openValue: number;
  weightedOpenValue: number;
  quietCount: number;
  stageMix: StageMixRow[];
  reps: RepLoad[];
  quiet: QuietDeal[];
  lossReasons: { reason: string; count: number }[];
  pilots: PilotRow[];
  missingValueCount: number;
};

function ownerName(lead: SalesLeadCrmRecord): string {
  const name = lead.assignedToName?.trim() || lead.assignedTo?.trim() || lead.assignee?.trim();
  return name || "Unassigned";
}

export function buildPipelineInsight(leads: SalesLeadCrmRecord[], now = Date.now()): PipelineInsight {
  const open = leads.filter((lead) => isOpenDeal(lead.pipelineStage));
  const stageMix: StageMixRow[] = ACTIVE_PIPELINE_STAGES.map((stage) => {
    const rows = open.filter((lead) => lead.pipelineStage === stage);
    return {
      stage,
      label: STAGE_CONFIG[stage].label,
      count: rows.length,
      value: rows.reduce((sum, lead) => sum + (lead.estimatedValue ?? 0), 0),
      weighted: rows.reduce((sum, lead) => sum + weightedDealValue(lead), 0),
    };
  });

  const byOwner = new Map<string, RepLoad>();
  for (const lead of open) {
    const name = ownerName(lead);
    const row = byOwner.get(name) ?? { name, openCount: 0, value: 0, weighted: 0, quietCount: 0 };
    row.openCount += 1;
    row.value += lead.estimatedValue ?? 0;
    row.weighted += weightedDealValue(lead);
    if (staleLevel(lead) === 2) row.quietCount += 1;
    byOwner.set(name, row);
  }

  const quiet: QuietDeal[] = open
    .filter((lead) => staleLevel(lead) === 2)
    .map((lead) => ({
      leadId: lead.leadId,
      title: leadDisplayName(lead),
      agency: leadAgency(lead),
      stage: lead.pipelineStage,
      value: lead.estimatedValue ?? 0,
      quietDays: daysSince(lead.lastContactedAt, now),
      suggestion: suggestedNextStep(lead, now),
    }))
    .sort((a, b) => b.value - a.value || (b.quietDays ?? 999) - (a.quietDays ?? 999));

  const lossCounts = new Map<string, number>();
  for (const lead of leads) {
    if (lead.pipelineStage !== "LOST") continue;
    const reason = lead.lostReason?.trim() || "No reason recorded";
    lossCounts.set(reason, (lossCounts.get(reason) ?? 0) + 1);
  }

  const pilots: PilotRow[] = leads
    .filter((lead) => lead.pipelineStage === "PILOT")
    .map((lead) => ({
      leadId: lead.leadId,
      title: leadDisplayName(lead),
      agency: leadAgency(lead),
      start: lead.pilotStartDate ?? null,
      value: lead.estimatedValue ?? 0,
    }));

  return {
    openCount: open.length,
    openValue: open.reduce((sum, lead) => sum + (lead.estimatedValue ?? 0), 0),
    weightedOpenValue: open.reduce((sum, lead) => sum + weightedDealValue(lead), 0),
    quietCount: quiet.length,
    stageMix,
    reps: [...byOwner.values()].sort((a, b) => b.weighted - a.weighted || b.openCount - a.openCount),
    quiet,
    lossReasons: [...lossCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    pilots,
    missingValueCount: open.filter(
      (lead) => (lead.estimatedValue ?? 0) <= 0 && LATER_STAGES.has(lead.pipelineStage),
    ).length,
  };
}
