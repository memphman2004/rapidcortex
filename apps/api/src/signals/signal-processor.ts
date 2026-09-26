/**
 * Central signal processor — SNS consumer.
 * Every LeadSignal must carry `vertical`; prospecting queue PK is VERTICAL#{vertical}.
 * Never attaches a campus signal to a venue lead (or any cross-vertical pair).
 */
import type { SNSEvent } from "aws-lambda";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import type { LeadSignal, LeadSignalType, LeadVertical } from "rapid-cortex-shared";
import { computeHotScore, grantVisibleToVertical } from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";
import { SalesLeadRepository } from "../repositories/salesLeadRepository.js";

const leadsRepo = new SalesLeadRepository();

type IncomingSignal = {
  signalType: LeadSignalType;
  title: string;
  summary: string;
  source: string;
  sourceUrl?: string;
  strength: LeadSignal["strength"];
  detectedAgencyName?: string;
  /** Required — processor rejects events without vertical. */
  vertical: LeadVertical;
  leadId?: string;
};

function signalsTable(): string {
  const t = process.env.LEAD_SIGNALS_TABLE?.trim();
  if (!t) throw new Error("LEAD_SIGNALS_TABLE_NOT_CONFIGURED");
  return t;
}

function prospectingTable(): string {
  const t = process.env.SIGNAL_PROSPECTING_TABLE?.trim();
  if (!t) throw new Error("SIGNAL_PROSPECTING_TABLE_NOT_CONFIGURED");
  return t;
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fuzzyAgencyMatch(
  needle: string,
  agency: string,
): boolean {
  const a = normalizeName(needle);
  const b = normalizeName(agency);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}

async function putSignalRow(signal: LeadSignal): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: signalsTable(),
      Item: {
        pk: `LEAD#${signal.leadId}`,
        sk: `SIGNAL#${signal.detectedAt}#${signal.signalId}`,
        ...signal,
        gsi1pk: `VERTICAL#${signal.vertical}`,
        gsi1sk: `DETECTED_AT#${signal.detectedAt}#${signal.signalId}`,
      },
    }),
  );
}

async function putProspecting(signal: IncomingSignal): Promise<void> {
  const id = randomUUID();
  await ddb.send(
    new PutCommand({
      TableName: prospectingTable(),
      Item: {
        pk: `VERTICAL#${signal.vertical}`,
        sk: `CANDIDATE#${new Date().toISOString()}#${id}`,
        candidateId: id,
        ...signal,
        createdAt: new Date().toISOString(),
      },
    }),
  );
}

export async function processIncomingSignal(raw: IncomingSignal): Promise<void> {
  if (!raw.vertical || raw.vertical === "unknown") {
    console.warn(JSON.stringify({ msg: "signal_rejected_missing_vertical", title: raw.title }));
    return;
  }

  const leads = await leadsRepo.listNormalized(500);
  let lead = raw.leadId
    ? leads.find((l) => l.leadId === raw.leadId)
    : undefined;

  if (!lead && raw.detectedAgencyName) {
    lead = leads.find((l) => {
      if (!grantVisibleToVertical([raw.vertical], l.vertical)) return false;
      const name = l.agencyName ?? l.agencyCompany ?? "";
      return fuzzyAgencyMatch(raw.detectedAgencyName!, name);
    });
  }

  // Cross-vertical guard even when leadId is supplied
  if (lead && !grantVisibleToVertical([raw.vertical], lead.vertical)) {
    console.warn(
      JSON.stringify({
        msg: "signal_rejected_vertical_mismatch",
        leadId: lead.leadId,
        leadVertical: lead.vertical,
        signalVertical: raw.vertical,
      }),
    );
    return;
  }

  if (!lead) {
    if (raw.signalType === "RFP_SIGNAL" || raw.signalType === "GRANT_AWARD") {
      // Auto-create is deferred to a dedicated path; queue for review in vertical bucket
      await putProspecting(raw);
      return;
    }
    await putProspecting(raw);
    return;
  }

  const signal: LeadSignal = {
    signalId: randomUUID(),
    leadId: lead.leadId,
    type: raw.signalType,
    title: raw.title,
    summary: raw.summary,
    sourceUrl: raw.sourceUrl,
    source: raw.source,
    strength: raw.strength,
    detectedAt: new Date().toISOString(),
    repAcknowledged: false,
    vertical: raw.vertical,
  };

  const existing = Array.isArray(lead.signals) ? lead.signals : [];
  const scoped = existing.filter((s) => s.vertical === raw.vertical);
  const next = [...scoped, signal].slice(-50);
  const hotScore = computeHotScore(next);

  await putSignalRow(signal);
  await leadsRepo.updateSignalsMeta(lead.leadId, {
    signals: next,
    signalCount: next.length,
    lastSignalAt: signal.detectedAt,
    hotScore,
  });

  if (hotScore >= 70) {
    console.log(
      JSON.stringify({
        msg: "hot_lead",
        leadId: lead.leadId,
        vertical: raw.vertical,
        hotScore,
        assignee: lead.assignedTo ?? lead.assignee,
      }),
    );
  }
}

export const handler = async (event: SNSEvent): Promise<{ processed: number }> => {
  let processed = 0;
  for (const rec of event.Records ?? []) {
    try {
      const body = JSON.parse(rec.Sns.Message) as IncomingSignal;
      await processIncomingSignal(body);
      processed += 1;
    } catch (err) {
      console.error(JSON.stringify({ msg: "signal_processor_error", error: String(err) }));
    }
  }
  return { processed };
};

/** List signals for one vertical only (Signal Feed API). */
export async function listSignalsForVertical(
  vertical: LeadVertical,
  limit = 100,
): Promise<LeadSignal[]> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: signalsTable(),
      IndexName: "ByVerticalDetectedAt",
      KeyConditionExpression: "gsi1pk = :v",
      ExpressionAttributeValues: { ":v": `VERTICAL#${vertical}` },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (out.Items ?? []).filter((i) => (i as LeadSignal).vertical === vertical) as LeadSignal[];
}
