import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ZodError } from "zod";
import { withCorrelationHeaders } from "../../lib/correlation.js";
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
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { requireAgencyRoute } from "../vertical/agency-route-context.js";
import {
  handleVisitorCheckIn,
  listVisitors,
  signOutVisitor,
  verifyBadge,
  visitorCheckInBodySchema,
} from "../../campus/campus-visitors-service.js";
import { extractIdFieldsViaTextract } from "../../campus/campus-visitor-textract-service.js";
import { extractIdRequestSchema, visitorCheckInBodyV2Schema } from "rapid-cortex-shared";
import {
  getPickupRecord,
  listPickupRecords,
  studentPickupRecordSchema,
  upsertPickupRecord,
} from "../../campus/campus-pickup-service.js";
import {
  archiveVolunteer,
  createVolunteer,
  getVolunteer,
  isCampusVolunteersTableConfigured,
  listVolunteers,
  recheckVolunteerNsopw,
  updateVolunteer,
} from "../../campus/campus-volunteers-service.js";
import {
  campusRoleFamily,
  campusVolunteerListQuerySchema,
  campusVolunteerPatchBodySchema,
  campusVolunteerUpsertBodySchema,
  isRcInternalOperator,
} from "rapid-cortex-shared";

function canManageVisitors(role: string): boolean {
  if (isRcInternalOperator(role)) return true;
  const family = campusRoleFamily(role);
  return family === "admin" || family === "supervisor" || family === "security" || family === "dispatch";
}

function canReadPickup(role: string): boolean {
  if (isRcInternalOperator(role)) return true;
  const family = campusRoleFamily(role);
  return family === "admin" || family === "supervisor" || family === "security";
}

function canWritePickup(role: string): boolean {
  if (isRcInternalOperator(role)) return true;
  return campusRoleFamily(role) === "admin";
}

function canReadVolunteers(role: string): boolean {
  if (isRcInternalOperator(role)) return true;
  const family = campusRoleFamily(role);
  return family === "admin" || family === "supervisor" || family === "security";
}

function canWriteVolunteers(role: string): boolean {
  if (isRcInternalOperator(role)) return true;
  const family = campusRoleFamily(role);
  return family === "admin" || family === "supervisor";
}

function pathTail(event: APIGatewayProxyEventV2): string {
  const raw = event.rawPath ?? event.requestContext.http.path ?? "";
  const marker = "/api/campus/";
  const idx = raw.indexOf(marker);
  if (idx < 0) return "";
  const after = raw.slice(idx + marker.length);
  const slash = after.indexOf("/");
  return slash < 0 ? "" : after.slice(slash + 1);
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const tail = pathTail(event);

  try {
    if (tail === "visitors" && method === "GET") {
      const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
      if ("response" in ctx) return ctx.response;
      if (!canManageVisitors(ctx.user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const date = event.queryStringParameters?.date ?? undefined;
      const visitors = await listVisitors(ctx.agencyId, date);
      return withCorrelationHeaders(event, ok({ visitors }));
    }

    if (tail === "visitors/check-in" && method === "POST") {
      const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
      if ("response" in ctx) return ctx.response;
      if (!canManageVisitors(ctx.user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      let body: unknown = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      }
      try {
        // Try v2 schema first (scan-enriched); fall back to legacy
        const bodyObj = body as Record<string, unknown>;
        const isV2 = "captureMethod" in bodyObj;
        const parsed = isV2
          ? visitorCheckInBodyV2Schema.parse(body)
          : visitorCheckInBodySchema.parse(body);
        const result = await handleVisitorCheckIn(
          ctx.agencyId,
          parsed,
          ctx.user.email ?? ctx.user.userId,
        );
        return withCorrelationHeaders(event, ok(result));
      } catch (error) {
        if (error instanceof ZodError) {
          return withCorrelationHeaders(event, badRequestFromZod(error));
        }
        throw error;
      }
    }

    // ── Visitor ID extraction via Textract (OCR fallback) ─────────────────────
    if (tail === "visitors/extract-id" && method === "POST") {
      const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
      if ("response" in ctx) return ctx.response;
      if (!canManageVisitors(ctx.user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      let body: unknown = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      }
      const parsed = extractIdRequestSchema.safeParse(body);
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      }
      const extraction = await extractIdFieldsViaTextract(parsed.data.imageBase64);
      return withCorrelationHeaders(event, ok(extraction));
    }

    // ── Visitor sign-out ──────────────────────────────────────────────────────
    // tail format: "visitors/{visitorId}/sign-out"
    const signOutMatch = tail.match(/^visitors\/([^/]+)\/sign-out$/);
    if (signOutMatch && method === "POST") {
      const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
      if ("response" in ctx) return ctx.response;
      if (!canManageVisitors(ctx.user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const visitorId = signOutMatch[1];
      const result = await signOutVisitor(ctx.agencyId, visitorId);
      if (!result.success) {
        return withCorrelationHeaders(event, notFound("Visitor not found or already signed out"));
      }
      return withCorrelationHeaders(event, ok(result));
    }

    // ── Badge verification (PUBLIC — no JWT required) ─────────────────────────
    // Route: GET /api/campus/badge/{badgeToken}
    // tail format: "badge/{token}"  (note: no agencyId in this path)
    if (tail.startsWith("badge/") && method === "GET") {
      const badgeToken = tail.slice("badge/".length);
      if (!badgeToken || badgeToken.length < 32) {
        return withCorrelationHeaders(event, badRequest("Invalid badge token"));
      }
      const result = await verifyBadge(badgeToken);
      return withCorrelationHeaders(event, ok(result));
    }

    if (tail === "pickup-auth" && method === "GET") {
      const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
      if ("response" in ctx) return ctx.response;
      if (!canReadPickup(ctx.user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const studentId = event.queryStringParameters?.studentId?.trim();
      if (studentId) {
        const record = await getPickupRecord(ctx.agencyId, studentId);
        return withCorrelationHeaders(event, ok({ record: record ?? null }));
      }
      const records = await listPickupRecords(ctx.agencyId);
      return withCorrelationHeaders(event, ok({ records }));
    }

    if (tail === "pickup-auth" && method === "PUT") {
      const ctx = await requireAgencyRoute(event, "campus.settings.manage");
      if ("response" in ctx) return ctx.response;
      if (!canWritePickup(ctx.user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      let body: unknown = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      }
      try {
        const now = new Date().toISOString();
        const parsed = studentPickupRecordSchema.parse({
          ...(typeof body === "object" && body ? body : {}),
          agencyId: ctx.agencyId,
          updatedAt: now,
          updatedBy: ctx.user.userId,
        });
        await upsertPickupRecord(parsed);
        return withCorrelationHeaders(event, ok({ record: parsed }));
      } catch (error) {
        if (error instanceof ZodError) {
          return withCorrelationHeaders(event, badRequestFromZod(error));
        }
        throw error;
      }
    }

    // -----------------------------------------------------------------------
    // Volunteer Management Routes
    // -----------------------------------------------------------------------

    if (tail === "volunteers" && method === "GET") {
      const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
      if ("response" in ctx) return ctx.response;
      if (!canReadVolunteers(ctx.user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      if (!isCampusVolunteersTableConfigured()) {
        return withCorrelationHeaders(
          event,
          ok({ error: "Volunteer management not provisioned in this environment" }, 503),
        );
      }
      const qParsed = campusVolunteerListQuerySchema.safeParse(
        event.queryStringParameters ?? {},
      );
      const q = qParsed.success ? qParsed.data : {};
      const volunteers = await listVolunteers(ctx.agencyId, q);
      return withCorrelationHeaders(event, ok({ volunteers }));
    }

    if (tail === "volunteers" && method === "POST") {
      const ctx = await requireAgencyRoute(event, "campus.settings.manage");
      if ("response" in ctx) return ctx.response;
      if (!canWriteVolunteers(ctx.user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      if (!isCampusVolunteersTableConfigured()) {
        return withCorrelationHeaders(
          event,
          ok({ error: "Volunteer management not provisioned in this environment" }, 503),
        );
      }
      let body: unknown = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      }
      const parsed = campusVolunteerUpsertBodySchema.safeParse(body);
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      }
      const result = await createVolunteer({
        agencyId: ctx.agencyId,
        body: parsed.data,
        createdBy: ctx.user.userId,
      });
      return withCorrelationHeaders(event, ok(result));
    }

    // /volunteers/{volunteerId}
    const volunteerIdMatch = tail.match(/^volunteers\/([^/]+)$/);
    if (volunteerIdMatch) {
      const volunteerId = volunteerIdMatch[1];
      const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
      if ("response" in ctx) return ctx.response;

      if (method === "GET") {
        if (!canReadVolunteers(ctx.user.role)) {
          return withCorrelationHeaders(event, forbidden());
        }
        if (!isCampusVolunteersTableConfigured()) {
          return withCorrelationHeaders(event, ok({ volunteer: null }));
        }
        const volunteer = await getVolunteer(ctx.agencyId, volunteerId);
        if (!volunteer) {
          return withCorrelationHeaders(event, ok({ volunteer: null }, 404));
        }
        return withCorrelationHeaders(event, ok({ volunteer }));
      }

      if (method === "PATCH") {
        if (!canWriteVolunteers(ctx.user.role)) {
          return withCorrelationHeaders(event, forbidden());
        }
        if (!isCampusVolunteersTableConfigured()) {
          return withCorrelationHeaders(
            event,
            ok({ error: "Volunteer management not provisioned in this environment" }, 503),
          );
        }
        let body: unknown = {};
        try {
          body = event.body ? JSON.parse(event.body) : {};
        } catch {
          return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
        }
        const parsed = campusVolunteerPatchBodySchema.safeParse(body);
        if (!parsed.success) {
          return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
        }
        const updated = await updateVolunteer({
          agencyId: ctx.agencyId,
          volunteerId,
          patch: parsed.data,
          updatedBy: ctx.user.userId,
        });
        return withCorrelationHeaders(event, ok({ volunteer: updated }));
      }

      if (method === "DELETE") {
        if (!canWriteVolunteers(ctx.user.role)) {
          return withCorrelationHeaders(event, forbidden());
        }
        if (!isCampusVolunteersTableConfigured()) {
          return withCorrelationHeaders(event, ok({ archived: true }));
        }
        await archiveVolunteer(ctx.agencyId, volunteerId, ctx.user.userId);
        return withCorrelationHeaders(event, ok({ archived: true }));
      }
    }

    // /volunteers/{volunteerId}/nsopw-check
    const nsopwRecheckMatch = tail.match(/^volunteers\/([^/]+)\/nsopw-check$/);
    if (nsopwRecheckMatch && method === "POST") {
      const volunteerId = nsopwRecheckMatch[1];
      const ctx = await requireAgencyRoute(event, "campus.settings.manage");
      if ("response" in ctx) return ctx.response;
      if (!canWriteVolunteers(ctx.user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      if (!isCampusVolunteersTableConfigured()) {
        return withCorrelationHeaders(
          event,
          ok({ error: "Volunteer management not provisioned in this environment" }, 503),
        );
      }
      const result = await recheckVolunteerNsopw(
        ctx.agencyId,
        volunteerId,
        ctx.user.userId,
      );
      return withCorrelationHeaders(event, ok(result));
    }

    return withCorrelationHeaders(event, badRequest("Not found"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("CAMPUS_VISITORS_TABLE") ||
      message.includes("CAMPUS_PICKUP_AUTH_TABLE")
    ) {
      console.error("[campus-k12] table env missing", message);
      return withCorrelationHeaders(
        event,
        ok({ error: "K-12 tables not provisioned in this environment" }, 503),
      );
    }
    console.error("[campus-k12]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
