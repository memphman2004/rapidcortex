import {
  adminInvoicesListQuerySchema,
  canAccessRcFinancePortal,
  patchAdminMonetizationInvoiceBodySchema,
  type MonetizationInvoiceRecord,
  type UserContext,
} from "rapid-cortex-shared";
import { AuthorizationService, AUDIT_EVENT_TYPES } from "rapid-cortex-security";
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
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { MonetizationInvoiceRepository } from "../../repositories/monetizationInvoiceRepository.js";

const authz = new AuthorizationService();
const agencies = new AgencyRepository();
const invoices = new MonetizationInvoiceRepository();
const auditRepo = new AuditRepository();

function assertFinanceRead(user: UserContext): void {
  if (!canAccessRcFinancePortal(user.role)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  authz.assertCanPerform(user, "billing.usage_view");
}

function assertFinanceWrite(user: UserContext): void {
  assertFinanceRead(user);
  authz.assertCanPerform(user, "billing.manage");
}

function deriveVertical(agencyId: string, raw?: string): string {
  const v = raw?.trim().toLowerCase();
  if (v === "campus" || v === "venue" || v === "hospital" || v === "core") return v;
  const token = agencyId.toLowerCase();
  if (token.includes("campus")) return "campus";
  if (token.includes("venue")) return "venue";
  if (token.includes("hospital")) return "hospital";
  return "core";
}

function computeStats(rows: MonetizationInvoiceRecord[]) {
  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  let outstandingCents = 0;
  let overdueCents = 0;
  let paidThisMonthCents = 0;

  for (const row of rows) {
    const totalCents = Math.round(Number(row.total ?? 0) * 100);
    const status = row.status.trim().toLowerCase();
    const paidAt = row.paidAt?.slice(0, 10) ?? "";
    if (status === "paid" && paidAt >= monthStart) {
      paidThisMonthCents += totalCents;
    }
    if (status !== "paid" && status !== "void" && status !== "canceled") {
      outstandingCents += totalCents;
      if (row.dueDate && new Date(row.dueDate).getTime() < now.getTime()) {
        overdueCents += totalCents;
      }
    }
  }

  return {
    totalInvoices: rows.length,
    outstandingCents,
    overdueCents,
    paidThisMonthCents,
  };
}

export async function handleAdminInvoicesRoute(
  event: {
    rawPath?: string;
    body?: string | null;
    queryStringParameters?: Record<string, string | undefined>;
    pathParameters?: Record<string, string | undefined>;
    requestContext: { http: { method: string } };
    isBase64Encoded?: boolean;
  },
  user: UserContext,
) {
  try {
    const method = event.requestContext.http.method;
    const invoiceId = event.pathParameters?.invoiceId?.trim();

    if (method === "GET" && !invoiceId) {
      assertFinanceRead(user);
      const parsed = adminInvoicesListQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!parsed.success) return badRequestFromZod(parsed.error);

      let items: MonetizationInvoiceRecord[];
      try {
        items = await invoices.listForFinanceAdmin({
          limit: parsed.data.limit,
          status: parsed.data.status,
          agencyId: parsed.data.agencyId,
          search: parsed.data.search,
          from: parsed.data.from,
          to: parsed.data.to,
        });
      } catch {
        return ok({
          items: [],
          stats: {
            totalInvoices: 0,
            outstandingCents: 0,
            overdueCents: 0,
            paidThisMonthCents: 0,
          },
          note: "MONETIZATION_INVOICES_TABLE unavailable in this environment.",
        });
      }

      if (parsed.data.vertical && parsed.data.vertical !== "all") {
        items = items.filter((row) => deriveVertical(row.agencyId) === parsed.data.vertical);
      }

      const agencyIds = [...new Set(items.map((row) => row.agencyId))];
      const agencyMeta = new Map<string, { name: string; vertical: string }>();
      await Promise.all(
        agencyIds.map(async (agencyId) => {
          const agency = await agencies.get(agencyId);
          agencyMeta.set(agencyId, {
            name: agency?.name ?? agencyId,
            vertical: deriveVertical(agencyId, (agency as { vertical?: string } | null)?.vertical),
          });
        }),
      );

      const enriched = items.map((row) => ({
        ...row,
        agencyName: agencyMeta.get(row.agencyId)?.name ?? row.agencyId,
        vertical: agencyMeta.get(row.agencyId)?.vertical ?? deriveVertical(row.agencyId),
        displayStatus:
          row.dueDate &&
          !["paid", "void", "canceled"].includes(row.status.toLowerCase()) &&
          new Date(row.dueDate).getTime() < Date.now()
            ? "overdue"
            : row.status.toLowerCase(),
      }));

      const statsSource =
        parsed.data.status === "all" && !parsed.data.search && !parsed.data.agencyId
          ? await invoices.listForFinanceAdmin({ limit: 500, status: "all" })
          : items;

      return ok({
        items: enriched,
        stats: computeStats(statsSource),
      });
    }

    if (method === "GET" && invoiceId) {
      assertFinanceRead(user);
      const row = await invoices.get(invoiceId);
      if (!row) return notFound("Invoice not found");
      const agency = await agencies.get(row.agencyId);
      return ok({
        invoice: {
          ...row,
          agencyName: agency?.name ?? row.agencyId,
          vertical: deriveVertical(row.agencyId, (agency as { vertical?: string } | null)?.vertical),
        },
      });
    }

    if (method === "PATCH" && invoiceId) {
      assertFinanceWrite(user);
      const existing = await invoices.get(invoiceId);
      if (!existing) return notFound("Invoice not found");

      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = patchAdminMonetizationInvoiceBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      if (Object.keys(parsed.data).length === 0) return badRequest("No fields to update");

      const patch: Partial<MonetizationInvoiceRecord> = {};
      if (parsed.data.status) patch.status = parsed.data.status;
      if (parsed.data.purchaseOrderNumber !== undefined) {
        patch.purchaseOrderNumber = parsed.data.purchaseOrderNumber;
      }
      if (parsed.data.dueDate !== undefined) patch.dueDate = parsed.data.dueDate;
      if (parsed.data.status === "paid") patch.paidAt = new Date().toISOString();

      const updated = await invoices.updateInvoice(invoiceId, existing.agencyId, patch);
      const t = new Date().toISOString();
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: existing.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.BILLING_PROFILE_UPDATED,
        resourceType: "billing",
        resourceId: invoiceId,
        details: {
          action: "admin.invoice.updated",
          before: existing,
          after: updated,
          actorRole: user.role,
        },
        createdAt: t,
      });

      return ok({ invoice: updated });
    }

    return jsonStatus({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof SyntaxError) return badRequest("Invalid JSON body");
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN" || error.message === "FORBIDDEN_PERMISSION") return forbidden();
      if (error.message === "INVOICE_NOT_FOUND") return notFound("Invoice not found");
      if (error.message === "MONETIZATION_INVOICES_DISABLED") {
        return jsonStatus({ error: "Invoices table not configured" }, 503);
      }
    }
    return serverError();
  }
}
