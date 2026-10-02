/**
 * SNS-triggered grant matcher.
 * Matches new grants only to leads whose vertical is in grant.verticals —
 * campus grants never attach to venue/911 leads and vice versa.
 */
import type { SNSEvent } from "aws-lambda";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import type {
  GrantMatchRecord,
  GrantRecord,
  LeadSignal,
  LeadVertical,
  PipelineStage,
  SalesLeadCrmRecord,
} from "rapid-cortex-shared";
import {
  computeHotScore,
  grantVisibleToVertical,
} from "rapid-cortex-shared";
import { randomUUID } from "node:crypto";
import { GrantRepository } from "../repositories/grantRepository.js";
import { SalesLeadRepository } from "../repositories/salesLeadRepository.js";

const MATCH_STAGES = new Set<PipelineStage>([
  "QUALIFIED",
  "DISCOVERY",
  "PROPOSAL",
  "NEGOTIATION",
  "PILOT",
]);

const repo = new GrantRepository();
const leadsRepo = new SalesLeadRepository();
const ses = new SESClient({});

function tierAligns(grant: GrantRecord, lead: SalesLeadCrmRecord): boolean {
  const value = lead.estimatedValue ?? 0;
  const tier = grant.ncqTierMatch;
  if (tier === "none") return false;
  if (tier === "essential") return value <= 100_000 || value === 0;
  if (tier === "professional") return value <= 250_000 || value === 0;
  if (tier === "command") return value <= 500_000 || value === 0;
  return true;
}

function agencyTypeAligns(grant: GrantRecord, lead: SalesLeadCrmRecord): boolean {
  const elig = grant.eligibility.map((e) => e.toLowerCase());
  if (elig.length === 0) return true;
  const at = (lead.agencyType ?? lead.customerType ?? "").toLowerCase();
  if (!at) return true;
  if (elig.some((e) => at.includes(e.replace(/_/g, " ")) || e.includes(at))) return true;
  if (elig.includes("psap") && /psap|911|dispatch/.test(at)) return true;
  if (elig.includes("university") && /campus|university|college/.test(at)) return true;
  return false;
}

function scoreMatch(grant: GrantRecord, lead: SalesLeadCrmRecord): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];
  const leadState = (lead.requestedState ?? lead.state ?? "").toUpperCase();
  if (grant.states.length === 0 || (leadState && grant.states.map((s) => s.toUpperCase()).includes(leadState))) {
    score += 40;
    reasons.push(leadState ? `State ${leadState}` : "Nationwide eligibility");
  }
  if (tierAligns(grant, lead)) {
    score += 30;
    reasons.push(`Tier ${grant.ncqTierMatch}`);
  }
  if (agencyTypeAligns(grant, lead)) {
    score += 20;
    reasons.push("Agency type fit");
  }
  if (grant.closeDate) {
    const close = Date.parse(grant.closeDate);
    if (Number.isFinite(close) && close - Date.now() > 30 * 86400000) {
      score += 10;
      reasons.push("Close date > 30 days");
    }
  }
  return { score, reason: reasons.join("; ") || "Partial fit" };
}

async function notifyRep(lead: SalesLeadCrmRecord, grant: GrantRecord, matchScore: number): Promise<void> {
  const to = (lead.assignedTo ?? lead.assignee ?? "").trim();
  const from = process.env.GRANT_ALERT_FROM_EMAIL?.trim();
  if (!to.includes("@") || !from) return;
  try {
    await ses.send(
      new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: {
            Data: `GRANT ALERT: ${lead.agencyCompany ?? lead.agencyName ?? "Lead"} · ${grant.title.slice(0, 80)}`,
          },
          Body: {
            Text: {
              Data: [
                `Match score: ${matchScore}`,
                `Grant: ${grant.title}`,
                `Agency: ${grant.agency}`,
                `Award ceiling: $${grant.awardCeiling.toLocaleString()}`,
                `Closes: ${grant.closeDate ?? "n/a"}`,
                `Vertical: ${(grant.verticals ?? []).join(", ")}`,
                grant.sourceUrl ?? "",
              ].join("\n"),
            },
          },
        },
      }),
    );
  } catch (err) {
    console.warn(JSON.stringify({ msg: "grant_email_failed", error: String(err) }));
  }
}

async function attachGrantSignal(
  lead: SalesLeadCrmRecord,
  grant: GrantRecord,
  matchScore: number,
  matchReason: string,
  vertical: LeadVertical,
): Promise<void> {
  const signal: LeadSignal = {
    signalId: randomUUID(),
    leadId: lead.leadId,
    type: "GRANT_SIGNAL",
    title: grant.title.slice(0, 200),
    summary: `${matchReason} (score ${matchScore}). Award up to $${grant.awardCeiling.toLocaleString()}.`,
    sourceUrl: grant.sourceUrl,
    source: grant.source,
    strength: matchScore >= 80 ? "strong" : matchScore >= 60 ? "moderate" : "weak",
    detectedAt: new Date().toISOString(),
    repAcknowledged: false,
    vertical,
  };
  const existing = Array.isArray(lead.signals) ? lead.signals : [];
  // Drop any accidental cross-vertical signals before rewrite
  const scoped = existing.filter((s) => s.vertical === vertical);
  const next = [...scoped, signal].slice(-50);
  const hotScore = computeHotScore(next);
  await leadsRepo.updateSignalsMeta(lead.leadId, {
    signals: next,
    signalCount: next.length,
    lastSignalAt: signal.detectedAt,
    hotScore,
  });
}

export async function matchGrantToLeads(grantId: string): Promise<number> {
  const grant = await repo.getGrant(grantId);
  if (!grant || grant.relevanceScore < 40) return 0;
  if (!grant.verticals?.length) return 0;

  const leads = await leadsRepo.listNormalized(500);
  let matched = 0;

  for (const lead of leads as SalesLeadCrmRecord[]) {
    if (!MATCH_STAGES.has(lead.pipelineStage)) continue;
    const leadVertical = (lead.vertical ?? "unknown") as LeadVertical;
    if (!grantVisibleToVertical(grant.verticals, leadVertical)) continue;

    // Resolve match vertical: intersection (prefer lead's vertical)
    const vertical: LeadVertical =
      leadVertical !== "unknown" && grant.verticals.includes(leadVertical)
        ? leadVertical
        : grant.verticals[0]!;

    const { score, reason } = scoreMatch(grant, lead);
    if (score < 60) continue;

    const match: GrantMatchRecord = {
      leadId: lead.leadId,
      grantId: grant.grantId,
      matchScore: score,
      matchReason: reason,
      matchedAt: new Date().toISOString(),
      notifiedAt: null,
      repAcknowledged: false,
      outcome: null,
      vertical,
      createdAt: new Date().toISOString(),
    };
    try {
      await repo.putMatch(match);
      await attachGrantSignal(lead, grant, score, reason, vertical);
      await notifyRep(lead, grant, score);
      matched += 1;
    } catch (err) {
      if ((err as { name?: string }).name === "ConditionalCheckFailedException") continue;
      console.error(
        JSON.stringify({
          msg: "grant_match_error",
          leadId: lead.leadId,
          grantId,
          error: String(err),
        }),
      );
    }
  }
  return matched;
}

export const handler = async (event: SNSEvent): Promise<{ matched: number }> => {
  let matched = 0;
  for (const rec of event.Records ?? []) {
    try {
      const body = JSON.parse(rec.Sns.Message) as { newGrantIds?: string[] };
      for (const id of body.newGrantIds ?? []) {
        matched += await matchGrantToLeads(id);
      }
    } catch (err) {
      console.error(JSON.stringify({ msg: "grant_matcher_record_error", error: String(err) }));
    }
  }
  console.log(JSON.stringify({ msg: "grant_matcher_complete", matched }));
  return { matched };
};
