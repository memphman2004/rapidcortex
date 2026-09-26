/**
 * Sales automation engine: suppression, 3-touch draft generation, approve/schedule.
 * Cold outreach always stays draft until an rcadmin approves. Never auto-send.
 */

import { randomBytes } from "node:crypto";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  normalizeSalesAutomationVertical,
  type CreateRapidIqSalesBulkCampaignBody,
  type CreateRapidIqSalesSequenceBody,
  type RapidIqSalesBulkApproveResult,
  type RapidIqSalesBulkBatch,
  type RapidIqSalesBulkResult,
  type RapidIqSalesCampaignCard,
  type RapidIqSalesContentDraft,
  type RapidIqSalesMetrics,
  type RapidIqSalesOutreachStep,
  type RapidIqSalesSequence,
  type RapidIqSalesStepLabel,
  type RapidIqSalesVertical,
  type UpdateRapidIqSalesDraftBody,
  type UpdateRapidIqSalesSequenceBody,
} from "rapid-cortex-shared";
import { isCollectorsMockEnabled } from "./agenda-finder.js";
import { findContactsViaHunter } from "./hunter-enrichment.js";
import { createJsonResponse } from "./openai-client.js";
import { isRapidIqAiEnabled, rapidIqModelStrategy } from "./openai-config.js";
import { pipelineDdb } from "./pipeline-ddb.js";
import {
  getSalesDraft,
  getSalesSequence,
  hasRecentSend,
  isLocallyUnsubscribed,
  listSalesDrafts,
  listSalesSequences,
  putSalesDraft,
  putSalesSequence,
} from "./sales-automation-db.js";
import { verticalThreeTouchCopy } from "./vertical-email-campaign.js";

const STEP_DELAY_DAYS: Record<RapidIqSalesStepLabel, number> = {
  initial: 0,
  followup_1: 5,
  followup_2: 12,
};

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export type SuppressionResult = { suppressed: boolean; reason?: string };

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

export async function checkSuppression(
  email: string,
  opts?: { exceptSequenceId?: string },
): Promise<SuppressionResult> {
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
  if (await hasRecentSend(lower, daysAgoIso(30), opts?.exceptSequenceId)) {
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
<p style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;color:#555;font-size:13px;">NexCort iQ · rapidcortex.us</p>
</body></html>`;
}

function parseSendAt(raw: string | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) throw new Error("Invalid send time");
  return t;
}

function scheduleStepsFromOrigin(
  steps: RapidIqSalesOutreachStep[],
  originMs: number,
): RapidIqSalesOutreachStep[] {
  return steps.map((step) => ({
    ...step,
    scheduledAt: new Date(originMs + step.delayDays * 86_400_000).toISOString(),
  }));
}

function wrapBody(firstName: string | undefined, body: string): string {
  const hi = firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi,";
  return `${hi}\n\n${body.trim()}\n\nBest,\nThe NexCort iQ team\nrapidcortex.us`;
}

export function heuristicThreeTouch(input: {
  agencyName: string;
  vertical: RapidIqSalesVertical;
  firstName?: string;
  signalTitle?: string;
  rfpDeadline?: string;
  campaignType?: string;
}): RapidIqSalesOutreachStep[] {
  const labels = ["initial", "followup_1", "followup_2"] as const;
  const drafts = verticalThreeTouchCopy({
    agencyName: input.agencyName,
    vertical: input.vertical,
    signalTitle: input.signalTitle,
    rfpDeadline: input.rfpDeadline,
  });
  return drafts.map((d, i) => {
    const label = labels[i]!;
    const bodyText = wrapBody(input.firstName, d.body);
    return {
      stepId: newId("step"),
      stepNumber: (i + 1) as 1 | 2 | 3,
      label,
      delayDays: STEP_DELAY_DAYS[label],
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
      "You write concise public-safety outreach for NexCort iQ. Return JSON only. Follow the vertical campaign: PSAP = assistive 911 co-pilot, CAD stays system of record, no write-back by default; CAMPUS = QR/NFC/SMS, not a 911 dispatch system, not an ENS replacement; VENUE = guest QR into security console, cameras stay the venue's, not 911 dispatch. Never mention Ring. No competitor names. No unverified metrics or certification claims. Step 3 is a low-pressure close.",
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
        delayDays: STEP_DELAY_DAYS[label],
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

  const stepsRaw = await generateThreeTouch({
    agencyName: body.agencyName,
    vertical,
    firstName,
    triggerType: body.type,
    signalTitle: body.signalTitle,
    rfpDeadline: body.rfpDeadline,
    campaignType: body.campaignType,
    conferenceName: body.conferenceName,
  });
  const sendOrigin = parseSendAt(body.sendAt);
  const steps = sendOrigin !== undefined ? scheduleStepsFromOrigin(stepsRaw, sendOrigin) : stepsRaw;

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
      campaignId: body.campaignId,
    },
  };
  await putSalesSequence(seq);
  return seq;
}

export async function createBulkCampaign(
  body: CreateRapidIqSalesBulkCampaignBody,
): Promise<RapidIqSalesBulkResult> {
  const vertical = normalizeSalesAutomationVertical(body.vertical);
  const campaignId = newId("bulk");
  const campaignName = body.campaignName?.trim() || `${vertical} outbound ${new Date().toISOString().slice(0, 10)}`;
  const seen = new Set<string>();
  let created = 0;
  let suppressed = 0;
  let skipped = 0;
  let duplicates = 0;

  for (const raw of body.recipients) {
    const email = raw.email.trim().toLowerCase();
    if (seen.has(email)) {
      duplicates += 1;
      continue;
    }
    seen.add(email);
    const agencyName = raw.agencyName.trim();
    if (!agencyName) {
      skipped += 1;
      continue;
    }
    const firstName = raw.recipientName?.trim().split(/\s+/)[0];
    const suppression = await checkSuppression(email);
    const now = new Date().toISOString();
    const stepsRaw = heuristicThreeTouch({
      agencyName,
      vertical,
      firstName,
      campaignType: body.campaignType,
    });
    const sendOrigin = parseSendAt(body.sendAt);
    const steps = sendOrigin !== undefined ? scheduleStepsFromOrigin(stepsRaw, sendOrigin) : stepsRaw;
    const seq: RapidIqSalesSequence = {
      sequenceId: newId("seq"),
      triggerId: campaignId,
      triggerType: "campaign",
      vertical,
      recipientEmail: email,
      recipientName: raw.recipientName?.trim(),
      agencyName,
      status: suppression.suppressed ? "suppressed" : "draft",
      autoApprove: false,
      steps,
      createdAt: now,
      updatedAt: now,
      suppressedReason: suppression.reason,
      attribution: {
        campaignType: body.campaignType,
        campaignId,
        campaignName,
      },
    };
    await putSalesSequence(seq);
    if (suppression.suppressed) suppressed += 1;
    else created += 1;
  }

  return { campaignId, campaignName, created, suppressed, skipped, duplicates };
}

export async function approveBulkCampaign(
  campaignId: string,
  approvedBy: string,
): Promise<Omit<RapidIqSalesBulkApproveResult, "sentNow">> {
  const sequences = await listSalesSequences(500);
  const drafts = sequences.filter(
    (s) => s.attribution.campaignId === campaignId && s.status === "draft",
  );
  if (drafts.length === 0) {
    throw new Error("No draft sequences found for this campaign");
  }
  let approved = 0;
  let suppressed = 0;
  let failed = 0;
  for (const draft of drafts) {
    try {
      const next = await approveSequence(draft.sequenceId, approvedBy);
      if (next.status === "suppressed") suppressed += 1;
      else approved += 1;
    } catch {
      failed += 1;
    }
  }
  return { campaignId, approved, suppressed, failed };
}

export function summarizeBulkBatches(sequences: RapidIqSalesSequence[]): RapidIqSalesBulkBatch[] {
  const map = new Map<string, RapidIqSalesBulkBatch>();
  for (const seq of sequences) {
    const campaignId = seq.attribution.campaignId?.trim();
    if (!campaignId) continue;
    const existing = map.get(campaignId);
    const row =
      existing ??
      ({
        campaignId,
        campaignName: seq.attribution.campaignName?.trim() || campaignId,
        vertical: seq.vertical,
        draftCount: 0,
        activeCount: 0,
        completedCount: 0,
        suppressedCount: 0,
        createdAt: seq.createdAt,
      } satisfies RapidIqSalesBulkBatch);
    if (seq.status === "draft") row.draftCount += 1;
    else if (seq.status === "active") row.activeCount += 1;
    else if (seq.status === "completed") row.completedCount += 1;
    else if (seq.status === "suppressed") row.suppressedCount += 1;
    if (seq.createdAt < row.createdAt) row.createdAt = seq.createdAt;
    if (!existing) map.set(campaignId, row);
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    const existing = step.scheduledAt ? Date.parse(step.scheduledAt) : Number.NaN;
    const when = Number.isNaN(existing)
      ? new Date(origin + step.delayDays * 86_400_000).toISOString()
      : new Date(existing).toISOString();
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

const EDITABLE_SEQUENCE_STATUSES = new Set(["draft", "approved", "active"]);
const EDITABLE_STEP_STATUSES = new Set(["pending", "scheduled"]);

export function applySequenceEmailPatch(
  current: RapidIqSalesSequence,
  patch: UpdateRapidIqSalesSequenceBody,
): RapidIqSalesSequence {
  if (!EDITABLE_SEQUENCE_STATUSES.has(current.status)) {
    throw new Error("Cannot edit a suppressed or completed sequence");
  }
  const now = new Date().toISOString();
  let steps = current.steps;
  if (patch.steps?.length) {
    const byNumber = new Map(patch.steps.map((s) => [s.stepNumber, s]));
    steps = current.steps.map((step) => {
      const nextPatch = byNumber.get(step.stepNumber);
      if (!nextPatch) return step;
      if (!EDITABLE_STEP_STATUSES.has(step.status)) {
        throw new Error(`Email ${step.stepNumber} already sent and cannot be edited`);
      }
      const nextEmail = nextPatch.email
        ? {
            subject: nextPatch.email.subject.trim(),
            bodyText: nextPatch.email.bodyText.trim(),
          }
        : step.email;
      let scheduledAt = step.scheduledAt;
      if (nextPatch.scheduledAt !== undefined) {
        scheduledAt = nextPatch.scheduledAt.trim()
          ? new Date(parseSendAt(nextPatch.scheduledAt) ?? Date.now()).toISOString()
          : undefined;
      }
      return {
        ...step,
        email: nextEmail,
        scheduledAt,
      };
    });
  }
  const anySent = current.steps.some((s) => !EDITABLE_STEP_STATUSES.has(s.status) && s.status !== "skipped");
  if ((patch.recipientEmail || patch.recipientName !== undefined) && anySent) {
    throw new Error("Cannot change the recipient after an email has sent");
  }
  return {
    ...current,
    recipientEmail: patch.recipientEmail?.trim() ?? current.recipientEmail,
    recipientName:
      patch.recipientName !== undefined ? patch.recipientName.trim() || undefined : current.recipientName,
    steps,
    updatedAt: now,
  };
}

export async function updateSequenceCopy(
  sequenceId: string,
  patch: UpdateRapidIqSalesSequenceBody,
): Promise<RapidIqSalesSequence> {
  const current = await getSalesSequence(sequenceId);
  if (!current) throw new Error("Sequence not found");
  const next = applySequenceEmailPatch(current, patch);
  await putSalesSequence(next);
  return next;
}

export function applyDraftEmailPatch(
  current: RapidIqSalesContentDraft,
  patch: UpdateRapidIqSalesDraftBody,
): RapidIqSalesContentDraft {
  if (current.status !== "draft") {
    throw new Error("Only draft content can be edited");
  }
  const bodyText = patch.bodyText?.trim();
  const subject = patch.subject?.trim();
  const linkedinText = patch.linkedinText?.trim();
  if (!bodyText && subject === undefined && patch.linkedinText === undefined) {
    throw new Error("Provide subject, body, or LinkedIn copy to update");
  }
  return {
    ...current,
    subject: subject !== undefined ? subject || undefined : current.subject,
    bodyText: bodyText || current.bodyText,
    linkedinText: patch.linkedinText !== undefined ? linkedinText || undefined : current.linkedinText,
    updatedAt: new Date().toISOString(),
  };
}

export async function updateDraftCopy(
  draftId: string,
  patch: UpdateRapidIqSalesDraftBody,
): Promise<RapidIqSalesContentDraft> {
  const current = await getSalesDraft(draftId);
  if (!current) throw new Error("Draft not found");
  const next = applyDraftEmailPatch(current, patch);
  await putSalesDraft(next);
  return next;
}

export async function updateBulkCampaignCopy(
  campaignId: string,
  patch: Pick<UpdateRapidIqSalesSequenceBody, "steps">,
): Promise<{ updated: number }> {
  if (!patch.steps?.length) throw new Error("Provide at least one step email to update");
  const sequences = await listSalesSequences(500);
  const targets = sequences.filter(
    (s) => s.attribution.campaignId === campaignId && s.status === "draft",
  );
  if (targets.length === 0) throw new Error("No draft sequences found for that campaign");
  let updated = 0;
  for (const seq of targets) {
    const next = applySequenceEmailPatch(seq, { steps: patch.steps });
    await putSalesSequence(next);
    updated += 1;
  }
  return { updated };
}

export async function computeSalesMetrics(): Promise<RapidIqSalesMetrics> {
  const sequences = await listSalesSequences(500);
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
    return "Agencies are writing next-year budgets. Position NexCort iQ as a line item before the window closes.";
  }
  if (type === "conference_pre") {
    return "Invite the agency to meet at the upcoming conference or a pre-event briefing.";
  }
  if (type === "re_engagement") {
    return "Light-touch re-engagement after 90 days of silence.";
  }
  return "Relevant NexCort iQ outreach for this campaign.";
}

export function listCampaignCards(
  conferences: Array<{
    conferenceId: string;
    name: string;
    startDate: string;
    location: string;
    vertical?: string;
    isCancelled?: boolean;
  }>,
): RapidIqSalesCampaignCard[] {
  const now = Date.now();
  const cards: RapidIqSalesCampaignCard[] = [
    {
      id: "psap-core-2026",
      name: "911 / PSAP Core outbound",
      description:
        "6-touch Core sequence (Rapid IQ sends 1–3). CAD stays the system of record. See EMAIL_CAMPAIGN_911_VENUE_CAMPUS.md.",
      next: "Always-on · approve then send from Outlook",
      status: "active",
    },
    {
      id: "campus-safety-2026",
      name: "Campus Safety outbound",
      description:
        "QR / NFC / SMS campus console. Not a 911 dispatch system. Rapid IQ steps 1–3 of the campus track.",
      next: "Always-on · approve then send from Outlook",
      status: "active",
    },
    {
      id: "venue-ops-2026",
      name: "Venue Operations outbound",
      description:
        "Guest QR into section-level security ops. Cameras stay the venue’s. Rapid IQ steps 1–3 of the venue track.",
      next: "Always-on · approve then send from Outlook",
      status: "active",
    },
    {
      id: "budget-season",
      name: "Budget Season",
      description:
        "CONTACTED + QUALIFIED leads. Composer fires 1 Oct and 1 Nov UTC. Sequences still require approval.",
      next: "Oct 1 / Nov 1",
      status: "scheduled",
    },
    {
      id: "newsletter",
      name: "Weekly Newsletter",
      description: "Inside the Cortex draft every Monday 08:00 UTC. Approval required before any send.",
      next: "Mondays 08:00 UTC",
      status: "active",
    },
    {
      id: "re-engagement",
      name: "Re-Engagement Sweep",
      description: "Sunday scan of leads with no activity for 90+ days. Queues light-touch drafts.",
      next: "Sundays 06:15 UTC",
      status: "active",
    },
  ];
  for (const conf of conferences) {
    if (conf.isCancelled) continue;
    const start = Date.parse(conf.startDate);
    if (!Number.isFinite(start)) continue;
    const days = (start - now) / 86_400_000;
    if (days < 0 || days > 120) continue;
    const inWindow = days >= 28 && days <= 33;
    cards.push({
      id: `conf-${conf.conferenceId}`,
      name: conf.name,
      description: `Pre-outreach ~30 days before ${conf.location}. ${conf.vertical ?? "911"} vertical.`,
      next: conf.startDate,
      status: inWindow ? "active" : "scheduled",
    });
  }
  return cards;
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
