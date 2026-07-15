import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { canAccessRcFinancePortal, patchSalesLeadBodySchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { makeId } from "../../lib/ids.js";
import { badRequestFromZod, ok, serverError, unauthorized } from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { SalesLeadRepository } from "../../repositories/salesLeadRepository.js";

const repo = new SalesLeadRepository();
const auditRepo = new AuditRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!canAccessRcFinancePortal(user.role)) return ok({ error: "Forbidden" }, 403);

  const leadId = event.pathParameters?.leadId?.trim();
  if (!leadId) return ok({ error: "leadId is required" }, 400);

  const bodyRaw =
    event.isBase64Encoded && event.body
      ? Buffer.from(event.body, "base64").toString("utf8")
      : (event.body ?? "{}");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(bodyRaw);
  } catch {
    return ok({ error: "Invalid JSON body" }, 400);
  }

  const parsed = patchSalesLeadBodySchema.safeParse(parsedJson);
  if (!parsed.success) return badRequestFromZod(parsed.error);

  try {
    const updated = await repo.updateCrmFields(leadId, {
      ...parsed.data,
      updatedBy: user.userId,
    });
    if (!updated) return ok({ error: "Lead not found" }, 404);

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: "platform",
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SALES_LEAD_UPDATED,
      details: {
        leadId,
        status: parsed.data.status,
        packageSold: parsed.data.packageSold,
        assignee: parsed.data.assignee,
        notesUpdated: parsed.data.notes !== undefined,
      },
      createdAt: new Date().toISOString(),
      resourceType: "sales_lead",
      resourceId: leadId,
    });

    return ok({
      item: {
        ...updated,
        status: updated.status ?? "new",
        packageSold: updated.packageSold ?? "none",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SALES_LEADS_TABLE_NOT_CONFIGURED") {
      return ok({ error: "Sales leads not configured" }, 503);
    }
    console.error("[patchRcAdminLead]", error);
    return serverError();
  }
};
