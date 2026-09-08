import { createHash } from "node:crypto";
import {
  defaultGroupsForVertical,
  interpolateAlertTemplate,
  parseAlertRecipientCsv,
  recipientEligibleForSms,
  systemTemplateSeeds,
  type AlertDispatchBody,
  type AlertDispatchJob,
  type AlertOrganization,
  type AlertRecipient,
  type AlertRecipientGroup,
  type AlertTemplate,
  type AlertVertical,
} from "rapid-cortex-shared";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { broadcastToAgency } from "../lib/websocket/send-message.js";
import { alertsStore } from "./store.js";
import { isStartKeyword, isStopKeyword } from "./sms-keywords.js";

const HOURLY_OCCUPANT_LIMIT = 3;
const CRITICAL_COOLDOWN_MS = 5 * 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function recipientIdFrom(email?: string, phoneE164?: string): string {
  const key = (phoneE164 || email || makeId("rec")).toLowerCase();
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}

export async function ensureDefaultOrganization(
  agencyId: string,
  vertical: AlertVertical,
  name?: string,
): Promise<AlertOrganization> {
  const existing = await alertsStore.listOrganizations(agencyId);
  const match = existing.find((o) => o.vertical === vertical);
  if (match) return match;
  const organizationId = agencyId;
  const org: AlertOrganization = {
    organizationId,
    agencyId,
    vertical,
    name: name ?? agencyId,
    memberAgencyIds: [agencyId],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await alertsStore.putOrganization(org);
  return org;
}

export async function ensureSystemCatalog(
  agencyId: string,
  vertical: AlertVertical,
  org: AlertOrganization,
): Promise<void> {
  const groups = await alertsStore.listGroups(agencyId);
  if (!groups.some((g) => g.vertical === vertical)) {
    for (const g of defaultGroupsForVertical(vertical, agencyId)) {
      const group: AlertRecipientGroup = {
        groupId: makeId("grp"),
        organizationId: org.organizationId,
        agencyId,
        vertical,
        slug: g.slug,
        name: g.name,
        system: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await alertsStore.putGroup(group);
    }
  }
  const templates = await alertsStore.listTemplates(agencyId);
  if (!templates.some((t) => t.vertical === vertical && t.system)) {
    for (const seed of systemTemplateSeeds(vertical)) {
      const tpl: AlertTemplate = {
        templateId: makeId("tpl"),
        organizationId: org.organizationId,
        agencyId,
        vertical,
        type: seed.type,
        title: seed.title,
        body: seed.body,
        smsBody: seed.smsBody,
        severity: seed.severity,
        system: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await alertsStore.putTemplate(tpl);
    }
  }
}

export async function importRecipients(params: {
  agencyId: string;
  vertical: AlertVertical;
  organizationId?: string;
  csv: string;
}): Promise<{ imported: number; updated: number; failed: number; errors: Array<{ row: number; message: string }> }> {
  const org = params.organizationId
    ? (await alertsStore.getOrganization(params.agencyId, params.organizationId)) ??
      (await ensureDefaultOrganization(params.agencyId, params.vertical))
    : await ensureDefaultOrganization(params.agencyId, params.vertical);
  await ensureSystemCatalog(params.agencyId, params.vertical, org);
  const groups = await alertsStore.listGroups(params.agencyId);
  const slugToId = new Map(groups.filter((g) => g.vertical === params.vertical).map((g) => [g.slug, g.groupId]));
  const existingAll = await alertsStore.listRecipients(params.agencyId);
  const byPhone = new Map(existingAll.filter((r) => r.phoneE164).map((r) => [r.phoneE164!, r]));
  const byEmail = new Map(existingAll.filter((r) => r.email).map((r) => [r.email!, r]));
  const parsed = parseAlertRecipientCsv(params.csv);
  let imported = 0;
  let updated = 0;
  for (const row of parsed.rows) {
    const existing =
      (row.phoneE164 ? byPhone.get(row.phoneE164) : undefined) ??
      (row.email ? byEmail.get(row.email) : undefined);
    const groupIds = row.groupSlugs.map((s) => slugToId.get(s)).filter((id): id is string => Boolean(id));
    const recipient: AlertRecipient = {
      recipientId: existing?.recipientId ?? recipientIdFrom(row.email, row.phoneE164),
      organizationId: org.organizationId,
      agencyId: params.agencyId,
      vertical: params.vertical,
      email: row.email,
      phoneE164: row.phoneE164,
      displayName: row.displayName,
      groupIds: groupIds.length > 0 ? groupIds : existing?.groupIds ?? [],
      smsOptIn: row.smsOptIn,
      smsOptedOut: existing?.smsOptedOut ?? false,
      optInDate: row.optInDate,
      optInMethod: row.optInMethod,
      optInConsentText: row.optInConsentText,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    await alertsStore.putRecipient(recipient);
    if (recipient.phoneE164) byPhone.set(recipient.phoneE164, recipient);
    if (recipient.email) byEmail.set(recipient.email, recipient);
    if (existing) updated += 1;
    else imported += 1;
  }
  return {
    imported,
    updated,
    failed: parsed.errors.length,
    errors: parsed.errors,
  };
}

async function resolveShortCode(agencyId: string): Promise<string | null> {
  const prefix = env.alertShortCodeSsmPrefix.replace(/\/$/, "");
  const name = `${prefix}/${agencyId}`;
  try {
    const ssm = new SSMClient({});
    const out = await ssm.send(new GetParameterCommand({ Name: name }));
    const value = out.Parameter?.Value?.trim() ?? "";
    return value || null;
  } catch {
    return null;
  }
}

export async function dispatchOccupantAlert(params: {
  agencyId: string;
  actorId: string;
  displayName: string;
  body: AlertDispatchBody;
  canCritical: boolean;
}): Promise<AlertDispatchJob> {
  const org = params.body.organizationId
    ? (await alertsStore.getOrganization(params.agencyId, params.body.organizationId)) ??
      (await ensureDefaultOrganization(params.agencyId, params.body.vertical, params.displayName))
    : await ensureDefaultOrganization(params.agencyId, params.body.vertical, params.displayName);
  await ensureSystemCatalog(params.agencyId, params.body.vertical, org);

  if (!org.memberAgencyIds.includes(params.agencyId)) {
    throw Object.assign(new Error("ORGANIZATION_SCOPE"), { statusCode: 403 });
  }

  const template = await alertsStore.getTemplate(params.agencyId, params.body.templateId);
  if (!template || template.vertical !== params.body.vertical) {
    throw Object.assign(new Error("TEMPLATE_NOT_FOUND"), { statusCode: 404 });
  }
  if (template.severity === "CRITICAL" && !params.canCritical) {
    throw Object.assign(new Error("CRITICAL_FORBIDDEN"), { statusCode: 403 });
  }

  const vars = {
    campusName: params.displayName,
    venueName: params.displayName,
    agencyName: params.displayName,
  };
  const bodyText = interpolateAlertTemplate(params.body.bodyOverride ?? template.body, vars);
  const jobId = makeId("ajob");
  const initiatedAt = nowIso();

  if (template.severity === "CRITICAL" && template.type !== "ALL_CLEAR") {
    const lock = await alertsStore.getCriticalLock(params.agencyId, org.organizationId);
    if (lock?.until && new Date(lock.until).getTime() > Date.now()) {
      throw Object.assign(new Error("CRITICAL_COOLDOWN"), { statusCode: 429 });
    }
  }

  const hourly = await alertsStore.incrementHourlyDispatch(org.organizationId, params.agencyId);
  if (hourly > HOURLY_OCCUPANT_LIMIT) {
    throw Object.assign(new Error("HOURLY_RATE_LIMIT"), { statusCode: 429 });
  }

  const groups = await alertsStore.listGroups(params.agencyId);
  const selectedGroups = new Set(params.body.groupIds);
  const recipients = (await alertsStore.listRecipients(params.agencyId)).filter((r) =>
    r.groupIds.some((g) => selectedGroups.has(g)),
  );

  const channels = params.body.channels;
  const channelSummary: AlertDispatchJob["channelSummary"] = [];

  const job: AlertDispatchJob = {
    jobId,
    organizationId: org.organizationId,
    agencyId: params.agencyId,
    vertical: params.body.vertical,
    templateId: template.templateId,
    templateType: template.type,
    title: interpolateAlertTemplate(template.title, vars),
    body: bodyText,
    severity: template.severity,
    groupIds: params.body.groupIds,
    channels,
    status: "DISPATCHING",
    initiatedAt,
    actorId: params.actorId,
    estimatedRecipients: recipients.length,
    channelSummary,
  };
  await alertsStore.putJob(job);

  const wsType =
    params.body.vertical === "venue"
      ? "VENUE_ALERT"
      : params.body.vertical === "transit"
        ? "TRANSIT_ALERT"
        : "CAMPUS_ALERT";
  const alertData = {
    jobId,
    vertical: params.body.vertical,
    title: job.title,
    body: bodyText,
    severity: template.severity,
    type: template.type,
    sentAt: initiatedAt,
  };
  const fanout = org.memberAgencyIds.flatMap((memberAgencyId) => [
    broadcastToAgency({
      agencyId: memberAgencyId,
      message: { type: wsType, data: alertData },
    }).catch(() => undefined),
    broadcastToAgency({
      agencyId: memberAgencyId,
      message: { type: "VERTICAL_ALERT", data: alertData },
    }).catch(() => undefined),
  ]);

  const smsWanted = channels.includes("SMS");
  const emailWanted = channels.includes("EMAIL");
  const pushWanted = channels.includes("WEB_PUSH");
  const dashWanted = channels.includes("WEB_DASHBOARD");

  const shortCode = smsWanted ? await resolveShortCode(params.agencyId) : null;

  const channelWork: Array<Promise<void>> = [
    ...fanout.map(async (p) => {
      await p;
    }),
  ];

  if (dashWanted) {
    channelWork.push(
      (async () => {
        await alertsStore.putDelivery({
          agencyId: params.agencyId,
          organizationId: org.organizationId,
          jobId,
          recipientId: "console-sessions",
          channel: "WEB_DASHBOARD",
          status: "sent",
        });
        channelSummary.push({
          channel: "WEB_DASHBOARD",
          queued: 1,
          sent: 1,
          delivered: 1,
          failed: 0,
          skipped: 0,
        });
      })(),
    );
  }

  if (smsWanted) {
    channelWork.push(
      (async () => {
        if (!shortCode) {
          await alertsStore.putDelivery({
            agencyId: params.agencyId,
            organizationId: org.organizationId,
            jobId,
            recipientId: "sms-all",
            channel: "SMS",
            status: "skipped",
            reason: "NO_SHORT_CODE",
          });
          channelSummary.push({
            channel: "SMS",
            queued: 0,
            sent: 0,
            delivered: 0,
            failed: 0,
            skipped: recipients.length,
            skipReason:
              "Short code not provisioned (8–12 weeks). Delivery initiated only for other channels.",
          });
          return;
        }
        let skipped = 0;
        let queued = 0;
        for (const rec of recipients) {
          const dnc = rec.phoneE164 ? await alertsStore.isDnc(params.agencyId, rec.phoneE164) : false;
          const elig = recipientEligibleForSms({
            phoneE164: rec.phoneE164,
            smsOptIn: rec.smsOptIn,
            smsOptedOut: rec.smsOptedOut,
            dnc,
          });
          if (!elig.ok) {
            skipped += 1;
            await alertsStore.putDelivery({
              agencyId: params.agencyId,
              organizationId: org.organizationId,
              jobId,
              recipientId: rec.recipientId,
              channel: "SMS",
              status: "skipped",
              reason: elig.reason,
            });
            continue;
          }
          queued += 1;
          await alertsStore.putDelivery({
            agencyId: params.agencyId,
            organizationId: org.organizationId,
            jobId,
            recipientId: rec.recipientId,
            channel: "SMS",
            status: "queued",
            reason: "SHORT_CODE_QUEUE",
          });
        }
        channelSummary.push({
          channel: "SMS",
          queued,
          sent: 0,
          delivered: 0,
          failed: 0,
          skipped,
          skipReason: queued > 0 ? undefined : "NO_ELIGIBLE_RECIPIENTS",
        });
      })(),
    );
  }

  if (emailWanted) {
    channelWork.push(
      (async () => {
        await alertsStore.putDelivery({
          agencyId: params.agencyId,
          organizationId: org.organizationId,
          jobId,
          recipientId: "email-all",
          channel: "EMAIL",
          status: "skipped",
          reason: "CHANNEL_NOT_ENABLED",
        });
        channelSummary.push({
          channel: "EMAIL",
          queued: 0,
          sent: 0,
          delivered: 0,
          failed: 0,
          skipped: recipients.length,
          skipReason: "Email channel ships in a later phase (SES). Not sent.",
        });
      })(),
    );
  }

  if (pushWanted) {
    channelWork.push(
      (async () => {
        await alertsStore.putDelivery({
          agencyId: params.agencyId,
          organizationId: org.organizationId,
          jobId,
          recipientId: "push-all",
          channel: "WEB_PUSH",
          status: "skipped",
          reason: "CHANNEL_NOT_ENABLED",
        });
        channelSummary.push({
          channel: "WEB_PUSH",
          queued: 0,
          sent: 0,
          delivered: 0,
          failed: 0,
          skipped: recipients.length,
          skipReason: "Web push ships in a later phase. Not sent.",
        });
      })(),
    );
  }

  await Promise.all(channelWork);

  if (template.severity === "CRITICAL" && template.type !== "ALL_CLEAR") {
    await alertsStore.putCriticalLock(
      params.agencyId,
      org.organizationId,
      new Date(Date.now() + CRITICAL_COOLDOWN_MS).toISOString(),
    );
  }

  const completed: AlertDispatchJob = {
    ...job,
    channelSummary,
    status: "COMPLETED",
    completedAt: nowIso(),
  };
  await alertsStore.putJob(completed);
  return completed;
}

export { isStartKeyword, isStopKeyword } from "./sms-keywords.js";
