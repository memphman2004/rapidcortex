/**
 * Sales automation engine: suppression, 3-touch draft generation, approve/schedule.
 * Cold outreach always stays draft until an rcadmin approves. Never auto-send.
 */

import { randomBytes } from "node:crypto";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  RAPID_IQ_SALES_STEP_DELAYS,
  normalizeSalesAutomationVertical,
  type CreateRapidIqSalesSequenceBody,
  type RapidIqSalesContentDraft,
  type RapidIqSalesMetrics,
  type RapidIqSalesOutreachStep,
  type RapidIqSalesSequence,
  type RapidIqSalesStepLabel,
  type RapidIqSalesVertical,
} from "rapid-cortex-shared";
import { isCollectorsMockEnabled } from "./agenda-finder.js";
import { findContactsViaHunter } from "./hunter-enrichment.js";
import { createJsonResponse } from "./openai-client.js";
import { isRapidIqAiEnabled, rapidIqModelStrategy } from "./openai-config.js";
import { pipelineDdb } from "./pipeline-ddb.js";
import {
  getSalesSequence,
  hasRecentSend,
  isLocallyUnsubscribed,
  listSalesDrafts,
  listSalesSequences,
  putSalesSequence,
} from "./sales-automation-db.js";

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export type SuppressionResult = { suppressed: boolean; reason?: string };

const CONTACT_WINDOW_MS = 30 * 86_400_000;

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export async function checkMarketingUnsubscribed(email: string): Promise<boolean> {
  const table = process.env.MARKETING_LEADS_TABLE?.trim();
  if (!table) return false;
  const lower = email.trim().toLowerCase();
  try {
    const res = await pipelineDdb.send(
      new GetCommand({
        TableName: table,
        Key: { pk: `LEAD#${lower}`, sk: "PROFILE" },
      }),
    );
    const status = String(res.Item?.status ?? "").toLowerCase();
    return status === "unsubscribed";
  } catch {
    return false;
  }
}

export async function checkSuppression(email: string): Promise<SuppressionResult> {
  const lower = email.trim().toLowerCase();
  if (!lower.includes("@") || lower.includes("noreply") || lower === "unknown") {
    return { suppressed: true, reason: "no_email" };
  }
  if (await isLocallyUnsubscribed(lower)) {
    return { suppressed: true, reason: "unsubscribed" };
  }
  if (await checkMarketingUnsubscribed(lower)) {
    return { suppressed: true, reason: "unsubscribed" };
  }
  if (await hasRecentSend(lower, daysAgoIso(30))) {
    return { suppressed: true, reason: "contact_window_30d" };
  }
  return { suppressed: false };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildHtmlEmail(subject: string, bodyText: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:40px auto;padding:0 20px;">
${escapeHtml(bodyText).replace(/\n/g, "<br>")}
<p style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;color:#555;font-size:13px;">Rapid Cortex · rapidcortex.us</p>
</body></html>`;
}

function wrapBody(firstName: string | undefined, body: string): string {
  const hi = firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi,";
  return `${hi}\n\n${body.trim()}\n\nBest,\nThe Rapid Cortex team\nrapidcortex.us`;
}

export function heuristicThreeTouch(input: {
  agencyName: string;
  vertical: RapidIqSalesVertical;
  firstName?: string;
  signalTitle?: string;
  rfpDeadline?: string;
  campaignType?: string;
}): RapidIqSalesOutreachStep[] {
  const agency = input.agencyName;
  const title = input.signalTitle ?? "public safety operations";
  const deadline = input.rfpDeadline
    ? ` ahead of ${input.rfpDeadline.slice(0, 10)}`
    : "";
  const labels = ["initial", "followup_1", "followup_2"] as const;
  const drafts: Array<{ subject: string; body: string }> = [
    {
      subject: `${agency} — Rapid Cortex fit`,
      body: `I saw ${agency} moving on ${title}${deadline}. Rapid Cortex adds AI-assisted intake, live transcription, and supervisor visibility without replacing CAD or dispatch staff.\n\nWould a 20-minute call this week be useful?`,
    },
    {
      subject: `Re: ${agency} — quick follow-up`,
      body: `Following up briefly on Rapid Cortex for ${agency}. Happy to send a one-page technical overview or answer pre-procurement questions.`,
    },
    {
      subject: `${agency} — closing the loop`,
      body: `Last note from me on this. If the timing is wrong, I understand. If a later cycle opens, we can pick this up then.`,
    },
  ];
  return drafts.map((d, i) => {
    const label = labels[i]!;
    const bodyText = wrapBody(input.firstName, d.body);
    return {
      stepId: newId("step"),
      stepNumber: (i + 1) as 1 | 2 | 3,
      label,
      delayDays: RAPID_IQ_SALES_STEP_DELAYS[label],
      status: "pending" as const,
      email: {
        subject: d.subject,
        bodyText,
        bodyHtml: buildHtmlEmail(d.subject, bodyText),
      },
    };
  });
}

async function generateThreeTouch(input: {
  agencyName: string;
  vertical: RapidIqSalesVertical;
  firstName?: string;
  triggerType: string;
  signalTitle?: string;
  rfpDeadline?: string;
  campaignType?: string;
  conferenceName?: string;
}): Promise<RapidIqSalesOutreachStep[]> {
  const fallback = heuristicThreeTouch(input);
  if (!isRapidIqAiEnabled() || isCollectorsMockEnabled()) return fallback;

  const raw = await createJsonResponse({
    model: rapidIqModelStrategy(),
    system:
      "You write concise public-safety outreach for Rapid Cortex. Return JSON only. Rapid Cortex enhances 911/campus/venue operations and does not replace CAD, telephony, or staff. No competitor names. No unverified metrics. Step 3 is a low-pressure close.",
    jsonSchemaName: "rapid_iq_sales_sequence",
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        steps: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string", enum: ["initial", "followup_1", "followup_2"] },
              subject: { type: "string" },
              bodyText: { type: "string" },
            },
            required: ["label", "subject", "bodyText"],
          },
        },
      },
      required: ["steps"],
    },
    user: JSON.stringify({
      agency: input.agencyName,
      vertical: input.vertical,
      trigger: input.triggerType,
      signalTitle: input.signalTitle,
      rfpDeadline: input.rfpDeadline,
      campaignType: input.campaignType,
      conferenceName: input.conferenceName,
      instruction:
        "bodyText is the email body without greeting or signature. Keep initial under 180 words.",
    }),
  });
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw.text) as {
      steps?: Array<{ label?: string; subject?: string; bodyText?: string }>;
    };
    if (!Array.isArray(parsed.steps) || parsed.steps.length < 3) return fallback;
    return parsed.steps.slice(0, 3).map((step, i) => {
      const label = (["initial", "followup_1", "followup_2"][i] ?? "initial") as RapidIqSalesStepLabel;
      const subject = step.subject?.trim() || fallback[i]!.email.subject;
      const bodyText = wrapBody(input.firstName, step.bodyText?.trim() || fallback[i]!.email.bodyText);
      return {
        stepId: newId("step"),
        stepNumber: (i + 1) as 1 | 2 | 3,
        label,
        delayDays: RAPID_IQ_SALES_STEP_DELAYS[label],
        status: "pending" as const,
        email: { subject, bodyText, bodyHtml: buildHtmlEmail(subject, bodyText) },
      };
    });
  } catch {
    return fallback;
  }
}

function hunterVertical(v: RapidIqSalesVertical): "911" | "campus" | "venue" | "transit" {
  if (v === "CAMPUS") return "campus";
  if (v === "VENUE") return "venue";
  if (v === "TRANSIT") return "transit";
  return "911";
}

export async function createSequenceFromTrigger(
  body: CreateRapidIqSalesSequenceBody,
): Promise<RapidIqSalesSequence> {
  const vertical = normalizeSalesAutomationVertical(body.vertical);
  const now = new Date().toISOString();
  let email = body.recipientEmail?.trim().toLowerCase();
  let firstName = body.recipientName?.trim().split(/\s+/)[0];
  const recipientName = body.recipientName?.trim();

  if (!email && body.portalUrl) {
    const found = await findContactsViaHunter({
      agencyName: body.agencyName,
      city: "",
      state: "",
      vertical: hunterVertical(vertical),
      candidateUrls: [body.portalUrl],
    });
    const hit = found.contacts.find((c) => c.email?.includes("@"));
    if (hit?.email) {
      email = hit.email.toLowerCase();
      firstName = firstName || hit.name?.split(/\s+/)[0];
    }
  }

  const suppression = email
    ? await checkSuppression(email)
    : { suppressed: true as const, reason: "no_email" };

  const steps = await generateThreeTouch({
    agencyName: body.agencyName,
    vertical,
    firstName,
    triggerType: body.type,
    signalTitle: body.signalTitle,
    rfpDeadline: body.rfpDeadline,
    campaignType: body.campaignType,
    conferenceName: body.conferenceName,
  });

  const seq: RapidIqSalesSequence = {
    sequenceId: newId("seq"),
    triggerId: body.signalId ?? body.leadId ?? body.campaignId ?? body.type,
    triggerType: body.type,
    vertical,
    recipientEmail: email ?? "unknown",
    recipientName,
    agencyName: body.agencyName,
    status: suppression.suppressed ? "suppressed" : "draft",
    autoApprove: false,
    steps,
    createdAt: now,
    updatedAt: now,
    suppressedReason: suppression.reason,
    attribution: {
      signalId: body.signalId,
      leadId: body.leadId,
      rfpDeadline: body.rfpDeadline,
      estimatedValue: body.estimatedValue,
      campaignType: body.campaignType,
      conferenceName: body.conferenceName,
    },
  };
  await putSalesSequence(seq);
  return seq;
}

export async function approveSequence(
  sequenceId: string,
  approvedBy: string,
): Promise<RapidIqSalesSequence> {
  const current = await getSalesSequence(sequenceId);
  if (!current) throw new Error("Sequence not found");
  if (current.status === "suppressed") throw new Error("Sequence is suppressed");
  if (current.recipientEmail === "unknown" || !current.recipientEmail.includes("@")) {
    throw new Error("Cannot approve without a recipient email");
  }
  const suppression = await checkSuppression(current.recipientEmail);
  if (suppression.suppressed) {
    const blocked: RapidIqSalesSequence = {
      ...current,
      status: "suppressed",
      suppressedReason: suppression.reason,
      updatedAt: new Date().toISOString(),
    };
    await putSalesSequence(blocked);
    return blocked;
  }
  const approvedAt = new Date().toISOString();
  const origin = Date.parse(approvedAt);
  const steps = current.steps.map((step) => {
    const when = new Date(origin + step.delayDays * 86_400_000).toISOString();
    return { ...step, status: "scheduled" as const, scheduledAt: when };
  });
  const next: RapidIqSalesSequence = {
    ...current,
    status: "active",
    autoApprove: false,
    steps,
    approvedAt,
    approvedBy,
    updatedAt: approvedAt,
  };
  await putSalesSequence(next);
  return next;
}

export async function suppressSequence(
  sequenceId: string,
  reason: string,
): Promise<RapidIqSalesSequence> {
  const current = await getSalesSequence(sequenceId);
  if (!current) throw new Error("Sequence not found");
  const next: RapidIqSalesSequence = {
    ...current,
    status: "suppressed",
    suppressedReason: reason,
    updatedAt: new Date().toISOString(),
  };
  await putSalesSequence(next);
  return next;
}

export async function computeSalesMetrics(): Promise<RapidIqSalesMetrics> {
  const sequences = await listSalesSequences(200);
  const drafts = await listSalesDrafts(50);
  const weekAgo = daysAgoIso(7);
  const monthAgo = daysAgoIso(30);
  const thisWeek = sequences.filter((s) => s.createdAt >= weekAgo).length;
  const sentSteps = sequences.flatMap((s) => s.steps).filter((st) => st.sentAt && st.sentAt >= monthAgo);
  const opened = sentSteps.filter((st) => st.openedAt).length;
  const replied = sentSteps.filter((st) => st.repliedAt).length;
  const pendingSeq = sequences.filter((s) => s.status === "draft").length;
  const pendingDrafts = drafts.filter((d) => d.status === "draft").length;
  const rfpOpen = sequences.filter(
    (s) =>
      s.triggerType === "rfp_signal" &&
      (s.status === "draft" || s.status === "active") &&
      s.attribution.rfpDeadline &&
      s.attribution.rfpDeadline >= new Date().toISOString().slice(0, 10),
  ).length;
  return {
    sequencesThisWeek: thisWeek,
    emailsSent: sentSteps.length,
    openRate: sentSteps.length ? Math.round((opened / sentSteps.length) * 100) : 0,
    replyRate: sentSteps.length ? Math.round((replied / sentSteps.length) * 100) : 0,
    meetingsBooked: 0,
    rfpResponsesInProgress: rfpOpen,
    pendingApprovals: pendingSeq + pendingDrafts,
  };
}

export function campaignGoal(type: string): string {
  if (type === "budget_season") {
    return "Agencies are writing next-year budgets. Position Rapid Cortex as a line item before the window closes.";
  }
  if (type === "conference_pre") {
    return "Invite the agency to meet at the upcoming conference or a pre-event briefing.";
  }
  if (type === "re_engagement") {
    return "Light-touch re-engagement after 90 days of silence.";
  }
  return "Relevant Rapid Cortex outreach for this campaign.";
}

export function emptyDraft(partial: Omit<RapidIqSalesContentDraft, "createdAt" | "updatedAt" | "status" | "generatedBy" | "draftId"> & { draftId?: string }): RapidIqSalesContentDraft {
  const now = new Date().toISOString();
  return {
    draftId: partial.draftId ?? newId("draft"),
    contentType: partial.contentType,
    vertical: partial.vertical,
    weekOf: partial.weekOf,
    campaignType: partial.campaignType,
    subject: partial.subject,
    bodyText: partial.bodyText,
    linkedinText: partial.linkedinText,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    generatedBy: "rapid-iq",
    tokenCount: partial.tokenCount,
  };
}
