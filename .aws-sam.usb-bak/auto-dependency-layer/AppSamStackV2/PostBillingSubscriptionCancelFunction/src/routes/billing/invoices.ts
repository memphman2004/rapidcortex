import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  createBillingInvoiceBodySchema,
  isRcsuperadmin,
  patchBillingInvoiceBodySchema,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { z } from "zod";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  generateInvoicePdfBuffer,
  loadPaymentInstructions,
  uploadInvoicePdfToS3,
} from "../../lib/billing/invoicePdfGenerator.js";
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
const s3 = new S3Client({ region: env.region });
const invoiceIdSchema = z.string().min(1).max(120);
const markPaidSchema = z
  .object({
    amountPaid: z.number().positive().optional(),
    paymentMethod: z.string().min(1).max(120).optional(),
    paidDate: z.string().min(1).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "VOID" | "CANCELED";

function nowIso(): string {
  return new Date().toISOString();
}

function invoicesTail(rawPath: string): string[] {
  const clean = rawPath.split("?")[0] ?? "";
  const parts = clean.split("/").filter(Boolean);
  const idx = parts.findIndex((p, i) => p === "billing" && parts[i + 1] === "invoices");
  if (idx < 0) return [];
  return parts.slice(idx + 2);
}

function getAgencyScope(user: UserContext, queryAgencyId?: string): string | null {
  if (isRcsuperadmin(user)) return (queryAgencyId ?? user.agencyId ?? "").trim() || null;
  return user.agencyId;
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
    invoiceId: entityType === "invoice" ? resourceId : undefined,
  });
}

function computeTotals(input: {
  lineItems: Array<{ quantity: number; unitPrice: number }>;
  discount?: number;
  tax?: number;
}) {
  const subtotal = Number(
    input.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2),
  );
  const discount = Number((input.discount ?? 0).toFixed(2));
  const tax = Number((input.tax ?? 0).toFixed(2));
  const total = Number(Math.max(0, subtotal - discount + tax).toFixed(2));
  return { subtotal, discount, tax, total };
}

function assertTransition(current: InvoiceStatus, next: InvoiceStatus): void {
  const allowed: Record<InvoiceStatus, InvoiceStatus[]> = {
    DRAFT: ["SENT", "CANCELED", "VOID"],
    SENT: ["PAID", "VOID"],
    PAID: [],
    VOID: [],
    CANCELED: [],
  };
  if (!allowed[current].includes(next)) {
    const err = new Error(`Invalid status transition: ${current} -> ${next}`);
    (err as Error & { code?: string }).code = "INVALID_TRANSITION";
    throw err;
  }
}

function monthPrefix(dateIso: string): string {
  const d = new Date(dateIso);
  const yyyy = d.getUTCFullYear();
  const mm = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  return `${yyyy}-${mm}`;
}

async function nextInvoiceNumber(agencyId: string, invoiceDate: string): Promise<string> {
  const prefix = monthPrefix(invoiceDate);
  const out = await ddb.send(
    new ScanCommand({
      TableName: env.invoicesTable,
      FilterExpression: "agencyId = :agencyId",
      ExpressionAttributeValues: { ":agencyId": agencyId },
    }),
  );
  const items = (out.Items ?? []) as Array<{ invoiceNumber?: string }>;
  const max = items.reduce((m, row) => {
    const num = row.invoiceNumber ?? "";
    const match = num.match(/^RC-(\d{4}-\d{2})-(\d{4})$/);
    if (!match || match[1] !== prefix) return m;
    return Math.max(m, Number.parseInt(match[2] ?? "0", 10));
  }, 0);
  return `RC-${prefix}-${`${max + 1}`.padStart(4, "0")}`;
}

async function loadInvoiceScoped(invoiceId: string, agencyId: string) {
  const out = await ddb.send(
    new GetCommand({
      TableName: env.invoicesTable,
      Key: { invoiceId },
    }),
  );
  const item = out.Item as (Record<string, unknown> & { status?: InvoiceStatus }) | undefined;
  if (!item || item.agencyId !== agencyId) return null;
  return item;
}

async function invoiceItems(invoiceId: string, agencyId: string) {
  const out = await ddb.send(
    new QueryCommand({
      TableName: env.invoiceItemsTable,
      IndexName: "invoiceId-index",
      KeyConditionExpression: "invoiceId = :invoiceId",
      ExpressionAttributeValues: { ":invoiceId": invoiceId },
    }),
  );
  return (out.Items ?? []).filter((x) => (x as { agencyId?: string }).agencyId === agencyId);
}

export async function handleBillingInvoicesRoute(event: {
  rawPath?: string;
  body?: string | null;
  queryStringParameters?: Record<string, string | undefined>;
  requestContext: { http: { method: string } };
  isBase64Encoded?: boolean;
}, user: UserContext) {
  try {
    const method = event.requestContext.http.method;
    const tail = invoicesTail(event.rawPath ?? "");
    const invoiceId = tail[0];
    const action = tail[1];
    const scopeAgencyId = getAgencyScope(user, event.queryStringParameters?.agencyId);
    if (!scopeAgencyId) return badRequest("agencyId query required when acting as RC Super Admin (rcsuperadmin)");

    if (tail.length === 0 && method === "POST") {
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = createBillingInvoiceBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const payload = parsed.data;

      const customer = await ddb.send(
        new GetCommand({
          TableName: env.customersTable,
          Key: { customerId: payload.customerId },
        }),
      );
      const customerItem = customer.Item as { agencyId?: string; requiresPO?: boolean } | undefined;
      if (!customerItem || customerItem.agencyId !== scopeAgencyId) return badRequest("Customer not found");
      if (customerItem.requiresPO && !payload.poNumber) {
        return badRequest("PO number is required for this customer");
      }

      const t = nowIso();
      const invoiceIdValue = makeId("inv");
      const invoiceNumber = await nextInvoiceNumber(scopeAgencyId, payload.invoiceDate);
      const totals = computeTotals(payload);
      const invoiceRow = {
        invoiceId: invoiceIdValue,
        agencyId: scopeAgencyId,
        customerId: payload.customerId,
        invoiceNumber,
        status: "DRAFT" as InvoiceStatus,
        ...totals,
        currency: payload.currency,
        invoiceDate: payload.invoiceDate,
        dueDate: payload.dueDate,
        poNumber: payload.poNumber,
        notes: payload.notes,
        createdBy: user.userId,
        createdAt: t,
        updatedAt: t,
      };
      await ddb.send(new PutCommand({ TableName: env.invoicesTable, Item: invoiceRow }));
      for (const [i, li] of payload.lineItems.entries()) {
        await ddb.send(
          new PutCommand({
            TableName: env.invoiceItemsTable,
            Item: {
              invoiceItemId: makeId("invitem"),
              invoiceId: invoiceIdValue,
              agencyId: scopeAgencyId,
              serviceId: li.serviceId,
              serviceName: li.serviceName,
              description: li.description,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              lineTotal: Number((li.quantity * li.unitPrice).toFixed(2)),
              sortOrder: li.sortOrder ?? i,
              createdAt: t,
            },
          }),
        );
      }
      await createAudit(user, scopeAgencyId, "invoice_created", "invoice", invoiceIdValue, {
        action: "invoice_created",
        status: "DRAFT",
        invoiceNumber,
      });
      return ok(invoiceRow, 201);
    }

    if (tail.length === 0 && method === "GET") {
      const qs = event.queryStringParameters ?? {};
      const out = await ddb.send(
        new ScanCommand({
          TableName: env.invoicesTable,
          FilterExpression: "agencyId = :agencyId",
          ExpressionAttributeValues: { ":agencyId": scopeAgencyId },
        }),
      );
      let items = (out.Items ?? []) as Array<Record<string, unknown>>;
      const status = (qs.status ?? "").trim().toUpperCase();
      const customerIdFilter = (qs.customer ?? "").trim();
      const dateFrom = (qs.dateFrom ?? "").trim();
      const dateTo = (qs.dateTo ?? "").trim();
      if (status) items = items.filter((x) => String(x.status ?? "") === status);
      if (customerIdFilter) items = items.filter((x) => String(x.customerId ?? "") === customerIdFilter);
      if (dateFrom) items = items.filter((x) => String(x.invoiceDate ?? "") >= dateFrom);
      if (dateTo) items = items.filter((x) => String(x.invoiceDate ?? "") <= dateTo);
      items.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
      return ok({ items });
    }

    if (!invoiceId) return notFound();
    const parsedInvoiceId = invoiceIdSchema.safeParse(invoiceId);
    if (!parsedInvoiceId.success) return badRequestFromZod(parsedInvoiceId.error);

    if (tail.length === 1 && method === "GET") {
      const invoice = await loadInvoiceScoped(invoiceId, scopeAgencyId);
      if (!invoice) return notFound("Invoice not found");
      const items = await invoiceItems(invoiceId, scopeAgencyId);
      return ok({ ...invoice, lineItems: items });
    }

    if (tail.length === 1 && method === "PATCH") {
      const existing = await loadInvoiceScoped(invoiceId, scopeAgencyId);
      if (!existing) return notFound("Invoice not found");
      if (existing.status !== "DRAFT") return badRequest("Only draft invoices can be updated");
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = patchBillingInvoiceBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      if (Object.keys(parsed.data).length === 0) return badRequest("No fields to update");

      const nextLineItems = parsed.data.lineItems;
      const totals = nextLineItems
        ? computeTotals({
            lineItems: nextLineItems,
            discount: parsed.data.discount ?? Number(existing.discount ?? 0),
            tax: parsed.data.tax ?? Number(existing.tax ?? 0),
          })
        : computeTotals({
            lineItems: (await invoiceItems(invoiceId, scopeAgencyId)).map((x) => ({
              quantity: Number((x as { quantity?: number }).quantity ?? 0),
              unitPrice: Number((x as { unitPrice?: number }).unitPrice ?? 0),
            })),
            discount: parsed.data.discount ?? Number(existing.discount ?? 0),
            tax: parsed.data.tax ?? Number(existing.tax ?? 0),
          });

      const names: Record<string, string> = {
        "#updatedAt": "updatedAt",
        "#subtotal": "subtotal",
        "#discount": "discount",
        "#tax": "tax",
        "#total": "total",
      };
      const values: Record<string, unknown> = {
        ":updatedAt": nowIso(),
        ":subtotal": totals.subtotal,
        ":discount": totals.discount,
        ":tax": totals.tax,
        ":total": totals.total,
      };
      const setParts = [
        "#updatedAt = :updatedAt",
        "#subtotal = :subtotal",
        "#discount = :discount",
        "#tax = :tax",
        "#total = :total",
      ];
      for (const [k, v] of Object.entries(parsed.data)) {
        if (k === "lineItems") continue;
        const nk = `#${k}`;
        const vk = `:${k}`;
        names[nk] = k;
        values[vk] = v;
        setParts.push(`${nk} = ${vk}`);
      }
      const updated = await ddb.send(
        new UpdateCommand({
          TableName: env.invoicesTable,
          Key: { invoiceId },
          UpdateExpression: `SET ${setParts.join(", ")}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
        }),
      );
      if (nextLineItems) {
        for (const [i, li] of nextLineItems.entries()) {
          await ddb.send(
            new PutCommand({
              TableName: env.invoiceItemsTable,
              Item: {
                invoiceItemId: makeId("invitem"),
                invoiceId,
                agencyId: scopeAgencyId,
                serviceId: li.serviceId,
                serviceName: li.serviceName,
                description: li.description,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
                lineTotal: Number((li.quantity * li.unitPrice).toFixed(2)),
                sortOrder: li.sortOrder ?? i,
                createdAt: nowIso(),
              },
            }),
          );
        }
      }
      await createAudit(user, scopeAgencyId, "invoice_updated", "invoice", invoiceId, { action: "invoice_updated" });
      return ok(updated.Attributes ?? {});
    }

    if (tail.length === 1 && method === "DELETE") {
      const existing = await loadInvoiceScoped(invoiceId, scopeAgencyId);
      if (!existing) return notFound("Invoice not found");
      if (existing.status !== "DRAFT") return badRequest("Only draft invoices can be canceled");
      assertTransition("DRAFT", "CANCELED");
      const updatedAt = nowIso();
      await ddb.send(
        new UpdateCommand({
          TableName: env.invoicesTable,
          Key: { invoiceId },
          UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": "CANCELED",
            ":updatedAt": updatedAt,
          },
        }),
      );
      await createAudit(user, scopeAgencyId, "invoice_deleted", "invoice", invoiceId, { action: "invoice_canceled" });
      return ok({ invoiceId, status: "CANCELED" });
    }

    if (action === "send" && method === "POST") {
      const existing = await loadInvoiceScoped(invoiceId, scopeAgencyId);
      if (!existing) return notFound("Invoice not found");
      assertTransition((existing.status ?? "DRAFT") as InvoiceStatus, "SENT");
      const customer = await ddb.send(
        new GetCommand({ TableName: env.customersTable, Key: { customerId: existing.customerId } }),
      );
      const email = (customer.Item as { email?: string } | undefined)?.email ?? null;
      const emailedAt = nowIso();
      await ddb.send(
        new UpdateCommand({
          TableName: env.invoicesTable,
          Key: { invoiceId },
          UpdateExpression: "SET #status = :status, emailedTo = :emailedTo, emailedAt = :emailedAt, updatedAt = :updatedAt",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": "SENT",
            ":emailedTo": email,
            ":emailedAt": emailedAt,
            ":updatedAt": emailedAt,
          },
        }),
      );
      await createAudit(user, scopeAgencyId, "invoice_sent", "invoice", invoiceId, { action: "invoice_sent", emailedTo: email });
      return ok({ invoiceId, status: "SENT", emailedTo: email });
    }

    if (action === "mark-paid" && method === "POST") {
      const existing = await loadInvoiceScoped(invoiceId, scopeAgencyId);
      if (!existing) return notFound("Invoice not found");
      assertTransition((existing.status ?? "DRAFT") as InvoiceStatus, "PAID");
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = markPaidSchema.safeParse(JSON.parse(bodyRaw));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const paidAt = parsed.data.paidDate ?? nowIso();
      await ddb.send(
        new UpdateCommand({
          TableName: env.invoicesTable,
          Key: { invoiceId },
          UpdateExpression:
            "SET #status = :status, paidDate = :paidDate, amountPaid = :amountPaid, paymentMethod = :paymentMethod, paymentNotes = :paymentNotes, updatedAt = :updatedAt",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": "PAID",
            ":paidDate": paidAt,
            ":amountPaid": parsed.data.amountPaid ?? Number(existing.total ?? 0),
            ":paymentMethod": parsed.data.paymentMethod ?? "manual",
            ":paymentNotes": parsed.data.notes,
            ":updatedAt": paidAt,
          },
        }),
      );
      await createAudit(user, scopeAgencyId, "invoice_paid", "invoice", invoiceId, { action: "invoice_paid" });
      return ok({ invoiceId, status: "PAID", paidDate: paidAt });
    }

    if (action === "void" && method === "POST") {
      const existing = await loadInvoiceScoped(invoiceId, scopeAgencyId);
      if (!existing) return notFound("Invoice not found");
      assertTransition((existing.status ?? "DRAFT") as InvoiceStatus, "VOID");
      const t = nowIso();
      await ddb.send(
        new UpdateCommand({
          TableName: env.invoicesTable,
          Key: { invoiceId },
          UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": "VOID",
            ":updatedAt": t,
          },
        }),
      );
      await createAudit(user, scopeAgencyId, "invoice_voided", "invoice", invoiceId, { action: "invoice_voided" });
      return ok({ invoiceId, status: "VOID" });
    }

    if (action === "pdf" && method === "GET") {
      const existing = await loadInvoiceScoped(invoiceId, scopeAgencyId);
      if (!existing) return notFound("Invoice not found");
      const key = String(existing.pdfS3Key ?? "");
      if (!key) return notFound("Invoice PDF not generated");
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: env.billingInvoicesBucket,
          Key: key,
        }),
        { expiresIn: 300 },
      );
      return ok({ invoiceId, pdfUrl: url, expiresInSeconds: 300 });
    }

    if (action === "regenerate-pdf" && method === "POST") {
      const existing = await loadInvoiceScoped(invoiceId, scopeAgencyId);
      if (!existing) return notFound("Invoice not found");
      const customer = await ddb.send(
        new GetCommand({
          TableName: env.customersTable,
          Key: { customerId: existing.customerId },
        }),
      );
      const customerItem = (customer.Item ?? {}) as {
        agencyName?: string;
        billingContact?: string;
        email?: string;
        address?: string;
        paymentTerms?: string;
      };
      const lineItemsRaw = (await invoiceItems(invoiceId, scopeAgencyId)) as Array<{
        serviceName?: string;
        description?: string;
        quantity?: number;
        unitPrice?: number;
        lineTotal?: number;
      }>;
      const pdf = await generateInvoicePdfBuffer(
        {
          invoiceId,
          invoiceNumber: String(existing.invoiceNumber ?? invoiceId),
          invoiceDate: String(existing.invoiceDate ?? ""),
          dueDate: String(existing.dueDate ?? ""),
          customerName: customerItem.agencyName ?? "Customer",
          billingContactName: customerItem.billingContact,
          billingContactEmail: customerItem.email,
          billingAddress: customerItem.address ? { street: customerItem.address } : undefined,
          poNumber: (existing.poNumber as string | undefined) ?? undefined,
          subtotal: Number(existing.subtotal ?? 0),
          discount: Number(existing.discount ?? 0),
          tax: Number(existing.tax ?? 0),
          total: Number(existing.total ?? 0),
          currency: String(existing.currency ?? "USD"),
          paymentTerms: customerItem.paymentTerms,
        },
        lineItemsRaw.map((li) => ({
          serviceName: li.serviceName ?? "Service",
          description: li.description,
          quantity: Number(li.quantity ?? 0),
          unitPrice: Number(li.unitPrice ?? 0),
          lineTotal: Number(li.lineTotal ?? 0),
        })),
        await loadPaymentInstructions(),
      );
      const key = await uploadInvoicePdfToS3(pdf, invoiceId, scopeAgencyId);
      await ddb.send(
        new UpdateCommand({
          TableName: env.invoicesTable,
          Key: { invoiceId },
          UpdateExpression: "SET pdfS3Key = :pdfS3Key, updatedAt = :updatedAt",
          ExpressionAttributeValues: {
            ":pdfS3Key": key,
            ":updatedAt": nowIso(),
          },
        }),
      );
      await createAudit(user, scopeAgencyId, "invoice_pdf_regenerated", "invoice", invoiceId, {
        action: "invoice_pdf_regenerated",
        pdfS3Key: key,
      });
      return ok({ invoiceId, pdfS3Key: key });
    }

    return jsonStatus({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof SyntaxError) return badRequest("Invalid JSON body");
    if ((error as Error & { code?: string }).code === "INVALID_TRANSITION") {
      return badRequest((error as Error).message);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
}
