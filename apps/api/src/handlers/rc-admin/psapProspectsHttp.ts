import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  addPsapActivityRequestSchema,
  canAccessRcFinancePortal,
  patchPsapProspectBodySchema,
  psapProspectListQuerySchema,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { PsapProspectRepository } from "../../repositories/psapProspectRepository.js";

const repo = new PsapProspectRepository();
const auditRepo = new AuditRepository();

const MAP_CACHE_PATH = "/tmp/psap-map-pins-cache.json";
const MAP_CACHE_TTL_MS = 5 * 60 * 1000;

type JsonResult = ReturnType<typeof ok>;

function actorName(user: { displayName?: string; email?: string; userId: string }): string {
  return user.displayName?.trim() || user.email?.trim() || user.userId;
}

function parseQuery(event: { queryStringParameters?: Record<string, string | undefined> | null }) {
  const q = event.queryStringParameters ?? {};
  return psapProspectListQuerySchema.safeParse({
    state: q.state,
    outreachStatus: q.outreachStatus,
    assignedToUserId: q.assignedToUserId,
    search: q.search,
    hasAddress: q.hasAddress,
    hasContact: q.hasContact,
    page: q.page,
    pageSize: q.pageSize,
    sortBy: q.sortBy,
    sortDir: q.sortDir,
    verifiedOnly: q.verifiedOnly,
  });
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function attnLine(p: {
  primaryContactName?: string;
  primaryContactTitle?: string;
}): string {
  if (p.primaryContactName?.trim()) {
    return `ATTN: ${p.primaryContactName.trim()}, ${p.primaryContactTitle?.trim() || "Communications Director"}`;
  }
  return "ATTN: Communications Director";
}

async function requireRcAdmin(
  event: APIGatewayProxyEventV2,
): Promise<{ error: JsonResult } | { user: UserContext }> {
  const user = await getUserContext(event);
  if (!user) return { error: unauthorized() };
  if (!isUserAccountActive(user)) return { error: unauthorized(ACCOUNT_INACTIVE_MESSAGE) };
  if (!env.enablePsapProspects) {
    return { error: serviceUnavailable("PSAP Prospects CRM is not enabled") };
  }
  if (!canAccessRcFinancePortal(user.role)) return { error: forbidden() };
  return { user };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await requireRcAdmin(event);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    const method = (event.requestContext.http?.method ?? "GET").toUpperCase();
    const path = event.rawPath ?? event.requestContext.http?.path ?? "";
    const psapId = event.pathParameters?.psapId?.trim();

    // GET /stats
    if (method === "GET" && path.endsWith("/stats")) {
      const stats = await repo.stats();
      return ok(stats);
    }

    // GET /map-pins
    if (method === "GET" && path.endsWith("/map-pins")) {
      try {
        if (existsSync(MAP_CACHE_PATH)) {
          const raw = JSON.parse(readFileSync(MAP_CACHE_PATH, "utf8")) as {
            at: number;
            pins: unknown;
          };
          if (Date.now() - raw.at < MAP_CACHE_TTL_MS) {
            return ok({ pins: raw.pins });
          }
        }
      } catch {
        /* rebuild cache */
      }
      const pins = await repo.mapPins();
      try {
        writeFileSync(MAP_CACHE_PATH, JSON.stringify({ at: Date.now(), pins }));
      } catch {
        /* ignore cache write failures in Lambda */
      }
      return ok({ pins });
    }

    // GET /export
    if (method === "GET" && path.endsWith("/export")) {
      const role = String(user.role ?? "").toLowerCase();
      if (role !== "rcsuperadmin" && role !== "rcadmin") return forbidden();
      const parsed = parseQuery(event);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const items = await repo.listAllMatching(parsed.data);
      const headers = [
        "PSAP Name",
        "ATTN Line",
        "Street Address",
        "City",
        "State",
        "ZIP",
        "Phone",
        "Status",
        "Contact Name",
        "Contact Email",
        "Assigned To",
        "Last Contacted",
        "Notes",
        "County",
        "FIPS",
        "Latitude",
        "Longitude",
      ];
      const rows = items.map((p) =>
        [
          p.psapName,
          attnLine(p),
          p.mailingAddress?.streetAddress ?? "",
          p.mailingAddress?.city ?? p.city,
          p.mailingAddress?.state ?? p.state,
          p.mailingAddress?.zip ?? "",
          p.phone,
          p.outreachStatus,
          p.primaryContactName ?? "",
          p.primaryContactEmail ?? "",
          p.assignedToName ?? "",
          p.lastContactedAt ?? "",
          p.notes ?? "",
          p.county,
          p.fips,
          p.latitude,
          p.longitude,
        ]
          .map(csvEscape)
          .join(","),
      );
      const csv = [headers.join(","), ...rows].join("\n");
      const date = new Date().toISOString().slice(0, 10);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.PSAP_PROSPECT_EXPORTED,
        details: { count: items.length, filters: parsed.data },
        createdAt: new Date().toISOString(),
        resourceType: "psap_prospect",
        resourceId: "export",
      });
      return {
        statusCode: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="rc-psap-prospects-${date}.csv"`,
        },
        body: csv,
      };
    }

    // POST /{psapId}/activities
    if (method === "POST" && psapId && path.includes("/activities")) {
      const parsed = addPsapActivityRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const updated = await repo.addActivity(psapId, parsed.data, {
        userId: user.userId,
        displayName: actorName(user),
      });
      if (!updated) return notFound("PSAP not found");
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.PSAP_PROSPECT_ACTIVITY_ADDED,
        details: { psapId, activityType: parsed.data.type },
        createdAt: new Date().toISOString(),
        resourceType: "psap_prospect",
        resourceId: psapId,
      });
      return ok({ prospect: updated });
    }

    // GET /{psapId}
    if (method === "GET" && psapId && !path.endsWith("/activities")) {
      const prospect = await repo.get(psapId);
      if (!prospect) return notFound("PSAP not found");
      return ok({ prospect });
    }

    // PATCH /{psapId}
    if (method === "PATCH" && psapId) {
      const parsed = patchPsapProspectBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const before = await repo.get(psapId);
      const updated = await repo.patch(psapId, parsed.data, {
        userId: user.userId,
        displayName: actorName(user),
      });
      if (!updated) return notFound("PSAP not found");
      const statusChanged =
        parsed.data.outreachStatus &&
        before &&
        parsed.data.outreachStatus !== before.outreachStatus;
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: statusChanged
          ? AUDIT_EVENT_TYPES.PSAP_PROSPECT_STATUS_CHANGED
          : AUDIT_EVENT_TYPES.PSAP_PROSPECT_UPDATED,
        details: { psapId, fields: Object.keys(parsed.data) },
        createdAt: new Date().toISOString(),
        resourceType: "psap_prospect",
        resourceId: psapId,
      });
      return ok({ prospect: updated });
    }

    // GET list
    if (method === "GET") {
      const parsed = parseQuery(event);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const result = await repo.list(parsed.data);
      return ok(result);
    }

    return forbidden();
  } catch (e) {
    console.error("psapProspectsHttp", e);
    return serverError();
  }
};
