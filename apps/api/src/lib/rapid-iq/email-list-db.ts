/**
 * Vertical email list membership on RAPID_IQ_PIPELINE_SIGNALS_TABLE.
 * pk=EMAILLIST#{vertical} sk=EMAIL#{email}
 */

import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  EMAIL_LIST_VERTICALS,
  emailListEntrySchema,
  emailListPartitionsForVertical as emailListPartitionsForVerticalImport,
  normalizeEmailListVertical,
  type AddEmailListEntryBody,
  type EmailListEntry,
  type EmailListVertical,
} from "rapid-cortex-shared";
import { pipelineDdb } from "./pipeline-ddb.js";
import {
  clearSalesUnsubscribe,
  isLocallyUnsubscribed,
  putSalesUnsubscribe,
} from "./sales-automation-db.js";

function table(): string {
  const t = process.env.RAPID_IQ_PIPELINE_SIGNALS_TABLE?.trim();
  if (!t) throw new Error("RAPID_IQ_PIPELINE_SIGNALS_TABLE_NOT_CONFIGURED");
  return t;
}

/** Stale NodeDepsLayer may omit emailListPartitionsForVertical — keep a local fallback. */
function emailListPartitionsForVertical(
  vertical: EmailListVertical | "ALL",
): EmailListVertical[] {
  if (typeof emailListPartitionsForVerticalImport === "function") {
    return emailListPartitionsForVerticalImport(vertical);
  }
  if (vertical === "ALL") {
    return Array.isArray(EMAIL_LIST_VERTICALS)
      ? [...EMAIL_LIST_VERTICALS]
      : ["PSAP", "LAW_ENFORCEMENT", "FIRE_EMS", "CAMPUS", "VENUE", "HOSPITAL", "TRANSIT"];
  }
  if (vertical === "PSAP") return ["PSAP", "LAW_ENFORCEMENT", "FIRE_EMS"];
  return [vertical];
}

function listPk(vertical: EmailListVertical): string {
  return `EMAILLIST#${vertical}`;
}

function emailSk(email: string): string {
  return `EMAIL#${email.trim().toLowerCase()}`;
}

function parseEntry(item: Record<string, unknown>): EmailListEntry | null {
  const parsed = emailListEntrySchema.safeParse({
    email: item.email,
    vertical: item.vertical,
    name: item.name,
    agencyName: item.agencyName,
    state: item.state,
    source: item.source,
    psapId: item.psapId,
    createdAt: item.createdAt,
    createdBy: item.createdBy,
    unsubscribed: item.unsubscribed,
  });
  if (!parsed.success) return null;
  // Preserve agencyName/state even if an older shared schema strips them on parse.
  const rawAgency =
    typeof item.agencyName === "string" && item.agencyName.trim()
      ? item.agencyName.trim().slice(0, 300)
      : undefined;
  const rawState =
    typeof item.state === "string" && item.state.trim()
      ? item.state.trim().slice(0, 80)
      : undefined;
  let entry = parsed.data;
  if (rawAgency && !entry.agencyName) entry = { ...entry, agencyName: rawAgency };
  if (rawState && !entry.state) entry = { ...entry, state: rawState };
  return entry;
}

export async function getEmailListEntry(
  vertical: EmailListVertical,
  email: string,
): Promise<EmailListEntry | null> {
  const lower = email.trim().toLowerCase();
  if (!lower) return null;
  const res = await pipelineDdb.send(
    new GetCommand({
      TableName: table(),
      Key: { pk: listPk(vertical), sk: emailSk(lower) },
    }),
  );
  if (!res.Item) return null;
  return parseEntry(res.Item as Record<string, unknown>);
}

async function listEmailListPartition(
  vertical: EmailListVertical,
  limit: number,
): Promise<EmailListEntry[]> {
  const items: EmailListEntry[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await pipelineDdb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": listPk(vertical),
          ":sk": "EMAIL#",
        },
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) {
      const parsed = parseEntry(item as Record<string, unknown>);
      if (parsed) items.push(parsed);
      if (items.length >= limit) return items;
    }
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

/** List one UI vertical (PSAP expands to include legacy law/fire partitions). */
export async function listEmailListEntries(
  vertical: EmailListVertical,
  limit = 2000,
): Promise<EmailListEntry[]> {
  const partitions = emailListPartitionsForVertical(vertical);
  if (partitions.length === 1) {
    return listEmailListPartition(partitions[0]!, limit);
  }
  const seen = new Set<string>();
  const out: EmailListEntry[] = [];
  for (const part of partitions) {
    const rows = await listEmailListPartition(part, limit);
    for (const row of rows) {
      const key = row.email.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export async function listAllEmailListEntries(limit = 5000): Promise<EmailListEntry[]> {
  const seen = new Set<string>();
  const out: EmailListEntry[] = [];
  for (const vertical of EMAIL_LIST_VERTICALS) {
    const rows = await listEmailListPartition(vertical, limit);
    for (const row of rows) {
      const key = row.email.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export type SubscribeEmailListOpts = {
  body: AddEmailListEntryBody;
  createdBy?: string;
  /** When true, clears UNSUB# (admin re-opt-in). */
  clearUnsubscribe?: boolean;
  /** When false, refuse if locally unsubscribed. */
  allowIfUnsubscribed?: boolean;
};

export type SubscribeEmailListResult =
  | { ok: true; entry: EmailListEntry }
  | { ok: false; reason: "unsubscribed" | "invalid_email" };

export async function subscribeEmailList(
  opts: SubscribeEmailListOpts,
): Promise<SubscribeEmailListResult> {
  const email = opts.body.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, reason: "invalid_email" };

  const unsub = await isLocallyUnsubscribed(email);
  if (unsub && !opts.clearUnsubscribe && !opts.allowIfUnsubscribed) {
    return { ok: false, reason: "unsubscribed" };
  }
  if (unsub && opts.clearUnsubscribe) {
    await clearSalesUnsubscribe(email);
  }

  const vertical = normalizeEmailListVertical(opts.body.vertical);
  const now = new Date().toISOString();
  // Prefer an existing row in any PSAP-family partition when folding law/fire into PSAP.
  let existing = await getEmailListEntry(vertical, email);
  if (!existing && vertical === "PSAP") {
    for (const part of emailListPartitionsForVertical("PSAP")) {
      if (part === "PSAP") continue;
      existing = await getEmailListEntry(part, email);
      if (existing) break;
    }
  }
  const entry: EmailListEntry = {
    email,
    vertical,
    name: opts.body.name?.trim() || existing?.name,
    agencyName: opts.body.agencyName?.trim() || existing?.agencyName,
    state: opts.body.state?.trim() || existing?.state,
    source: opts.body.source ?? "manual",
    psapId: opts.body.psapId?.trim() || existing?.psapId,
    createdAt: existing?.createdAt ?? now,
    createdBy: opts.createdBy ?? existing?.createdBy,
    unsubscribed: false,
  };

  await pipelineDdb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        ...entry,
        pk: listPk(entry.vertical),
        sk: emailSk(email),
        entityType: "email_list",
        agencyId: "platform",
        updatedAt: now,
      },
    }),
  );
  return { ok: true, entry };
}

export async function removeEmailListEntry(
  vertical: EmailListVertical,
  email: string,
): Promise<void> {
  const lower = email.trim().toLowerCase();
  if (!lower) return;
  await pipelineDdb.send(
    new DeleteCommand({
      TableName: table(),
      Key: { pk: listPk(vertical), sk: emailSk(lower) },
    }),
  );
}

export type MoveEmailListEntryResult =
  | { ok: true; entry: EmailListEntry }
  | { ok: false; reason: "not_found" | "invalid_email" | "same_vertical" };

/** Move membership to another vertical (copy then delete source). */
export async function moveEmailListEntry(opts: {
  email: string;
  fromVertical: EmailListVertical;
  toVertical: EmailListVertical;
  updatedBy?: string;
}): Promise<MoveEmailListEntryResult> {
  const email = opts.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, reason: "invalid_email" };
  const toVertical = normalizeEmailListVertical(opts.toVertical);
  if (opts.fromVertical === toVertical) return { ok: false, reason: "same_vertical" };

  const existing = await getEmailListEntry(opts.fromVertical, email);
  if (!existing) return { ok: false, reason: "not_found" };

  const now = new Date().toISOString();
  const entry: EmailListEntry = {
    ...existing,
    email,
    vertical: toVertical,
    createdBy: opts.updatedBy ?? existing.createdBy,
    unsubscribed: false,
  };

  await pipelineDdb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        ...entry,
        pk: listPk(toVertical),
        sk: emailSk(email),
        entityType: "email_list",
        agencyId: "platform",
        updatedAt: now,
        movedFromVertical: opts.fromVertical,
      },
    }),
  );
  await removeEmailListEntry(opts.fromVertical, email);
  return { ok: true, entry };
}

/**
 * Soft-unsubscribe one vertical membership: keep the row, set unsubscribed=true
 * so the Email List UI can show it greyed/inactive without deleting history.
 */
export async function markEmailListUnsubscribed(
  vertical: EmailListVertical,
  email: string,
): Promise<boolean> {
  const lower = email.trim().toLowerCase();
  if (!lower) return false;
  const existing = await getEmailListEntry(vertical, lower);
  if (!existing) return false;
  const now = new Date().toISOString();
  await pipelineDdb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        ...existing,
        pk: listPk(vertical),
        sk: emailSk(lower),
        entityType: "email_list",
        agencyId: "platform",
        unsubscribed: true,
        updatedAt: now,
      },
    }),
  );
  return true;
}

/**
 * Unsubscribe: local UNSUB# + soft-deactivate every vertical membership.
 * Rows stay on the Email List (greyed/inactive); they are excluded from sends.
 */
export async function unsubscribeEmailEverywhere(email: string): Promise<void> {
  const lower = email.trim().toLowerCase();
  if (!lower) return;
  await putSalesUnsubscribe(lower);
  await Promise.all(EMAIL_LIST_VERTICALS.map((v) => markEmailListUnsubscribed(v, lower)));
}

/**
 * Effective opt-in for UI: on list and not locally unsubscribed.
 */
export async function isMonthlyEmailSubscribed(
  vertical: EmailListVertical,
  email: string,
): Promise<boolean> {
  const lower = email.trim().toLowerCase();
  if (!lower) return false;
  if (await isLocallyUnsubscribed(lower)) return false;
  const entry = await getEmailListEntry(vertical, lower);
  return Boolean(entry) && entry?.unsubscribed !== true;
}

/** Active newsletter recipients for a vertical (excludes local unsubs). */
export async function listActiveEmailListRecipients(
  vertical: EmailListVertical,
): Promise<EmailListEntry[]> {
  const rows = await listEmailListEntries(vertical);
  const active: EmailListEntry[] = [];
  for (const row of rows) {
    if (row.unsubscribed) continue;
    if (await isLocallyUnsubscribed(row.email)) continue;
    active.push(row);
  }
  return active;
}

export function emailListEntriesToCsv(entries: EmailListEntry[]): string {
  const header = "email,name,agencyName,state,vertical,source,status,createdAt,psapId";
  const lines = entries.map((e) =>
    [
      e.email,
      csvEscape(e.name ?? ""),
      csvEscape(e.agencyName ?? ""),
      csvEscape(e.state ?? ""),
      e.vertical,
      e.source,
      e.unsubscribed ? "unsubscribed" : "active",
      e.createdAt,
      e.psapId ?? "",
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

function csvEscape(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
