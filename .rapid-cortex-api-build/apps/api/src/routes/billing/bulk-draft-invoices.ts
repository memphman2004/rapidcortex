import {
  bulkDraftInvoicesBodySchema,
  canAccessRcRevenuePortal,
  type UserContext,
} from "rapid-cortex-shared";
import {
  badRequestFromZod,
  forbidden,
  ok,
  serverError,
} from "../../lib/response.js";
import { BulkDraftInvoicesService } from "../../services/bulkDraftInvoicesService.js";

const svc = new BulkDraftInvoicesService();

export async function handleBulkDraftInvoicesRoute(
  event: {
    body?: string | null;
    isBase64Encoded?: boolean;
    requestContext: { http: { method: string } };
  },
  user: UserContext,
) {
  if (event.requestContext.http.method !== "POST") {
    return ok({ error: "Method not allowed" }, 405);
  }
  if (!canAccessRcRevenuePortal(user.role)) return forbidden();

  try {
    const bodyRaw =
      event.isBase64Encoded && event.body
        ? Buffer.from(event.body, "base64").toString("utf8")
        : (event.body ?? "{}");
    const parsed = bulkDraftInvoicesBodySchema.safeParse(JSON.parse(bodyRaw));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const result = await svc.run({
      user,
      yearMonth: parsed.data.yearMonth,
      dryRun: parsed.data.dryRun ?? false,
    });
    return ok(result);
  } catch (err) {
    console.error("[bulkDraftInvoices]", err);
    return serverError(err instanceof Error ? err.message : "Bulk draft failed");
  }
}
