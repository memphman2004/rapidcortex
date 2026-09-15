import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { GetCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import {
  AUTOMATED_INVOICE_STATUS_TRANSITIONS,
  canAccessRcFinancePortal,
  emptyUsageSnapshot,
  invoicePreviewBodySchema,
  listAutomatedInvoicesQuerySchema,
  patchAutomatedInvoiceBodySchema,
  parseBillingPeriod,
  previewInvoice,
  type AgencyBillingConfig,
  type AutomatedInvoice,
  type AutomatedInvoiceStatus,
  type MonthlyUsageSnapshot,
  type UserContext,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  authFailure,
  badRequest,
  badRequestFromZod,
  forbidden,
  jsonStatus,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { ddb } from "../../repositories/baseRepository.js";
import { writeAutomatedBillingAudit } from "./audit.js";
import { sendAutomatedInvoiceEmail } from "./invoice-emailer.js";
import { agencyBillingConfigsTable, automatedInvoicesTable, usageSnapshotsTable } from "./tables.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "authorization,content-type",
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method;
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS };
  }

  if (!env.enableAutomatedInvoices) {
    return withCorrelationHeaders(event, serviceUnavailable("Automated invoices are disabled"));
  }

  const user = await getUserContext(event);
  if (!user) return withCorrelationHeaders(event, authFailure(event));
  if (!isUserAccountActive(user)) return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
  const pwd = operationalPasswordBlock(user);
  if (pwd) return withCorrelationHeaders(event, pwd);

  const path = event.rawPath ?? "";
  try {
    if (path.endsWith("/automated-config") && method === "GET") {
      return withCorrelationHeaders(event, await getConfig(user, event.queryStringParameters ?? {}));
    }
    if (path.endsWith("/preview") && method === "POST") {
      return withCorrelationHeaders(event, await preview(user, event.body));
    }
    const resend = path.match(/\/automated-invoices\/([^/]+)\/resend$/);
    if (resend && method === "POST") {
      return withCorrelationHeaders(event, await resendInvoice(user, decodeURIComponent(resend[1])));
    }
    const detail = path.match(/\/automated-invoices\/([^/]+)$/);
    if (detail && method === "GET") {
      return withCorrelationHeaders(event, await getInvoice(user, decodeURIComponent(detail[1])));
    }
    if (detail && method === "PATCH") {
      return withCorrelationHeaders(event, await patchInvoice(user, decodeURIComponent(detail[1]), event.body));
    }
    if (path.endsWith("/automated-invoices") && method === "GET") {
      return withCorrelationHeaders(event, await listInvoices(user, event.queryStringParameters ?? {}));
    }
    return withCorrelationHeaders(event, jsonStatus({ error: "Not found" }, 404));
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        event: "AUTOMATED_INVOICE_HTTP_FAILED",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return withCorrelationHeaders(event, serverError());
  }
};

function isAgencyAdmin(user: UserContext): boolean {
  return String(user.role).trim() === "agencyadmin";
}

function canViewAgency(user: UserContext, agencyId: string): boolean {
  if (canAccessRcFinancePortal(user.role)) return true;
  return isAgencyAdmin(user) && user.agencyId === agencyId;
}

async function listInvoices(user: UserContext, query: Record<string, string | undefined>) {
  const parsed = listAutomatedInvoicesQuerySchema.safeParse({
    status: query.status,
    agencyId: query.agencyId,
    billingPeriod: query.billingPeriod,
    planId: query.planId,
    limit: query.limit,
  });
  if (!parsed.success) return badRequestFromZod(parsed.error);
  const { status, billingPeriod, planId, limit = 50 } = parsed.data;

  const requestedAgency = parsed.data.agencyId;
  if (requestedAgency && !canViewAgency(user, requestedAgency)) return forbidden();

  const scopeAgency = canAccessRcFinancePortal(user.role)
    ? requestedAgency
    : isAgencyAdmin(user)
      ? user.agencyId
      : null;
  if (!canAccessRcFinancePortal(user.role) && !isAgencyAdmin(user)) return forbidden();
  if (!scopeAgency && !canAccessRcFinancePortal(user.role)) return forbidden();

  let items: AutomatedInvoice[] = [];

  if (scopeAgency) {
    const res = await ddb.send(
      new QueryCommand({
        TableName: automatedInvoicesTable(),
        IndexName: "agencyId-billingPeriod-index",
        KeyConditionExpression: billingPeriod
          ? "agencyId = :a AND billingPeriod = :p"
          : "agencyId = :a",
        ExpressionAttributeValues: billingPeriod
          ? { ":a": scopeAgency, ":p": billingPeriod }
          : { ":a": scopeAgency },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    items = (res.Items ?? []) as AutomatedInvoice[];
  } else if (status) {
    const res = await ddb.send(
      new QueryCommand({
        TableName: automatedInvoicesTable(),
        IndexName: "status-invoiceDate-index",
        KeyConditionExpression: "#st = :st",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":st": status },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    items = (res.Items ?? []) as AutomatedInvoice[];
  } else if (billingPeriod) {
    const res = await ddb.send(
      new QueryCommand({
        TableName: automatedInvoicesTable(),
        IndexName: "billingPeriod-status-index",
        KeyConditionExpression: "billingPeriod = :p",
        ExpressionAttributeValues: { ":p": billingPeriod },
        Limit: limit,
      }),
    );
    items = (res.Items ?? []) as AutomatedInvoice[];
  } else {
    const res = await ddb.send(
      new ScanCommand({
        TableName: automatedInvoicesTable(),
        Limit: Math.min(limit, 100),
      }),
    );
    items = (res.Items ?? []) as AutomatedInvoice[];
  }

  if (status) items = items.filter((i) => i.status === status);
  if (billingPeriod) items = items.filter((i) => i.billingPeriod === billingPeriod);
  if (planId) items = items.filter((i) => i.planId === planId);

  return ok({ invoices: items.slice(0, limit) });
}

async function getInvoice(user: UserContext, invoiceId: string) {
  const invoice = await loadInvoice(invoiceId);
  if (!invoice) return notFound("Invoice not found");
  if (!canViewAgency(user, invoice.agencyId)) return forbidden();
  return ok({ invoice });
}

async function patchInvoice(user: UserContext, invoiceId: string, rawBody: string | undefined) {
  if (!canAccessRcFinancePortal(user.role)) return forbidden();
  const parsedJson = parseJson(rawBody);
  if (parsedJson.error) return badRequest(parsedJson.error);
  const parsed = patchAutomatedInvoiceBodySchema.safeParse(parsedJson.value);
  if (!parsed.success) return badRequestFromZod(parsed.error);

  const invoice = await loadInvoice(invoiceId);
  if (!invoice) return notFound("Invoice not found");

  const newStatus = parsed.data.status as AutomatedInvoiceStatus | undefined;
  if (newStatus) {
    const allowed = AUTOMATED_INVOICE_STATUS_TRANSITIONS[invoice.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return jsonStatus(
        { error: `Cannot transition from ${invoice.status} to ${newStatus}`, allowedTransitions: allowed },
        422,
      );
    }
  }

  const now = new Date().toISOString();
  const names: Record<string, string> = { "#ua": "updatedAt" };
  const values: Record<string, unknown> = { ":ua": now, ":agency": invoice.agencyId };
  const updates = ["#ua = :ua"];

  if (newStatus) {
    names["#st"] = "status";
    values[":st"] = newStatus;
    updates.push("#st = :st");
  }
  if (parsed.data.notes) {
    names["#no"] = "notes";
    values[":no"] = parsed.data.notes;
    updates.push("#no = :no");
  }
  if (newStatus === "paid") {
    names["#pa"] = "paidAt";
    names["#pb"] = "paidByUserId";
    values[":pa"] = now;
    values[":pb"] = user.userId;
    updates.push("#pa = :pa", "#pb = :pb");
  }
  if (newStatus === "voided") {
    names["#va"] = "voidedAt";
    names["#vb"] = "voidedByUserId";
    values[":va"] = now;
    values[":vb"] = user.userId;
    updates.push("#va = :va", "#vb = :vb");
    if (parsed.data.voidReason) {
      names["#vr"] = "voidReason";
      values[":vr"] = parsed.data.voidReason;
      updates.push("#vr = :vr");
    }
  }
  if (newStatus === "sent" && !invoice.emailSentAt) {
    try {
      const send = await sendAutomatedInvoiceEmail({ ...invoice, status: "sent" });
      if (send.sent) {
        names["#es"] = "emailSentAt";
        values[":es"] = now;
        updates.push("#es = :es");
      }
    } catch (err) {
      console.warn(
        JSON.stringify({
          level: "WARN",
          event: "AUTOMATED_INVOICE_SEND_ON_APPROVE_FAILED",
          invoiceId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  await ddb.send(
    new UpdateCommand({
      TableName: automatedInvoicesTable(),
      Key: { invoiceId },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(invoiceId) AND agencyId = :agency",
    }),
  );

  await writeAutomatedBillingAudit({
    agencyId: invoice.agencyId,
    actorId: user.userId,
    type: AUDIT_EVENT_TYPES.AUTOMATED_INVOICE_STATUS_CHANGED,
    invoiceId,
    details: { from: invoice.status, to: newStatus ?? invoice.status },
  });

  return ok({ invoiceId, status: newStatus ?? invoice.status, updatedAt: now });
}

async function resendInvoice(user: UserContext, invoiceId: string) {
  if (!canAccessRcFinancePortal(user.role)) return forbidden();
  const invoice = await loadInvoice(invoiceId);
  if (!invoice) return notFound("Invoice not found");
  if (invoice.status === "voided") return jsonStatus({ error: "Cannot resend a voided invoice" }, 422);

  const result = await sendAutomatedInvoiceEmail(invoice);
  const now = new Date().toISOString();
  if (result.sent) {
    await ddb.send(
      new UpdateCommand({
        TableName: automatedInvoicesTable(),
        Key: { invoiceId },
        UpdateExpression: "SET emailSentAt = :now, updatedAt = :now",
        ConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":now": now, ":a": invoice.agencyId },
      }),
    );
    await writeAutomatedBillingAudit({
      agencyId: invoice.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.AUTOMATED_INVOICE_RESENT,
      invoiceId,
    });
  }
  return ok({ invoiceId, sent: result.sent, skipped: result.skipped ?? null });
}

async function preview(user: UserContext, rawBody: string | undefined) {
  if (!canAccessRcFinancePortal(user.role)) return forbidden();
  const parsedJson = parseJson(rawBody);
  if (parsedJson.error) return badRequest(parsedJson.error);
  const parsed = invoicePreviewBodySchema.safeParse(parsedJson.value);
  if (!parsed.success) return badRequestFromZod(parsed.error);

  const configRes = await ddb.send(
    new GetCommand({
      TableName: agencyBillingConfigsTable(),
      Key: { agencyId: parsed.data.agencyId },
    }),
  );
  const config = configRes.Item as AgencyBillingConfig | undefined;
  if (!config || config.agencyId !== parsed.data.agencyId) return notFound("Billing config not found");

  const snapRes = await ddb.send(
    new GetCommand({
      TableName: usageSnapshotsTable(),
      Key: { agencyId: parsed.data.agencyId, billingPeriod: parsed.data.billingPeriod },
    }),
  );
  const baseUsage =
    (snapRes.Item as MonthlyUsageSnapshot | undefined) ??
    emptyUsageSnapshot(parsed.data.agencyId, parsed.data.billingPeriod, {
      dispatcher: config.contractedDispatcherSeats,
      admin: config.contractedAdminSeats,
    });
  const usage: MonthlyUsageSnapshot = { ...baseUsage, ...parsed.data.usageOverride, agencyId: parsed.data.agencyId, billingPeriod: parsed.data.billingPeriod };

  const result = previewInvoice(config, usage, parseBillingPeriod(parsed.data.billingPeriod));
  return ok(result);
}

async function getConfig(user: UserContext, query: Record<string, string | undefined>) {
  const agencyId = canAccessRcFinancePortal(user.role) ? (query.agencyId || user.agencyId) : user.agencyId;
  if (!canViewAgency(user, agencyId)) return forbidden();
  if (!canAccessRcFinancePortal(user.role) && !isAgencyAdmin(user)) return forbidden();

  const res = await ddb.send(
    new GetCommand({
      TableName: agencyBillingConfigsTable(),
      Key: { agencyId },
    }),
  );
  const config = res.Item as AgencyBillingConfig | undefined;
  if (!config || config.agencyId !== agencyId) return notFound("Billing config not found");
  return ok({ config });
}

async function loadInvoice(invoiceId: string): Promise<AutomatedInvoice | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: automatedInvoicesTable(),
      Key: { invoiceId },
    }),
  );
  const invoice = res.Item as AutomatedInvoice | undefined;
  return invoice?.invoiceId === invoiceId ? invoice : null;
}

function parseJson(raw: string | undefined): { value?: unknown; error?: string } {
  if (!raw) return { value: {} };
  try {
    return { value: JSON.parse(raw) as unknown };
  } catch {
    return { error: "Invalid JSON" };
  }
}
