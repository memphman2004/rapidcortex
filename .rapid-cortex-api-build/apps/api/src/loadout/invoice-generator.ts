/**
 * NexCortiQ Loadout — Monthly Invoice Generator
 *
 * Triggered by: EventBridge Scheduler on each tenant's billingCycleDay
 * Also invokable: manually by RC Admin for previews and reruns
 *
 * Flow:
 *  1. Load subscription + usage data for the closing period
 *  2. Calculate line items per feature (baseCents + overageCents) — all values in CENTS
 *  3. Write invoice record to DynamoDB (idempotency guard via attribute_not_exists)
 *  4. Send formatted HTML email via SES (displays dollars converted from cents)
 *  5. Reset usageThisMonth counters for the new period
 *  6. Emit CloudWatch metric for revenue tracking (namespace NexCortiQ/Loadout)
 *
 * Amounts are stored in CENTS; HTML/text templates convert to dollars for display.
 * TTL: Math.floor(Date.now()/1000) + 60*60*24*365*7 (7 years).
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import { randomUUID } from "crypto";
import {
  LOADOUT_FEATURES,
  featureLineCost,
  formatCentsAsUsd,
  type LoadoutInvoice,
  type LoadoutInvoiceLineItem,
} from "rapid-cortex-shared";

const db = new DynamoDBClient({});
const ses = new SESv2Client({});
const cw = new CloudWatchClient({});

const SUBS_TABLE = process.env.SUBSCRIPTIONS_TABLE!;
const INVOICES_TABLE = process.env.INVOICES_TABLE!;
const USAGE_TABLE = process.env.USAGE_TABLE!;
const FROM_EMAIL = process.env.FROM_EMAIL!;    // billing@nexcortiq.us
const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

// ── EVENT SHAPE ───────────────────────────────────────────────────────────────

interface InvoiceEvent {
  tenantId: string;
  period?: string;    // "2026-09" — defaults to previous calendar month
  preview?: boolean;  // true = generate but do not persist or email
}

// ── HANDLER ───────────────────────────────────────────────────────────────────

export const handler = async (
  event: InvoiceEvent,
): Promise<LoadoutInvoice> => {
  const { tenantId, preview = false } = event;
  const period = event.period ?? previousMonth();

  console.log(
    JSON.stringify({ event: "invoice_start", tenantId, period, preview }),
  );

  // 1. Load subscription
  const sub = await getSubscription(tenantId);
  if (!sub) throw new Error(`Subscription not found for tenant: ${tenantId}`);

  // 2. Idempotency check — skip generation if invoice already exists
  if (!preview) {
    const existing = await getExistingInvoice(tenantId, period);
    if (existing) {
      console.log(
        JSON.stringify({
          event: "invoice_already_exists",
          tenantId,
          period,
          invoiceId: existing.invoiceId,
        }),
      );
      await sendInvoiceEmail(existing);
      return existing;
    }
  }

  // 3. Load usage for the period
  const usageMap = await getUsageForPeriod(tenantId, period);

  // 4. Build line items (all amounts in cents)
  const lineItems: LoadoutInvoiceLineItem[] = sub.activeFeatures
    .map((featureId) => {
      const f = LOADOUT_FEATURES[featureId];
      if (!f || !f.monthlyBaseCents) return null;
      const callsUsed = usageMap[featureId] ?? 0;
      const { baseCents, overageCents, totalCents } = featureLineCost(
        featureId,
        callsUsed,
      );
      return {
        featureId,
        featureName: f.name,
        baseCents,
        callsUsed,
        callsIncluded: f.includedCalls,
        overageCents,
        totalCents,
      } satisfies LoadoutInvoiceLineItem;
    })
    .filter((l): l is LoadoutInvoiceLineItem => l !== null);

  // 5. Totals (all cents)
  const subtotalCents = lineItems.reduce((s, l) => s + l.totalCents, 0);
  const totalDueCents = subtotalCents; // tax calculated externally if applicable
  const dueDate = paymentDueDate(period);

  // TTL: 7 years
  const ttl = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 7;

  const invoice: LoadoutInvoice = {
    invoiceId: `INV-${period.replace("-", "")}-${tenantId.substring(0, 8).toUpperCase()}`,
    tenantId,
    orgName: sub.orgName,
    period,
    billingEmail: sub.billingEmail,
    technicalEmail: sub.technicalEmail,
    lineItems,
    subtotalCents,
    totalDueCents,
    generatedAt: new Date().toISOString(),
    status: preview ? "preview" : "generated",
    dueDate,
    ttl,
  };

  if (preview) return invoice;

  // 6. Persist invoice (idempotency guard: attribute_not_exists(pk))
  await persistInvoice(invoice);

  // 7. Send email
  await sendInvoiceEmail(invoice);

  // 8. Reset usage counters for new period
  await resetUsageCounters(tenantId, sub.activeFeatures);

  // 9. Emit CloudWatch revenue metric (value in cents)
  await emitRevenueMetric(totalDueCents, sub.tier);

  console.log(
    JSON.stringify({
      event: "invoice_complete",
      tenantId,
      period,
      invoiceId: invoice.invoiceId,
      totalDueCents,
      lineCount: lineItems.length,
    }),
  );

  return { ...invoice, status: "sent" };
};

// ── DB ────────────────────────────────────────────────────────────────────────

async function getSubscription(tenantId: string) {
  const result = await db.send(
    new GetItemCommand({
      TableName: SUBS_TABLE,
      Key: { pk: { S: `SUB#${tenantId}` }, sk: { S: "SUBSCRIPTION" } },
    }),
  );
  const item = result.Item;
  if (!item) return null;
  return {
    tenantId,
    orgName: item.orgName?.S ?? "",
    activeFeatures: item.activeFeatures?.SS ?? [],
    tier: item.tier?.S ?? "small",
    billingEmail: item.billingEmail?.S ?? "",
    technicalEmail: item.technicalEmail?.S ?? "",
    billingCycleDay: Number(item.billingCycleDay?.N ?? 1),
  };
}

async function getUsageForPeriod(
  tenantId: string,
  period: string,
): Promise<Record<string, number>> {
  const result = await db.send(
    new QueryCommand({
      TableName: USAGE_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": { S: `USAGE#${tenantId}#${period}` },
      },
    }),
  );
  const map: Record<string, number> = {};
  for (const item of result.Items ?? []) {
    const featureId = item.sk?.S?.replace("FEATURE#", "");
    if (featureId) map[featureId] = Number(item.callCount?.N ?? 0);
  }
  return map;
}

async function getExistingInvoice(
  tenantId: string,
  period: string,
): Promise<LoadoutInvoice | null> {
  const result = await db.send(
    new GetItemCommand({
      TableName: INVOICES_TABLE,
      Key: {
        pk: { S: `INV#${tenantId}` },
        sk: { S: `PERIOD#${period}` },
      },
    }),
  );
  if (!result.Item) return null;
  try {
    return JSON.parse(result.Item.invoiceJson?.S ?? "{}") as LoadoutInvoice;
  } catch {
    return null;
  }
}

async function persistInvoice(invoice: LoadoutInvoice): Promise<void> {
  await db.send(
    new PutItemCommand({
      TableName: INVOICES_TABLE,
      Item: {
        pk: { S: `INV#${invoice.tenantId}` },
        sk: { S: `PERIOD#${invoice.period}` },
        invoiceId: { S: invoice.invoiceId },
        tenantId: { S: invoice.tenantId },
        period: { S: invoice.period },
        totalDueCents: { N: String(invoice.totalDueCents) },
        status: { S: invoice.status },
        generatedAt: { S: invoice.generatedAt },
        invoiceJson: { S: JSON.stringify(invoice) },
        ttl: { N: String(invoice.ttl) },
      },
      // Idempotency guard — skip silently if already written
      ConditionExpression: "attribute_not_exists(pk)",
    }),
  );
}

async function resetUsageCounters(
  tenantId: string,
  features: string[],
): Promise<void> {
  const month = currentMonth();
  for (const featureId of features) {
    await db.send(
      new UpdateItemCommand({
        TableName: USAGE_TABLE,
        Key: {
          pk: { S: `USAGE#${tenantId}#${month}` },
          sk: { S: `FEATURE#${featureId}` },
        },
        UpdateExpression: "SET callCount = :zero, quotaLimit = :q",
        ExpressionAttributeValues: {
          ":zero": { N: "0" },
          ":q": {
            N: String(LOADOUT_FEATURES[featureId]?.includedCalls ?? 0),
          },
        },
      }),
    );
  }
}

// ── EMAIL ─────────────────────────────────────────────────────────────────────

async function sendInvoiceEmail(invoice: LoadoutInvoice): Promise<void> {
  const html = buildInvoiceHtml(invoice);
  const text = buildInvoiceText(invoice);
  const subject = `NexCortiQ Loadout Invoice — ${formatPeriod(invoice.period)} — ${invoice.invoiceId}`;

  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: `NexCortiQ Billing <${FROM_EMAIL}>`,
      Destination: {
        ToAddresses: [invoice.billingEmail],
        CcAddresses: [invoice.technicalEmail, ADMIN_EMAIL].filter(
          (e) => e && e !== invoice.billingEmail,
        ),
      },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            Text: { Data: text, Charset: "UTF-8" },
          },
        },
      },
    }),
  );

  console.log(
    JSON.stringify({
      event: "invoice_email_sent",
      invoiceId: invoice.invoiceId,
      to: invoice.billingEmail,
      totalDueCents: invoice.totalDueCents,
    }),
  );
}

function buildInvoiceHtml(inv: LoadoutInvoice): string {
  // Convert cents → dollars for display
  const rows = inv.lineItems
    .map(
      (li) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #1A2333;font-size:13px;color:#CBD5E1">${li.featureName}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #1A2333;font-size:12px;color:#64748B;font-family:monospace">${li.callsIncluded ? `${li.callsUsed.toLocaleString()} / ${li.callsIncluded.toLocaleString()}` : "Flat rate"}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #1A2333;font-size:13px;color:#CBD5E1;font-family:monospace">${formatCentsAsUsd(li.baseCents)}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #1A2333;font-size:13px;color:${li.overageCents > 0 ? "#EF4444" : "#64748B"};font-family:monospace">${li.overageCents > 0 ? `+${formatCentsAsUsd(li.overageCents)}` : "—"}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #1A2333;font-size:13px;font-weight:600;color:#F1F5F9;font-family:monospace">${formatCentsAsUsd(li.totalCents)}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#06080E;font-family:'DM Sans',Arial,sans-serif;">
<div style="max-width:640px;margin:40px auto;background:#0B0F18;border:1px solid #1A2333;border-radius:12px;overflow:hidden;">
  <div style="background:#101622;padding:28px 32px;border-bottom:1px solid #1A2333;">
    <div style="font-size:11px;font-weight:600;color:#3B82F6;letter-spacing:0.08em;margin-bottom:8px">NEXCORTIQ LOADOUT</div>
    <div style="font-size:24px;font-weight:700;color:#F1F5F9;letter-spacing:-0.02em">Invoice ${inv.invoiceId}</div>
    <div style="font-size:13px;color:#64748B;margin-top:4px">${inv.orgName} &nbsp;·&nbsp; ${formatPeriod(inv.period)}</div>
  </div>
  <div style="padding:24px 32px;border-bottom:1px solid #1A2333;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div><div style="font-size:10px;font-weight:600;color:#64748B;letter-spacing:0.06em;margin-bottom:4px">BILLING PERIOD</div><div style="font-size:13px;color:#CBD5E1">${formatPeriod(inv.period)}</div></div>
      <div><div style="font-size:10px;font-weight:600;color:#64748B;letter-spacing:0.06em;margin-bottom:4px">DUE DATE</div><div style="font-size:13px;color:#CBD5E1">${inv.dueDate}</div></div>
      <div><div style="font-size:10px;font-weight:600;color:#64748B;letter-spacing:0.06em;margin-bottom:4px">INVOICE TO</div><div style="font-size:13px;color:#CBD5E1">${inv.orgName}</div></div>
      <div><div style="font-size:10px;font-weight:600;color:#64748B;letter-spacing:0.06em;margin-bottom:4px">GENERATED</div><div style="font-size:13px;color:#CBD5E1">${new Date(inv.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div></div>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="background:#101622;">
        <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#64748B;border-bottom:1px solid #1A2333">Feature</th>
        <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#64748B;border-bottom:1px solid #1A2333">API Calls</th>
        <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#64748B;border-bottom:1px solid #1A2333">Base</th>
        <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#64748B;border-bottom:1px solid #1A2333">Overage</th>
        <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#64748B;border-bottom:1px solid #1A2333">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="padding:20px 32px;background:#101622;border-top:1px solid #222E42;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:15px;font-weight:700;color:#CBD5E1">Total Due</div>
    <div style="font-size:28px;font-weight:700;color:#F59E0B;font-family:monospace;letter-spacing:-0.03em">${formatCentsAsUsd(inv.totalDueCents)}</div>
  </div>
  <div style="padding:20px 32px;border-top:1px solid #1A2333;">
    <div style="font-size:12px;color:#64748B;line-height:1.6">Payment due by ${inv.dueDate}. Pay by ACH, wire, or check payable to Apps on Demand LLC. Questions: <a href="mailto:billing@nexcortiq.us" style="color:#3B82F6">billing@nexcortiq.us</a></div>
    <div style="margin-top:14px"><a href="https://loadout.nexcortiq.us/invoices" style="display:inline-block;background:#3B82F6;color:white;padding:9px 20px;border-radius:7px;text-decoration:none;font-size:13px;font-weight:600">View invoice online</a></div>
  </div>
  <div style="padding:16px 32px;background:#06080E;border-top:1px solid #1A2333;font-size:11px;color:#334155;text-align:center;">
    NexCortiQ Loadout · loadout.nexcortiq.us · Apps on Demand LLC
  </div>
</div>
</body></html>`;
}

function buildInvoiceText(inv: LoadoutInvoice): string {
  const lines = inv.lineItems
    .map(
      (li) =>
        `  ${li.featureName.padEnd(32)} ${String(li.callsUsed.toLocaleString()).padStart(8)} calls   ${formatCentsAsUsd(li.baseCents).padStart(10)}   ${li.overageCents > 0 ? `+${formatCentsAsUsd(li.overageCents).padStart(9)}` : " ".repeat(10)}   ${formatCentsAsUsd(li.totalCents)}`,
    )
    .join("\n");

  return `NexCortiQ Loadout Invoice
${inv.invoiceId} · ${inv.orgName} · ${formatPeriod(inv.period)}
${"─".repeat(72)}

  Feature                          API Calls       Base        Overage       Total
  ${"─".repeat(70)}
${lines}
  ${"─".repeat(70)}
  TOTAL DUE                                                             ${formatCentsAsUsd(inv.totalDueCents)}

  Due: ${inv.dueDate}
  Pay by ACH, wire, or check to Apps on Demand LLC.
  Questions: billing@nexcortiq.us
  View online: https://loadout.nexcortiq.us/invoices
`;
}

// ── METRICS ───────────────────────────────────────────────────────────────────

async function emitRevenueMetric(
  amountCents: number,
  tier: string,
): Promise<void> {
  await cw.send(
    new PutMetricDataCommand({
      Namespace: "NexCortiQ/Loadout",
      MetricData: [
        {
          MetricName: "InvoiceRevenue",
          Value: amountCents,
          Unit: "None",
          Dimensions: [{ Name: "Tier", Value: tier }],
        },
      ],
    }),
  );
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function previousMonth(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return prev.toISOString().substring(0, 7);
}

function currentMonth(): string {
  return new Date().toISOString().substring(0, 7);
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function paymentDueDate(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const due = new Date(year, month, 30); // Net-30 from period end
  return due.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
