/**
 * Scheduled campaign / newsletter composer.
 * Writes drafts and sequence *drafts* only — never sends without rcadmin approval.
 *
 * EventBridge Input: { "job": "newsletter" | "budget_season" | "conference_pre" | "re_engagement" }
 */

import { normalizeSalesAutomationVertical, type RapidIqSalesVertical } from "rapid-cortex-shared";
import { isCollectorsMockEnabled } from "../../../lib/rapid-iq/agenda-finder.js";
import { listIntelOpportunities } from "../../../lib/rapid-iq/intel-db.js";
import { createJsonResponse } from "../../../lib/rapid-iq/openai-client.js";
import { isRapidIqAiEnabled, rapidIqModelStrategy } from "../../../lib/rapid-iq/openai-config.js";
import { createSequenceFromTrigger, emptyDraft } from "../../../lib/rapid-iq/sales-automation-engine.js";
import { putSalesDraft } from "../../../lib/rapid-iq/sales-automation-db.js";
import { ConferenceRepository } from "../../../repositories/conferenceRepository.js";
import { SalesLeadRepository } from "../../../repositories/salesLeadRepository.js";

const COMPOSER_LEAD_CAP = 15;

type ComposerJob = "newsletter" | "budget_season" | "conference_pre" | "re_engagement";

function salesAutomationEnabled(): boolean {
  const v = process.env.ENABLE_SALES_AUTOMATION?.trim().toLowerCase();
  if (v === "0" || v === "false") return false;
  return true;
}

function conferenceVerticalToSales(v: string | undefined): RapidIqSalesVertical {
  return normalizeSalesAutomationVertical(v ?? "PSAP");
}

async function composeNewsletter(weekOf: string) {
  const intel = await listIntelOpportunities(80);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const top = intel
    .filter((r) => r.discoveredAt >= since && (r.userFitScore ?? r.fitScore) >= 7)
    .sort((a, b) => (b.userFitScore ?? b.fitScore) - (a.userFitScore ?? a.fitScore))
    .slice(0, 6);
  const signalLines = top.length
    ? top.map((r) => `- [${r.market}] ${r.title} — ${r.agency}`).join("\n")
    : "No high-fit intel this week. Write a short industry pulse.";

  let bodyText = `Inside the Cortex — week of ${weekOf}\n\n${signalLines}\n\nRapid Cortex continues to watch procurement and board activity across 911, campus, and venue. We'll send a fuller brief when the feed warrants it.\n\n— The Rapid Cortex team`;
  let linkedinText: string | undefined;
  let subject = `Inside the Cortex — ${weekOf}`;

  if (isRapidIqAiEnabled() && !isCollectorsMockEnabled()) {
    const raw = await createJsonResponse({
      model: rapidIqModelStrategy(),
      system:
        'You write "Inside the Cortex", a weekly note for 911 directors and campus/venue safety leaders. Practitioner tone, not ads. 350–450 words. Sign off as The Rapid Cortex team. Return JSON.',
      jsonSchemaName: "rapid_iq_newsletter",
      jsonSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          subject: { type: "string" },
          bodyText: { type: "string" },
          linkedinText: { type: "string" },
        },
        required: ["subject", "bodyText", "linkedinText"],
      },
      user: `Week of ${weekOf}\n\nSignals:\n${signalLines}`,
    });
    if (raw) {
      try {
        const parsed = JSON.parse(raw.text) as {
          subject?: string;
          bodyText?: string;
          linkedinText?: string;
        };
        if (parsed.bodyText) bodyText = parsed.bodyText;
        if (parsed.subject) subject = parsed.subject;
        if (parsed.linkedinText) linkedinText = parsed.linkedinText;
      } catch {
        /* keep heuristic */
      }
    }
  }

  const draft = emptyDraft({
    contentType: "newsletter",
    vertical: "ALL",
    weekOf,
    subject,
    bodyText,
    linkedinText,
  });
  await putSalesDraft(draft);
  return draft;
}

async function queueLeadSequences(
  job: "budget_season" | "re_engagement" | "conference_pre",
  conferenceName?: string,
  conferenceVertical?: RapidIqSalesVertical,
  remaining = COMPOSER_LEAD_CAP,
): Promise<number> {
  if (remaining <= 0) return 0;
  const leads = await new SalesLeadRepository().listNormalized(200);
  const now = Date.now();
  const ninety = now - 90 * 86_400_000;
  const terminal = new Set(["WON", "LOST", "PILOT"]);
  let queued = 0;

  for (const lead of leads) {
    if (queued >= remaining) break;
    const email = lead.email?.trim() ?? "";
    if (!email.includes("@")) continue;
    const stage = String(lead.pipelineStage ?? "").toUpperCase();
    const agency = lead.agencyName || lead.agencyCompany || email.split("@")[1] || "Unknown agency";
    const vertical = lead.vertical ?? "rc911";
    if (job === "conference_pre" && conferenceVertical && conferenceVertical !== "ALL") {
      const leadVert = normalizeSalesAutomationVertical(vertical);
      if (leadVert !== conferenceVertical) continue;
    }
    const updated =
      Date.parse(String(lead.lastContactedAt ?? lead.updatedAt ?? lead.createdAt ?? "")) || 0;

    if (job === "budget_season") {
      if (stage !== "CONTACTED" && stage !== "QUALIFIED") continue;
    } else if (job === "re_engagement") {
      if (terminal.has(stage)) continue;
      if (updated > ninety) continue;
    } else if (terminal.has(stage)) {
      continue;
    }

    await createSequenceFromTrigger({
      type: "campaign",
      agencyName: String(agency),
      vertical,
      recipientEmail: email,
      recipientName: lead.name ?? lead.firstName,
      leadId: lead.leadId,
      campaignType: job === "conference_pre" ? "conference_pre" : job,
      campaignId: `${job}-${lead.leadId}`,
      conferenceName,
      estimatedValue: lead.estimatedValue,
    });
    queued += 1;
  }
  return queued;
}

export async function handler(event: { job?: string; weekOf?: string }): Promise<Record<string, unknown>> {
  if (!salesAutomationEnabled()) {
    return { skipped: true, reason: "ENABLE_SALES_AUTOMATION" };
  }
  const job = (event.job ?? "newsletter") as ComposerJob;
  console.log(JSON.stringify({ msg: "rapid_iq_sales_composer", job }));

  switch (job) {
    case "newsletter": {
      const weekOf = event.weekOf ?? new Date().toISOString().slice(0, 10);
      const draft = await composeNewsletter(weekOf);
      return { job, draftId: draft.draftId, status: draft.status };
    }
    case "budget_season": {
      const queued = await queueLeadSequences("budget_season");
      return { job, queued };
    }
    case "re_engagement": {
      const queued = await queueLeadSequences("re_engagement");
      return { job, queued };
    }
    case "conference_pre": {
      if (!process.env.CONFERENCES_TABLE?.trim()) {
        return { job, queued: 0, reason: "CONFERENCES_TABLE unset" };
      }
      const conferences = await new ConferenceRepository().listByAgency();
      const now = Date.now();
      let queued = 0;
      for (const conf of conferences) {
        if (conf.isCancelled) continue;
        const start = Date.parse(conf.startDate);
        if (!Number.isFinite(start)) continue;
        const days = (start - now) / 86_400_000;
        if (days < 28 || days > 33) continue;
        queued += await queueLeadSequences(
          "conference_pre",
          conf.name,
          conferenceVerticalToSales(conf.vertical),
          COMPOSER_LEAD_CAP - queued,
        );
      }
      return { job, queued };
    }
    default:
      throw new Error(`Unknown sales-automation job: ${String(job)}`);
  }
}
