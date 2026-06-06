import { SESClient, SendTemplatedEmailCommand } from "@aws-sdk/client-ses";
import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createPaymentRecordBodySchema, isRcsuperadmin, type UserContext } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { z } from "zod";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  jsonStatus,
  notFound,
  ok,
  serverError,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { ddb } from "../../repositories/baseRepository.js";
import { BillingAuditService } from "../../services/billingAuditService.js";

const auditRepo = new AuditRepository();
const billingAuditService = new BillingAuditService();
const ses = new SESClient({ region: env.region });
const paymentIdSchema = z.string().min(1).max(120);
const invoiceIdSchema = z.string().min(1).max(120);

function nowIso(): string {
  return new Date().toISOString();
}

function getAgencyScope(user: UserContext, queryAgencyId?: string): string | null {
  if (isRcsuperadmin(user)) return (queryAgencyId ?? user.agencyId ?? "").trim() || null;
  return user.agencyId;
}

function paymentsTail(rawPath: string): string[] {
  const clean = rawPath.split("?")[0] ?? "";
  const parts = clean.split("/").filter(Boolean);
  const idx = parts.findIndex((p, i) => p === "billing" && parts[i + 1] === "payments");
  if (idx < 0) return [];
  return parts.slice(idx + 2);
}

function invoicePaymentsPath(rawPath: string): { invoiceId: string } | null {
  const clean = rawPath.split("?")[0] ?? "";
  const parts = clean.split("/").filter(Boolean);
  const idx = parts.findIndex((p, i) => p === "billing" && parts[i + 1] === "invoices");
  if (idx < 0) return null;
  const invoiceId = parts[idx + 2];
  const last = parts[idx + 3];
  if (!invoiceId || last !== "payments") return null;
  return { invoiceId };
}

async function createAudit(
  user: UserContext,
  agencyId: string,
  action: string,
  entityType: string,
  resourceId: string,
  details: Record<string, unknown>,
): Promise<void> {
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId: user.userId,
    type: AUDIT_EVENT_TYPES.BILLING_PROFILE_UPDATED,
    resourceType: "billing",
    resourceId,
    details,
    createdAt: nowIso(),
  });
  await billingAuditService.logBillingAction(action, entityType, resourceId, user.userId, {
    agencyId,
    ...details,
  });
}

async function sendPaymentConfirmationEmail(input: {
  to?: string;
  customerName: string;
  invoiceNumber: string;
  currency: string;
  amountPaid: number;
  paymentDate: string;
}) {
  if (!input.to || !env.billingSesSenderEmail) return;
  await ses.send(
    new SendTemplatedEmailCommand({
      Source: env.billingSesSenderEmail,
      Destination: { ToAddresses: [input.to] },
      Template: "payment-received-confirmation",
      TemplateData: JSON.stringify({
        customerName: input.customerName,
        invoiceNumber: input.invoiceNumber,
        currency: input.currency,
        amountPaid: input.amountPaid.toFixed(2),
        paymentDate: input.paymentDate,
      }),
    }),
  );
}

export async function handleBillingPaymentsRoute(event: {
  rawPath?: string;
  body?: string | null;
  queryStringParameters?: Record<string, string | undefined>;
  requestContext: { http: { method: string } };
  isBase64Encoded?: boolean;
}, user: UserContext) {
  try {
    const method = event.requestContext.http.method;
    const scopeAgencyId = getAgencyScope(user, event.queryStringParameters?.agencyId);
    if (!scopeAgencyId) return badRequest("agencyId query required when acting as RC Super Admin (rcsuperadmin)");

    const invoicePayments = invoicePaymentsPath(event.rawPath ?? "");
    if (invoicePayments && method === "GET") {
      const invoiceIdParsed = invoiceIdSchema.safeParse(invoicePayments.invoiceId);
      if (!invoiceIdParsed.success) return badRequestFromZod(invoiceIdParsed.error);
      const invoiceOut = await ddb.send(
        new GetCommand({
          TableName: env.invoicesTable,
          Key: { invoiceId: invoicePayments.invoiceId },
        }),
      );
      const invoice = invoiceOut.Item as { agencyId?: string } | undefined;
      if (!invoice || invoice.agencyId !== scopeAgencyId) return notFound("Invoice not found");
      const out = await ddb.send(
        new QueryCommand({
          TableName: env.paymentRecordsTable,
          IndexName: "invoiceId-index",
          KeyConditionExpression: "invoiceId = :invoiceId",
          ExpressionAttributeValues: { ":invoiceId": invoicePayments.invoiceId },
        }),
      );
      const items = (out.Items ?? []).filter((x) => (x as { agencyId?: string }).agencyId === scopeAgencyId);
      return ok({ items });
    }

    const tail = paymentsTail(event.rawPath ?? "");
    const paymentId = tail[0];

    if (tail.length === 0 && method === "POST") {
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = createPaymentRecordBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsed.success) return badRequestFromZod(parsed.error);

      const invoiceOut = await ddb.send(
        new GetCommand({
          TableName: env.invoicesTable,
          Key: { invoiceId: parsed.data.invoiceId },
        }),
      );
      const invoice = invoiceOut.Item as
        | {
            invoiceId: string;
            agencyId?: string;
            customerId?: string;
            invoiceNumber?: string;
            total?: number;
            amountPaid?: number;
            currency?: string;
            status?: string;
          }
        | undefined;
      if (!invoice || invoice.agencyId !== scopeAgencyId) return notFound("Invoice not found");

      const currentPaid = Number(invoice.amountPaid ?? 0);
      const invoiceTotal = Number(invoice.total ?? 0);
      const nextPaid = Number((currentPaid + parsed.data.amount).toFixed(2));
      if (nextPaid - invoiceTotal > 0.01) {
        return badRequest("Payment amount exceeds invoice total");
      }

      const t = nowIso();
      const paymentIdValue = makeId("pay");
      const payment = {
        paymentId: paymentIdValue,
        agencyId: scopeAgencyId,
        invoiceId: parsed.data.invoiceId,
        customerId: invoice.customerId,
        amount: Number(parsed.data.amount.toFixed(2)),
        currency: parsed.data.currency.toUpperCase(),
        paymentDate: parsed.data.paymentDate ?? t,
        method: parsed.data.method,
        reference: parsed.data.reference,
        notes: parsed.data.notes,
        recordedBy: user.userId,
        createdAt: t,
      };
      await ddb.send(
        new PutCommand({
          TableName: env.paymentRecordsTable,
          Item: payment,
          ConditionExpression: "attribute_not_exists(paymentId)",
        }),
      );

      const isFullyPaid = Math.abs(nextPaid - invoiceTotal) <= 0.01;
      const nextStatus = isFullyPaid ? "PAID" : String(invoice.status ?? "SENT");
      await ddb.send(
        new UpdateCommand({
          TableName: env.invoicesTable,
          Key: { invoiceId: parsed.data.invoiceId },
          UpdateExpression:
            "SET amountPaid = :amountPaid, balanceDue = :balanceDue, paymentStatus = :paymentStatus, #status = :status, updatedAt = :updatedAt, paidDate = :paidDate",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":amountPaid": nextPaid,
            ":balanceDue": Number(Math.max(0, invoiceTotal - nextPaid).toFixed(2)),
            ":paymentStatus": isFullyPaid ? "FULL" : "PARTIAL",
            ":status": nextStatus,
            ":updatedAt": t,
            ":paidDate": isFullyPaid ? (parsed.data.paymentDate ?? t) : null,
          },
        }),
      );

      const customerOut = await ddb.send(
        new GetCommand({
          TableName: env.customersTable,
          Key: { customerId: invoice.customerId },
        }),
      );
      const customer = customerOut.Item as { agencyId?: string; email?: string; agencyName?: string } | undefined;
      if (customer && customer.agencyId === scopeAgencyId) {
        await sendPaymentConfirmationEmail({
          to: customer.email,
          customerName: customer.agencyName ?? "Customer",
          invoiceNumber: String(invoice.invoiceNumber ?? parsed.data.invoiceId),
          currency: payment.currency,
          amountPaid: payment.amount,
          paymentDate: payment.paymentDate,
        });
      }

      await createAudit(user, scopeAgencyId, "payment_recorded", "payment", paymentIdValue, {
        action: "payment_recorded",
        invoiceId: parsed.data.invoiceId,
        amount: payment.amount,
        paymentStatus: isFullyPaid ? "FULL" : "PARTIAL",
      });
      return ok({ ...payment, invoiceStatus: nextStatus }, 201);
    }

    if (tail.length === 0 && method === "GET") {
      const out = await ddb.send(
        new ScanCommand({
          TableName: env.paymentRecordsTable,
          FilterExpression: "agencyId = :agencyId",
          ExpressionAttributeValues: { ":agencyId": scopeAgencyId },
        }),
      );
      const items = (out.Items ?? []).sort((a, b) =>
        String((b as { createdAt?: string }).createdAt ?? "").localeCompare(
          String((a as { createdAt?: string }).createdAt ?? ""),
        ),
      );
      return ok({ items });
    }

    if (!paymentId) return notFound();
    const paymentIdParsed = paymentIdSchema.safeParse(paymentId);
    if (!paymentIdParsed.success) return badRequestFromZod(paymentIdParsed.error);

    if (tail.length === 1 && method === "GET") {
      const out = await ddb.send(
        new GetCommand({
          TableName: env.paymentRecordsTable,
          Key: { paymentId },
        }),
      );
      const item = out.Item as { agencyId?: string } | undefined;
      if (!item || item.agencyId !== scopeAgencyId) return notFound("Payment not found");
      return ok(item);
    }

    return jsonStatus({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof SyntaxError) return badRequest("Invalid JSON body");
    if (error instanceof z.ZodError) return badRequestFromZod(error);
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
}
