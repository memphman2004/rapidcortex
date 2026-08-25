import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  PLATFORM_CONFERENCE_AGENCY_ID,
  applyConferenceChange,
  canAccessRapidIq,
  conferenceSourceUrl,
  createConferenceBodySchema,
  dismissConferenceChange,
  patchConferenceBodySchema,
  type Conference,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { seedConferencesIfEmpty } from "../../lib/conferences/seed-conferences.js";
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
import { ConferenceRepository } from "../../repositories/conferenceRepository.js";

const repo = new ConferenceRepository();
const auditRepo = new AuditRepository();

type JsonResult = ReturnType<typeof ok>;

async function requireConferencesAdmin(
  event: APIGatewayProxyEventV2,
): Promise<{ error: JsonResult } | { user: UserContext }> {
  const user = await getUserContext(event);
  if (!user) return { error: unauthorized() };
  if (!isUserAccountActive(user)) return { error: unauthorized(ACCOUNT_INACTIVE_MESSAGE) };
  if (!env.enableConferences) return { error: serviceUnavailable("Conferences tracker is not enabled") };
  if (!canAccessRapidIq(user.role)) return { error: forbidden() };
  return { user };
}

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function conferenceIdFromPath(path: string, params?: { conferenceId?: string }): string | undefined {
  if (params?.conferenceId?.trim()) return params.conferenceId.trim();
  const m = path.match(/\/conferences\/([^/]+)/);
  return m?.[1];
}

async function audit(
  user: UserContext,
  type: string,
  conferenceId: string,
  details: Record<string, unknown>,
): Promise<void> {
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: PLATFORM_CONFERENCE_AGENCY_ID,
    actorId: user.userId,
    type,
    details,
    createdAt: new Date().toISOString(),
    resourceType: "conference",
    resourceId: conferenceId,
  });
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await requireConferencesAdmin(event);
    if ("error" in auth) return withCorrelationHeaders(event, auth.error);
    const { user } = auth;

    const method = (event.requestContext.http?.method ?? "GET").toUpperCase();
    const path = event.rawPath ?? event.requestContext.http?.path ?? "";
    const conferenceId = conferenceIdFromPath(path, event.pathParameters);

    const isCollection = /\/rc-admin\/conferences\/?$/.test(path);

    if (method === "GET" && isCollection) {
      const items = await seedConferencesIfEmpty(repo);
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (method === "POST" && isCollection) {
      const body = parseBody(event);
      if (body == null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = createConferenceBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const now = new Date().toISOString();
      const sourceUrl =
        parsed.data.sourceUrl?.trim() ||
        parsed.data.website?.trim() ||
        "";
      if (!sourceUrl) {
        return withCorrelationHeaders(event, badRequest("sourceUrl or website is required"));
      }
      const item: Conference = {
        conferenceId: makeId("conf"),
        agencyId: PLATFORM_CONFERENCE_AGENCY_ID,
        name: parsed.data.name,
        website: parsed.data.website,
        sourceUrl,
        alternateSourceUrls: parsed.data.alternateSourceUrls,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        location: parsed.data.location,
        venue: parsed.data.venue,
        registrationFee: parsed.data.registrationFee,
        boothFee: parsed.data.boothFee,
        registrationDeadline: parsed.data.registrationDeadline,
        vertical: parsed.data.vertical,
        notes: parsed.data.notes,
        priority: parsed.data.priority,
        changeHistory: [],
        autoUpdateEnabled: parsed.data.autoUpdateEnabled ?? true,
        createdAt: now,
        updatedAt: now,
      };
      await repo.put(item);
      await audit(user, AUDIT_EVENT_TYPES.CONFERENCE_CREATED, item.conferenceId, { name: item.name });
      return withCorrelationHeaders(event, ok({ item }, 201));
    }

    if (method === "PATCH" && conferenceId) {
      const existing = await repo.get(conferenceId);
      if (!existing) return withCorrelationHeaders(event, notFound("Conference not found"));
      const body = parseBody(event);
      if (body == null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = patchConferenceBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

      if (parsed.data.action === "dismiss_change") {
        if (!parsed.data.changeId) {
          return withCorrelationHeaders(event, badRequest("changeId is required"));
        }
        const change = existing.changeHistory.find((c) => c.changeId === parsed.data.changeId);
        if (!change) return withCorrelationHeaders(event, notFound("Change not found"));
        if (change.status !== "pending") {
          return withCorrelationHeaders(event, badRequest("Change is not pending"));
        }
        if (change.changeType === "cancelled") {
          return withCorrelationHeaders(event, badRequest("Cancellation alerts cannot be dismissed"));
        }
        const next = dismissConferenceChange(existing, parsed.data.changeId);
        await repo.put(next);
        await audit(user, AUDIT_EVENT_TYPES.CONFERENCE_CHANGE_DISMISSED, conferenceId, {
          changeId: parsed.data.changeId,
        });
        return withCorrelationHeaders(event, ok({ item: next }));
      }

      if (parsed.data.action === "apply_change") {
        if (!parsed.data.changeId) {
          return withCorrelationHeaders(event, badRequest("changeId is required"));
        }
        const change = existing.changeHistory.find((c) => c.changeId === parsed.data.changeId);
        if (!change) return withCorrelationHeaders(event, notFound("Change not found"));
        if (change.status !== "pending") {
          return withCorrelationHeaders(event, badRequest("Change is not pending"));
        }
        const next = applyConferenceChange(existing, change);
        await repo.put(next);
        await audit(user, AUDIT_EVENT_TYPES.CONFERENCE_CHANGE_APPLIED, conferenceId, {
          changeId: parsed.data.changeId,
          changeType: change.changeType,
        });
        return withCorrelationHeaders(event, ok({ item: next }));
      }

      const next: Conference = {
        ...existing,
        name: parsed.data.name ?? existing.name,
        website: parsed.data.website ?? existing.website,
        sourceUrl: parsed.data.sourceUrl?.trim() || existing.sourceUrl || conferenceSourceUrl(existing),
        alternateSourceUrls: parsed.data.alternateSourceUrls ?? existing.alternateSourceUrls,
        startDate: parsed.data.startDate ?? existing.startDate,
        endDate: parsed.data.endDate ?? existing.endDate,
        location: parsed.data.location ?? existing.location,
        venue: parsed.data.venue ?? existing.venue,
        registrationFee:
          parsed.data.registrationFee === null
            ? undefined
            : (parsed.data.registrationFee ?? existing.registrationFee),
        boothFee:
          parsed.data.boothFee === null
            ? undefined
            : (parsed.data.boothFee ?? existing.boothFee),
        registrationDeadline:
          parsed.data.registrationDeadline === null
            ? undefined
            : (parsed.data.registrationDeadline ?? existing.registrationDeadline),
        isCancelled: parsed.data.isCancelled ?? existing.isCancelled,
        vertical: parsed.data.vertical ?? existing.vertical,
        priority: parsed.data.priority ?? existing.priority,
        notes: parsed.data.notes ?? existing.notes,
        autoUpdateEnabled: parsed.data.autoUpdateEnabled ?? existing.autoUpdateEnabled,
        updatedAt: new Date().toISOString(),
      };
      await repo.put(next);
      await audit(user, AUDIT_EVENT_TYPES.CONFERENCE_UPDATED, conferenceId, {
        fields: Object.keys(parsed.data).filter((k) => k !== "action" && k !== "changeId"),
      });
      return withCorrelationHeaders(event, ok({ item: next }));
    }

    return withCorrelationHeaders(event, notFound());
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "conferences_http_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return withCorrelationHeaders(event, serverError());
  }
}
