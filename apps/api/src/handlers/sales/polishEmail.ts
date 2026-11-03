/**
 * POST /api/sales/polish-email
 * Bedrock rewrite of sales email subject/body (mock when BEDROCK_MOCK=1).
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { canAccessSalesTools, salesEmailPolishRequestSchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { polishSalesEmail } from "../../lib/sales/email-polish.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";

const auditRepo = new AuditRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  const pwd = operationalPasswordBlock(user);
  if (pwd) return pwd;

  if (!canAccessSalesTools(user.role)) {
    return forbidden();
  }
  if (!env.enableSalesTools) {
    return serviceUnavailable("Sales Tools is not enabled");
  }

  let body: unknown;
  try {
    const raw =
      event.isBase64Encoded && event.body
        ? Buffer.from(event.body, "base64").toString("utf8")
        : (event.body ?? "{}");
    body = JSON.parse(raw);
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = salesEmailPolishRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequestFromZod(parsed.error);
  }

  try {
    const result = await polishSalesEmail(parsed.data);
    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "__platform__",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SALES_EMAIL_POLISHED,
        details: {
          tone: parsed.data.tone,
          mock: result.mock === true,
          bodyChars: parsed.data.body.length,
          notesCount: result.notes?.length ?? 0,
        },
        createdAt: new Date().toISOString(),
        resourceType: "sales_lead",
        resourceId: user.userId,
      });
    } catch {
      /* never fail polish on audit */
    }
    return withCorrelationHeaders(event, ok(result));
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "sales_polish_email_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return serverError();
  }
};
