/**
 * POST /api/rc-admin/grant-writer/generate
 * Claude grant narrative (JSON sections). Web BFF builds the .docx and wraps SSE.
 * Anthropic key is loaded from Secrets Manager — never from Lambda env.
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AUDIT_EVENT_TYPES, isRcAdmin, isRcSuperAdmin } from "rapid-cortex-security";
import "../../lib/env.js";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { makeId } from "../../lib/ids.js";
import {
  generateGrantWriterSections,
} from "../../lib/grants/grant-writer-narrative.js";
import { badRequest, forbidden, ok, serverError, unauthorized } from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";

const auditRepo = new AuditRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!isRcSuperAdmin(user.role) && !isRcAdmin(user.role)) {
    return forbidden("Forbidden — platform admin access required");
  }

  const bodyRaw =
    event.isBase64Encoded && event.body
      ? Buffer.from(event.body, "base64").toString("utf8")
      : (event.body ?? "{}");

  let form: Record<string, unknown>;
  try {
    form = JSON.parse(bodyRaw) as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!form.agencyName || !form.projectDescription) {
    return badRequest("Agency name and project description are required.");
  }

  try {
    const sections = await generateGrantWriterSections(form);
    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.GRANT_PACKAGE_GENERATED,
        details: {
          kind: "grant_writer_narrative",
          agencyName: String(form.agencyName),
          grantName: String(form.grantName ?? ""),
        },
        createdAt: new Date().toISOString(),
        resourceType: "grant_package",
        resourceId: String(form.agencyName),
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "grant_writer_audit_failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
    return ok({ sections });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[grant-writer]", message);
    if (message.includes("Anthropic secret") || message.includes("Claude API")) {
      return ok({ error: "Grant writer is not configured. Contact your RC administrator." }, 503);
    }
    return serverError();
  }
};
