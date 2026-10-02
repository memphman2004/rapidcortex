/**
 * Daily stale-pipeline monitor — emits STALE_PIPELINE signals.
 * Each signal inherits the lead's vertical so Signal Feed stays isolated.
 */
import type { PipelineStage, SalesLeadCrmRecord } from "rapid-cortex-shared";
import { processIncomingSignal } from "./signal-processor.js";
import { SalesLeadRepository } from "../repositories/salesLeadRepository.js";

const leadsRepo = new SalesLeadRepository();

const DAY = 86400000;

function daysInStage(lead: SalesLeadCrmRecord): number {
  const t = Date.parse(lead.stageUpdatedAt ?? lead.updatedAt ?? lead.createdAt);
  if (!Number.isFinite(t)) return 0;
  return (Date.now() - t) / DAY;
}

function rule(
  stage: PipelineStage,
  days: number,
): { fire: boolean; strength: "moderate" | "strong" } | null {
  if (stage === "PROPOSAL" && days >= 14) return { fire: true, strength: "strong" };
  if (stage === "NEGOTIATION" && days >= 7) return { fire: true, strength: "strong" };
  if (
    (stage === "QUALIFIED" || stage === "DISCOVERY") &&
    days >= 30
  ) {
    return { fire: true, strength: "moderate" };
  }
  return null;
}

export const handler = async (): Promise<{ emitted: number }> => {
  const leads = await leadsRepo.listNormalized(500);
  let emitted = 0;
  for (const lead of leads) {
    const days = daysInStage(lead);
    const hit = rule(lead.pipelineStage, days);
    if (!hit) continue;
    const vertical = lead.vertical && lead.vertical !== "unknown" ? lead.vertical : "rc911";
    await processIncomingSignal({
      signalType: "STALE_PIPELINE",
      title: `Stale ${lead.pipelineStage} (${Math.floor(days)}d)`,
      summary: `${lead.agencyName ?? lead.agencyCompany ?? "Lead"} has been in ${lead.pipelineStage} for ${Math.floor(days)} days without stage movement.`,
      source: "internal",
      strength: hit.strength,
      vertical,
      leadId: lead.leadId,
      detectedAgencyName: lead.agencyName ?? lead.agencyCompany,
    });
    emitted += 1;
  }
  console.log(JSON.stringify({ msg: "stale_pipeline_complete", emitted }));
  return { emitted };
};
