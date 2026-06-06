import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  addInvoiceItemBodySchema,
  isRcsuperadmin,
  patchInvoiceItemBodySchema,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { z } from "zod";
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
import { env } from "../../lib/env.js";

const auditRepo = new AuditRepository();
const invoiceIdSchema = z.string().min(1).max(120);
const itemIdSchema = z.string().min(1).max(120);

function nowIso(): string {
  return new Date().toISOString();
}

function getAgencyScope(user: UserContext, queryAgencyId?: string): string | null {
  if (isRcsuperadmin(user)) return (queryAgencyId ?? user.agencyId ?? "").trim() || null;
  return user.agencyId;
}

type PathParts = { invoiceId: string; itemId?: string };
function parsePath(rawPath: string): PathParts | null {
  const clean = rawPath.split("?")[0] ?? "";
  const parts = clean.split("/").filter(Boolean);
  const idx = parts.findIndex((p, i) => p === "billing" && parts[i + 1] === "invoices");
  if (idx < 0) return null;
  const invoiceId = parts[idx + 2];
  const itemsToken = parts[idx + 3];
  if (!invoiceId || itemsToken !== "items") return null;
  return { invoiceId, itemId: parts[idx + 4] };
}

async function createAudit(
  user: UserContext,
  agencyId: string,
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
}

async function loadInvoice(invoiceId: string, agencyId: string) {
  const out = await ddb.send(
    new GetCommand({
      TableName: env.invoicesTable,
      Key: { invoiceId },
    }),
  );
  const item = out.Item as
    | {
        invoiceId: string;
        agencyId?: string;
        status?: string;
        discount?: number;
        tax?: number;
      }
    | undefined;
  if (!item || item.agencyId !== agencyId) return null;
  return item;
}

async function loadInvoiceItems(invoiceId: string, agencyId: string) {
  const out = await ddb.send(
    new QueryCommand({
      TableName: env.invoiceItemsTable,
      IndexName: "invoiceId-index",
      KeyConditionExpression: "invoiceId = :invoiceId",
      ExpressionAttributeValues: { ":invoiceId": invoiceId },
    }),
  );
  return (out.Items ?? []).filter((x) => (x as { agencyId?: string }).agencyId === agencyId) as Array<{
    invoiceItemId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

function computeLineTotal(quantity: number, unitPrice: number): number {
  return Number((quantity * unitPrice).toFixed(2));
}

function validateLineTotalAccuracy(quantity: number, unitPrice: number, provided?: number): number {
  const computed = computeLineTotal(quantity, unitPrice);
  if (provided != null && Math.abs(provided - computed) > 0.01) {
    const err = new Error("lineTotal does not match quantity * unitPrice");
    (err as Error & { code?: string }).code = "LINE_TOTAL_MISMATCH";
    throw err;
  }
  return computed;
}

async function recalcInvoiceTotals(invoiceId: string, agencyId: string): Promise<void> {
  const invoice = await loadInvoice(invoiceId, agencyId);
  if (!invoice) return;
  const items = await loadInvoiceItems(invoiceId, agencyId);
  const subtotal = Number(items.reduce((sum, item) => sum + computeLineTotal(item.quantity, item.unitPrice), 0).toFixed(2));
  const discount = Number((invoice.discount ?? 0).toFixed(2));
  const tax = Number((invoice.tax ?? 0).toFixed(2));
  const total = Number(Math.max(0, subtotal - discount + tax).toFixed(2));
  await ddb.send(
    new UpdateCommand({
      TableName: env.invoicesTable,
      Key: { invoiceId },
      UpdateExpression: "SET subtotal = :subtotal, #total = :total, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#total": "total" },
      ExpressionAttributeValues: {
        ":subtotal": subtotal,
        ":total": total,
        ":updatedAt": nowIso(),
      },
    }),
  );
}

export async function handleInvoiceItemsRoute(event: {
  rawPath?: string;
  body?: string | null;
  queryStringParameters?: Record<string, string | undefined>;
  requestContext: { http: { method: string } };
  isBase64Encoded?: boolean;
}, user: UserContext) {
  try {
    const method = event.requestContext.http.method;
    const parsedPath = parsePath(event.rawPath ?? "");
    if (!parsedPath) return jsonStatus({ error: "Not found" }, 404);
    const agencyId = getAgencyScope(user, event.queryStringParameters?.agencyId);
    if (!agencyId) return badRequest("agencyId query required when acting as RC Super Admin (rcsuperadmin)");
    const invoiceIdParsed = invoiceIdSchema.safeParse(parsedPath.invoiceId);
    if (!invoiceIdParsed.success) return badRequestFromZod(invoiceIdParsed.error);
    const invoiceId = invoiceIdParsed.data;

    const invoice = await loadInvoice(invoiceId, agencyId);
    if (!invoice) return notFound("Invoice not found");
    if (invoice.status !== "DRAFT") return badRequest("Can only modify draft invoices");

    if (!parsedPath.itemId && method === "POST") {
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsedBody = addInvoiceItemBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsedBody.success) return badRequestFromZod(parsedBody.error);
      const lineTotal = validateLineTotalAccuracy(
        parsedBody.data.quantity,
        parsedBody.data.unitPrice,
        parsedBody.data.lineTotal,
      );
      const item = {
        invoiceItemId: makeId("invitem"),
        invoiceId,
        agencyId,
        serviceId: parsedBody.data.serviceId,
        serviceName: parsedBody.data.serviceName,
        description: parsedBody.data.description,
        quantity: parsedBody.data.quantity,
        unitPrice: parsedBody.data.unitPrice,
        lineTotal,
        sortOrder: parsedBody.data.sortOrder ?? 0,
        createdAt: nowIso(),
      };
      await ddb.send(
        new PutCommand({
          TableName: env.invoiceItemsTable,
          Item: item,
        }),
      );
      await recalcInvoiceTotals(invoiceId, agencyId);
      await createAudit(user, agencyId, invoiceId, { action: "invoice_item_added", invoiceItemId: item.invoiceItemId });
      return ok(item, 201);
    }

    if (!parsedPath.itemId) return jsonStatus({ error: "Not found" }, 404);
    const itemIdParsed = itemIdSchema.safeParse(parsedPath.itemId);
    if (!itemIdParsed.success) return badRequestFromZod(itemIdParsed.error);
    const itemId = itemIdParsed.data;

    const existingItem = await ddb.send(
      new GetCommand({
        TableName: env.invoiceItemsTable,
        Key: { invoiceItemId: itemId },
      }),
    );
    const current = existingItem.Item as
      | {
          invoiceItemId: string;
          invoiceId?: string;
          agencyId?: string;
          quantity?: number;
          unitPrice?: number;
        }
      | undefined;
    if (!current || current.invoiceId !== invoiceId || current.agencyId !== agencyId) {
      return notFound("Invoice item not found");
    }

    if (method === "PATCH") {
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsedBody = patchInvoiceItemBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsedBody.success) return badRequestFromZod(parsedBody.error);
      if (Object.keys(parsedBody.data).length === 0) return badRequest("No fields to update");

      const nextQuantity = parsedBody.data.quantity ?? current.quantity ?? 0;
      const nextUnitPrice = parsedBody.data.unitPrice ?? current.unitPrice ?? 0;
      const nextLineTotal = validateLineTotalAccuracy(nextQuantity, nextUnitPrice, parsedBody.data.lineTotal);

      const names: Record<string, string> = { "#lineTotal": "lineTotal" };
      const values: Record<string, unknown> = { ":lineTotal": nextLineTotal };
      const setParts: string[] = ["#lineTotal = :lineTotal"];

      for (const [k, v] of Object.entries(parsedBody.data)) {
        if (k === "lineTotal") continue;
        const nk = `#${k}`;
        const vk = `:${k}`;
        names[nk] = k;
        values[vk] = v;
        setParts.push(`${nk} = ${vk}`);
      }

      const updated = await ddb.send(
        new UpdateCommand({
          TableName: env.invoiceItemsTable,
          Key: { invoiceItemId: itemId },
          UpdateExpression: `SET ${setParts.join(", ")}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
        }),
      );
      await recalcInvoiceTotals(invoiceId, agencyId);
      await createAudit(user, agencyId, invoiceId, { action: "invoice_item_updated", invoiceItemId: itemId });
      return ok(updated.Attributes ?? {});
    }

    if (method === "DELETE") {
      await ddb.send(
        new DeleteCommand({
          TableName: env.invoiceItemsTable,
          Key: { invoiceItemId: itemId },
        }),
      );
      await recalcInvoiceTotals(invoiceId, agencyId);
      await createAudit(user, agencyId, invoiceId, { action: "invoice_item_removed", invoiceItemId: itemId });
      return ok({ removed: true, invoiceItemId: itemId });
    }

    return jsonStatus({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof SyntaxError) return badRequest("Invalid JSON body");
    if ((error as Error & { code?: string }).code === "LINE_TOTAL_MISMATCH") {
      return badRequest((error as Error).message);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
}
