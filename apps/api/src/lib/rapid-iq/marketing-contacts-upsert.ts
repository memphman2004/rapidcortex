/**
 * Dual-write marketing contacts into:
 * 1) MARKETING_LEADS_TABLE — unsubscribe source of truth (LEAD#{email}/PROFILE + TOKEN#)
 * 2) RAPID_IQ_PIPELINE_SIGNALS_TABLE email list — vertical membership (EMAILLIST#/EMAIL#)
 *
 * Never reactivates locally unsubscribed or SES-suppressed addresses.
 * Never overwrites manually curated email-list rows or non-Apollo marketing-lead profiles.
 */

import { randomUUID } from "node:crypto";
import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  leadVerticalToEmailListVertical,
  type EmailListEntry,
  type EmailListSource,
  type EmailListVertical,
  type LeadVertical,
} from "rapid-cortex-shared";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../env.js";
import { isSuppressedInSES } from "../ses/sesSuppression.js";
import { isLocallyUnsubscribed } from "./sales-automation-db.js";
import { getEmailListEntry, subscribeEmailList } from "./email-list-db.js";
import { pipelineDdb } from "./pipeline-ddb.js";

export type MarketingContactUpsertInput = {
  email: string;
  vertical: LeadVertical | EmailListVertical;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
  agencyName?: string;
  state?: string;
  source: EmailListSource | "apollo" | "import" | "inbound_form" | "manual";
  sourceId?: string;
  /** When true, overwrite email-list row even if it already exists (admin import repair). */
  forceEmailList?: boolean;
};

export type MarketingContactUpsertResult =
  | {
      ok: true;
      email: string;
      vertical: EmailListVertical;
      marketingLead: "created" | "updated" | "skipped_existing" | "skipped_suppressed" | "skipped_unsubscribed";
      emailList: "created" | "skipped_existing" | "skipped_suppressed" | "skipped_unsubscribed";
      unsubscribeToken: string;
    }
  | { ok: false; reason: "invalid_email" | "suppressed" | "unsubscribed" | "no_marketing_table" };

function marketingTable(): string | null {
  const t = env.marketingLeadsTable?.trim() || process.env.MARKETING_LEADS_TABLE?.trim();
  return t || null;
}

function toEmailListVertical(vertical: LeadVertical | EmailListVertical): EmailListVertical {
  const upper = String(vertical).toUpperCase();
  if (
    upper === "PSAP" ||
    upper === "LAW_ENFORCEMENT" ||
    upper === "FIRE_EMS" ||
    upper === "CAMPUS" ||
    upper === "VENUE" ||
    upper === "HOSPITAL" ||
    upper === "TRANSIT"
  ) {
    return upper as EmailListVertical;
  }
  return leadVerticalToEmailListVertical(vertical as LeadVertical);
}

function toLeadVertical(vertical: LeadVertical | EmailListVertical): LeadVertical {
  const raw = String(vertical);
  if (raw.includes("_") || raw === "rc911" || raw === "unknown") return raw as LeadVertical;
  const map: Record<string, LeadVertical> = {
    PSAP: "rc911",
    LAW_ENFORCEMENT: "law_enforcement",
    FIRE_EMS: "fire_ems",
    CAMPUS: "campus",
    VENUE: "venue",
    HOSPITAL: "hospital",
    TRANSIT: "transit",
  };
  return map[raw.toUpperCase()] ?? "unknown";
}

function displayName(input: MarketingContactUpsertInput): string | undefined {
  if (input.name?.trim()) return input.name.trim();
  const parts = [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

export async function upsertMarketingContact(
  input: MarketingContactUpsertInput,
): Promise<MarketingContactUpsertResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, reason: "invalid_email" };

  if (await isSuppressedInSES(email)) {
    return { ok: false, reason: "suppressed" };
  }
  if (await isLocallyUnsubscribed(email)) {
    return { ok: false, reason: "unsubscribed" };
  }

  const table = marketingTable();
  if (!table) return { ok: false, reason: "no_marketing_table" };

  const emailListVertical = toEmailListVertical(input.vertical);
  const leadVertical = toLeadVertical(input.vertical);
  const now = new Date().toISOString();
  const source = input.source === "inbound_form" ? "rapid_iq_contact" : input.source;

  const existingProfile = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { pk: `LEAD#${email}`, sk: "PROFILE" },
    }),
  );
  const existing = existingProfile.Item as Record<string, unknown> | undefined;
  const existingStatus = typeof existing?.status === "string" ? existing.status : "";
  if (existingStatus === "bounced" || existingStatus === "complained" || existingStatus === "unsubscribed") {
    return { ok: false, reason: "unsubscribed" };
  }

  let unsubscribeToken =
    typeof existing?.unsubscribeToken === "string" && existing.unsubscribeToken
      ? existing.unsubscribeToken
      : randomUUID();
  let marketingLead:
    | "created"
    | "updated"
    | "skipped_existing"
    | "skipped_suppressed"
    | "skipped_unsubscribed" = "created";

  if (!existing) {
    const leadId = randomUUID();
    const ttl = Math.floor(Date.now() / 1000) + 365 * 3 * 86400;
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: {
          pk: `LEAD#${email}`,
          sk: "PROFILE",
          leadId,
          email,
          firstName: input.firstName?.trim() || undefined,
          lastName: input.lastName?.trim() || undefined,
          title: input.title?.trim() || undefined,
          agencyName: input.agencyName?.trim() || undefined,
          state: input.state?.trim() || undefined,
          vertical: leadVertical,
          source,
          sourceId: input.sourceId,
          subscribed: true,
          status: "active",
          unsubscribeToken,
          createdAt: now,
          updatedAt: now,
          ttl,
        },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: {
          pk: `TOKEN#${unsubscribeToken}`,
          sk: "UNSUBSCRIBE",
          email,
          leadId,
          ttl,
        },
      }),
    );
    marketingLead = "created";
  } else {
    const existingSource = typeof existing.source === "string" ? existing.source : "";
    const canOverwrite =
      !existingSource ||
      existingSource === "apollo" ||
      source === "manual" ||
      source === "import";
    if (!canOverwrite && existingSource !== source) {
      unsubscribeToken =
        typeof existing.unsubscribeToken === "string" && existing.unsubscribeToken
          ? existing.unsubscribeToken
          : unsubscribeToken;
      marketingLead = "skipped_existing";
    } else {
      if (!existing.unsubscribeToken) {
        const leadId = typeof existing.leadId === "string" ? existing.leadId : randomUUID();
        const ttl =
          typeof existing.ttl === "number"
            ? existing.ttl
            : Math.floor(Date.now() / 1000) + 365 * 3 * 86400;
        await ddb.send(
          new PutCommand({
            TableName: table,
            Item: {
              pk: `TOKEN#${unsubscribeToken}`,
              sk: "UNSUBSCRIBE",
              email,
              leadId,
              ttl,
            },
          }),
        );
      } else {
        unsubscribeToken = String(existing.unsubscribeToken);
      }
      const names: Record<string, string> = { "#vertical": "vertical", "#src": "source" };
      const values: Record<string, unknown> = {
        ":vertical": leadVertical,
        ":now": now,
        ":source": source,
        ":token": unsubscribeToken,
        ":true": true,
      };
      let expr =
        "SET #vertical = if_not_exists(#vertical, :vertical), updatedAt = :now, " +
        "#src = if_not_exists(#src, :source), " +
        "unsubscribeToken = if_not_exists(unsubscribeToken, :token), " +
        "subscribed = if_not_exists(subscribed, :true)";
      if (input.firstName?.trim()) {
        expr += ", firstName = if_not_exists(firstName, :firstName)";
        values[":firstName"] = input.firstName.trim();
      }
      if (input.lastName?.trim()) {
        expr += ", lastName = if_not_exists(lastName, :lastName)";
        values[":lastName"] = input.lastName.trim();
      }
      if (input.title?.trim()) {
        expr += ", title = if_not_exists(title, :title)";
        values[":title"] = input.title.trim();
      }
      if (input.agencyName?.trim()) {
        expr += ", agencyName = if_not_exists(agencyName, :agencyName)";
        values[":agencyName"] = input.agencyName.trim();
      }
      if (input.state?.trim()) {
        expr += ", #st = if_not_exists(#st, :state)";
        names["#st"] = "state";
        values[":state"] = input.state.trim();
      }
      await ddb.send(
        new UpdateCommand({
          TableName: table,
          Key: { pk: `LEAD#${email}`, sk: "PROFILE" },
          UpdateExpression: expr,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        }),
      );
      marketingLead = existingSource === "apollo" || !existingSource ? "updated" : "skipped_existing";
    }
  }

  const existingList = await getEmailListEntry(emailListVertical, email);
  let emailList: "created" | "skipped_existing" | "skipped_suppressed" | "skipped_unsubscribed" =
    "skipped_existing";
  if (!existingList || input.forceEmailList) {
    const result = await subscribeEmailList({
      body: {
        email,
        vertical: emailListVertical,
        name: displayName(input),
        agencyName: input.agencyName?.trim() || undefined,
        state: input.state?.trim() || undefined,
        source: source as EmailListSource,
      },
      createdBy: `system:${source}`,
      allowIfUnsubscribed: false,
    });
    if (!result.ok) {
      emailList = result.reason === "unsubscribed" ? "skipped_unsubscribed" : "skipped_existing";
    } else {
      emailList = existingList ? "skipped_existing" : "created";
    }
  }

  return {
    ok: true,
    email,
    vertical: emailListVertical,
    marketingLead,
    emailList,
    unsubscribeToken,
  };
}

/** Look up marketing lead PROFILE by unsubscribe token (TOKEN# row → email → PROFILE). */
export async function getMarketingLeadByUnsubscribeToken(
  token: string,
): Promise<Record<string, unknown> | null> {
  const table = marketingTable();
  if (!table || !token.trim()) return null;
  const tokenRes = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { pk: `TOKEN#${token.trim()}`, sk: "UNSUBSCRIBE" },
    }),
  );
  const email =
    typeof tokenRes.Item?.email === "string" ? tokenRes.Item.email.trim().toLowerCase() : "";
  if (!email) return null;
  const profile = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { pk: `LEAD#${email}`, sk: "PROFILE" },
    }),
  );
  return (profile.Item as Record<string, unknown> | undefined) ?? null;
}

export async function setMarketingLeadStatusByToken(
  token: string,
  status: "bounced" | "complained" | "unsubscribed",
): Promise<{ email: string } | null> {
  const table = marketingTable();
  if (!table) return null;
  const profile = await getMarketingLeadByUnsubscribeToken(token);
  if (!profile || typeof profile.email !== "string") return null;
  const email = profile.email.trim().toLowerCase();
  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: table,
      Key: { pk: `LEAD#${email}`, sk: "PROFILE" },
      UpdateExpression:
        "SET #status = :status, subscribed = :false, updatedAt = :now" +
        (status === "unsubscribed" ? ", unsubscribedAt = :now" : ""),
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":false": false,
        ":now": now,
      },
    }),
  );
  return { email };
}

export async function updateMarketingLeadEngagementByToken(
  token: string,
  field: "lastOpenedAt" | "lastClickedAt",
): Promise<{ email: string } | null> {
  const table = marketingTable();
  if (!table) return null;
  const profile = await getMarketingLeadByUnsubscribeToken(token);
  if (!profile || typeof profile.email !== "string") return null;
  const email = profile.email.trim().toLowerCase();
  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: table,
      Key: { pk: `LEAD#${email}`, sk: "PROFILE" },
      UpdateExpression: `SET ${field} = :now, updatedAt = :now`,
      ExpressionAttributeValues: { ":now": now },
    }),
  );
  return { email };
}

/**
 * Fill missing `state` on email-list rows from MARKETING_LEADS PROFILE (Apollo/CSV already
 * store state there). Uses GetItem (already on SignalHttp IAM) — not BatchGetItem.
 */
export async function enrichEmailListEntriesWithLeadState(
  entries: EmailListEntry[],
): Promise<EmailListEntry[]> {
  const table = marketingTable();
  if (!table || entries.length === 0) return entries;

  const need = [
    ...new Set(entries.filter((e) => !e.state?.trim()).map((e) => e.email.trim().toLowerCase())),
  ];
  if (need.length === 0) return entries;

  const stateByEmail = new Map<string, string>();
  const concurrency = 25;
  for (let i = 0; i < need.length; i += concurrency) {
    const chunk = need.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (email) => {
        try {
          const res = await ddb.send(
            new GetCommand({
              TableName: table,
              Key: { pk: `LEAD#${email}`, sk: "PROFILE" },
              ProjectionExpression: "email, #s",
              ExpressionAttributeNames: { "#s": "state" },
            }),
          );
          const state =
            typeof res.Item?.state === "string" ? res.Item.state.trim().slice(0, 80) : "";
          return state ? ([email, state] as const) : null;
        } catch (err) {
          console.warn(
            JSON.stringify({
              msg: "email_list_state_enrich_failed",
              email,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
          return null;
        }
      }),
    );
    for (const row of results) {
      if (row) stateByEmail.set(row[0], row[1]);
    }
  }

  if (stateByEmail.size === 0) return entries;
  return entries.map((entry) => {
    if (entry.state?.trim()) return entry;
    const state = stateByEmail.get(entry.email.trim().toLowerCase());
    return state ? { ...entry, state } : entry;
  });
}

/** Query marketing leads by vertical via GSI (falls back to empty if GSI missing). */
export async function listMarketingLeadsByVertical(
  vertical: LeadVertical,
  limit = 500,
): Promise<Record<string, unknown>[]> {
  const table = marketingTable();
  if (!table) return [];
  try {
    const items: Record<string, unknown>[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const res = await ddb.send(
        new QueryCommand({
          TableName: table,
          IndexName: "vertical-createdAt-index",
          KeyConditionExpression: "vertical = :v",
          ExpressionAttributeValues: { ":v": vertical },
          ScanIndexForward: false,
          ExclusiveStartKey,
        }),
      );
      for (const item of res.Items ?? []) {
        items.push(item as Record<string, unknown>);
        if (items.length >= limit) return items;
      }
      ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);
    return items;
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "marketing_leads_vertical_gsi_query_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return [];
  }
}

/** Ensure pipeline ddb client is referenced so tree-shaking keeps the module. */
void pipelineDdb;
