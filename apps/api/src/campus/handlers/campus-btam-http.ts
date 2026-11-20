/**
 * HTTP handler for BTAM (Behavioral Threat Assessment & Management) — K-12 only.
 *
 * Routes (all require auth + K-12 TAT role):
 *   GET    /api/campus/{agencyId}/btam           — list cases
 *   POST   /api/campus/{agencyId}/btam           — open new case
 *   GET    /api/campus/{agencyId}/btam/{caseId}  — get single case
 *   PATCH  /api/campus/{agencyId}/btam/{caseId}  — update status/assignment
 *   POST   /api/campus/{agencyId}/btam/{caseId}/actions — add TAT action
 *
 * Access: campus_admin_k12, campus_supervisor_k12, campus_counselor_k12 only.
 * All reads are audited. This data is FERPA-restricted.
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  BTAM_READ_ROLE_FAMILIES,
  BTAM_WRITE_ROLE_FAMILIES,
  btamAddActionBodySchema,
  btamListQuerySchema,
  btamOpenCaseBodySchema,
  btamPatchCaseBodySchema,
} from "rapid-cortex-shared";
import { campusRoleFamily } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { makeId } from "../../lib/ids.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import {
  addBtamCaseAction,
  getBtamCase,
  isCampusBtamTableConfigured,
  listBtamCases,
  openBtamCase,
  patchBtamCase,
} from "../campus-btam-service.js";

const auditRepo = new AuditRepository();

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function canReadBtam(role: string | undefined): boolean {
  return BTAM_READ_ROLE_FAMILIES.has(campusRoleFamily(role) ?? "");
}

function canWriteBtam(role: string | undefined): boolean {
  return BTAM_WRITE_ROLE_FAMILIES.has(campusRoleFamily(role) ?? "");
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!isCampusBtamTableConfigured()) {
      return withCorrelationHeaders(
        event,
        serviceUnavailable("BTAM case management is not enabled for this environment."),
      );
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd);

    if (!canReadBtam(user.role)) {
      return withCorrelationHeaders(event, forbidden("BTAM access requires TAT team role."));
    }

    // agencyId is ALWAYS from the verified JWT — never trusted from path params
    const agencyId = user.agencyId;
    const pathAgencyId = event.pathParameters?.agencyId;
    if (pathAgencyId && pathAgencyId !== agencyId && !agencyId.startsWith("rc")) {
      return withCorrelationHeaders(event, forbidden("Agency mismatch"));
    }

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";
    const caseId = event.pathParameters?.caseId;
    const isAction = path.endsWith("/actions");

    // ── List cases ────────────────────────────────────────────────────────────
    if (method === "GET" && !caseId) {
      const qp = event.queryStringParameters ?? {};
      const parsed = btamListQuerySchema.safeParse({ ...qp, campusCode: qp.campusCode });
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      }
      const result = await listBtamCases(agencyId, {
        campusCode: parsed.data.campusCode,
        status: parsed.data.status,
        limit: parsed.data.limit,
        cursor: parsed.data.cursor,
      });

      const now1 = new Date().toISOString();
      await auditRepo
        .create({
          eventId: makeId("audit"),
          agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.CAMPUS_BTAM_CASES_LISTED,
          details: { campusCode: parsed.data.campusCode },
          createdAt: now1,
          resourceType: "btam_case",
          resourceId: "list",
        })
        .catch(() => void 0);

      return withCorrelationHeaders(event, ok(result));
    }

    // ── Open new case ─────────────────────────────────────────────────────────
    if (method === "POST" && !caseId && !isAction) {
      if (!canWriteBtam(user.role)) {
        return withCorrelationHeaders(event, forbidden("Write access required to open a BTAM case."));
      }
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const parsed = btamOpenCaseBodySchema.safeParse(body);
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      }
      const record = await openBtamCase(agencyId, parsed.data, user.userId, user.name);

      const now2 = new Date().toISOString();
      await auditRepo
        .create({
          eventId: makeId("audit"),
          agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.CAMPUS_BTAM_CASE_OPENED,
          details: { campusCode: record.campusCode, referralSource: record.referralSource },
          createdAt: now2,
          resourceType: "btam_case",
          resourceId: record.caseId,
        })
        .catch(() => void 0);

      return withCorrelationHeaders(event, ok({ case: record }, 201));
    }

    // ── Get single case ───────────────────────────────────────────────────────
    if (method === "GET" && caseId && !isAction) {
      const record = await getBtamCase(agencyId, caseId);
      if (!record) return withCorrelationHeaders(event, notFound("BTAM case not found"));

      const now3 = new Date().toISOString();
      await auditRepo
        .create({
          eventId: makeId("audit"),
          agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.CAMPUS_BTAM_CASE_VIEWED,
          details: {},
          createdAt: now3,
          resourceType: "btam_case",
          resourceId: caseId,
        })
        .catch(() => void 0);

      return withCorrelationHeaders(event, ok({ case: record }));
    }

    // ── Patch case ────────────────────────────────────────────────────────────
    if (method === "PATCH" && caseId && !isAction) {
      if (!canWriteBtam(user.role)) {
        return withCorrelationHeaders(event, forbidden("Write access required to update a BTAM case."));
      }
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const parsed = btamPatchCaseBodySchema.safeParse(body);
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      }
      const record = await patchBtamCase(agencyId, caseId, parsed.data, user.userId, user.name);
      if (!record) return withCorrelationHeaders(event, notFound("BTAM case not found"));

      const now4 = new Date().toISOString();
      await auditRepo
        .create({
          eventId: makeId("audit"),
          agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.CAMPUS_BTAM_CASE_UPDATED,
          details: { newStatus: parsed.data.status },
          createdAt: now4,
          resourceType: "btam_case",
          resourceId: caseId,
        })
        .catch(() => void 0);

      return withCorrelationHeaders(event, ok({ case: record }));
    }

    // ── Add action ────────────────────────────────────────────────────────────
    if (method === "POST" && caseId && isAction) {
      if (!canWriteBtam(user.role)) {
        return withCorrelationHeaders(event, forbidden("Write access required to add a BTAM action."));
      }
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const parsed = btamAddActionBodySchema.safeParse(body);
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      }
      const record = await addBtamCaseAction(agencyId, caseId, parsed.data, user.userId, user.name);
      if (!record) return withCorrelationHeaders(event, notFound("BTAM case not found"));

      const now5 = new Date().toISOString();
      await auditRepo
        .create({
          eventId: makeId("audit"),
          agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.CAMPUS_BTAM_ACTION_ADDED,
          details: { actionType: parsed.data.type },
          createdAt: now5,
          resourceType: "btam_case",
          resourceId: caseId,
        })
        .catch(() => void 0);

      return withCorrelationHeaders(event, ok({ case: record }, 201));
    }

    return withCorrelationHeaders(event, badRequest("Route not found"));
  } catch (error) {
    console.error("[campus-btam-http]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
