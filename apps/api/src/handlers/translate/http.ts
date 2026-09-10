import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  canMonitorTranslateSessionForVertical,
  canSendTranslateLink,
  canStartTranslateSessionForVertical,
  findSupportedLanguage,
  isRcInternalOperator,
  OFFICER_LANGUAGE,
  PHRASES_BY_VERTICAL,
  SUPPORTED_LANGUAGES,
  translateSessionCloseRequestSchema,
  translateLinkRequestSchema,
  translateSessionCreateRequestSchema,
  type TranslateSession,
  type TranslateVertical,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { requireTranslateAddon } from "../../middleware/requireAddon.js";
import {
  badRequest,
  badRequestFromZod,
  conflict,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { buildSmsFactoryEnvForAgency } from "../../lib/smsFactoryEnv.js";
import { sendIncidentMediaLinkSms } from "../../services/sms/smsProviderFactory.js";
import { sendWebSocketMessage } from "../../lib/websocket/send-message.js";
import { generateSessionSummary } from "../../translate/summary.js";
import { translateStore } from "../../translate/store.js";
import { queueVerticalWriteback } from "../../translate/writeback.js";
import { signTranslateWsToken } from "../../translate/ws-token.js";

const auditRepo = new AuditRepository();

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

function rest(path: string): string[] {
  const idx = path.indexOf("/api/translate/");
  const tail = idx >= 0 ? path.slice(idx + "/api/translate/".length) : "";
  return tail.split("/").filter(Boolean);
}

function publicBase(): string {
  return (env.appPublicBaseUrl || "").replace(/\/$/, "");
}

export function buildTranslateSessionUrl(session: TranslateSession): string {
  const base = publicBase();
  const id = session.sessionId;
  switch (session.vertical) {
    case "venue":
      return `${base}/app/venue/${encodeURIComponent(session.venueContext?.venueCode ?? "venue")}/translate/${encodeURIComponent(id)}`;
    case "campus":
      return `${base}/app/campus/${encodeURIComponent(session.campusContext?.campusCode ?? "campus")}/translate/${encodeURIComponent(id)}`;
    case "hospital":
      return `${base}/hospital-staff/translate/${encodeURIComponent(id)}`;
    default:
      return `${base}/translate/${encodeURIComponent(id)}`;
  }
}

function wsEndpointWithToken(token: string): string {
  const base = env.translateWsEndpoint.replace(/\/$/, "");
  if (!base) return "";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}token=${encodeURIComponent(token)}`;
}

async function maybeExpire(session: TranslateSession): Promise<TranslateSession> {
  if (session.status !== "PENDING" || !session.sessionUrlExpiresAt) return session;
  if (Date.parse(session.sessionUrlExpiresAt) > Date.now()) return session;
  const expired: TranslateSession = {
    ...session,
    status: "EXPIRED",
    endedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await translateStore.putSession(expired);
  return expired;
}

function canReadSession(user: UserContext, session: TranslateSession): boolean {
  if (isRcInternalOperator(user.role)) return true;
  if (user.agencyId !== session.agencyId) return false;
  if (session.officerId === user.userId) return true;
  return canMonitorTranslateSessionForVertical(user, session.agencyId, session.vertical);
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableRcTranslate || !env.translateSessionsTable) {
      return withCorrelationHeaders(event, serviceUnavailable("RC Translate is not enabled for this deployment"));
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }

    const method = event.requestContext.http?.method ?? "GET";
    const parts = rest(event.rawPath ?? "");
    const query = event.queryStringParameters ?? {};

    if (method === "GET" && parts[0] === "languages") {
      return withCorrelationHeaders(
        event,
        ok({ officer: OFFICER_LANGUAGE, languages: SUPPORTED_LANGUAGES }),
      );
    }

    if (method === "GET" && parts[0] === "phrases") {
      const vertical = (query.vertical as TranslateVertical | undefined) ?? "venue";
      return withCorrelationHeaders(event, ok({ phrases: PHRASES_BY_VERTICAL[vertical] ?? [] }));
    }

    if (method === "POST" && parts[0] === "sessions" && parts.length === 1) {
      const parsed = translateSessionCreateRequestSchema.safeParse(parseBody(event.body));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const vertical = parsed.data.vertical ?? "law_enforcement";
      if (!canStartTranslateSessionForVertical(user, user.agencyId, vertical)) {
        return withCorrelationHeaders(event, forbidden());
      }
      if (!isRcInternalOperator(user.role)) {
        const addonGate = await requireTranslateAddon(vertical)(event, user);
        if (addonGate) return withCorrelationHeaders(event, addonGate);
      }
      if (parsed.data.subjectLanguage && !findSupportedLanguage(parsed.data.subjectLanguage)) {
        return withCorrelationHeaders(event, badRequest("Unsupported subject language"));
      }
      const now = new Date().toISOString();
      const sessionId = makeId("xlat");
      const session: TranslateSession = {
        sessionId,
        agencyId: user.agencyId,
        incidentId: parsed.data.incidentId,
        officerId: user.userId,
        officerName: user.displayName || user.email,
        primaryLanguage: "en",
        subjectLanguage: parsed.data.subjectLanguage || "es",
        subjectLanguageDetected: Boolean(parsed.data.subjectLanguage),
        status: "PENDING",
        startedAt: now,
        location: parsed.data.location,
        segmentCount: 0,
        cadWritebackStatus: "NONE",
        monitorUserIds: [],
        sessionUrl: "",
        vertical,
        venueContext: parsed.data.venueContext,
        campusContext: parsed.data.campusContext,
        hospitalContext: parsed.data.hospitalContext,
        createdAt: now,
        updatedAt: now,
      };
      session.sessionUrl = buildTranslateSessionUrl(session);
      await translateStore.putSession(session);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.TRANSLATE_SESSION_CREATED,
        details: { sessionId, vertical, incidentId: session.incidentId },
        createdAt: now,
        resourceType: "session",
        resourceId: sessionId,
      });
      const token = await signTranslateWsToken({
        sub: user.userId,
        agencyId: user.agencyId,
        sessionId,
        wsRole: "officer",
      });
      return withCorrelationHeaders(
        event,
        ok({ session, wsEndpoint: wsEndpointWithToken(token) }, 201),
      );
    }

    if (method === "GET" && parts[0] === "sessions" && parts.length === 1) {
      const status = (query.status as TranslateSession["status"] | undefined) ?? "ACTIVE";
      const vertical = query.vertical as TranslateVertical | undefined;
      const gateVertical = vertical ?? "law_enforcement";
      if (
        !canMonitorTranslateSessionForVertical(user, user.agencyId, gateVertical) &&
        !canStartTranslateSessionForVertical(user, user.agencyId, gateVertical)
      ) {
        return withCorrelationHeaders(event, forbidden());
      }
      const items = await translateStore.listByAgencyStatus(user.agencyId, status, { vertical });
      return withCorrelationHeaders(event, ok({ items, count: items.length }));
    }

    if (method === "POST" && parts[0] === "link" && parts.length === 1) {
      const parsed = translateLinkRequestSchema.safeParse(parseBody(event.body));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const vertical = parsed.data.vertical ?? "law_enforcement";
      if (vertical === "law_enforcement") {
        if (!canSendTranslateLink(user, user.agencyId)) {
          return withCorrelationHeaders(event, forbidden());
        }
      } else if (!canStartTranslateSessionForVertical(user, user.agencyId, vertical)) {
        return withCorrelationHeaders(event, forbidden());
      }
      if (!isRcInternalOperator(user.role)) {
        const addonGate = await requireTranslateAddon(vertical)(event, user);
        if (addonGate) return withCorrelationHeaders(event, addonGate);
      }
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
      const sessionId = makeId("xlat");
      const officerId = parsed.data.officerUserId || user.userId;
      const session: TranslateSession = {
        sessionId,
        agencyId: user.agencyId,
        incidentId: parsed.data.incidentId,
        officerId,
        primaryLanguage: "en",
        subjectLanguage: parsed.data.subjectLanguage || "es",
        subjectLanguageDetected: Boolean(parsed.data.subjectLanguage),
        status: "PENDING",
        startedAt: now,
        segmentCount: 0,
        cadWritebackStatus: "NONE",
        monitorUserIds: [],
        dispatchInitiatedByUserId: user.userId,
        sessionUrl: "",
        sessionUrlExpiresAt: expiresAt,
        vertical,
        venueContext: parsed.data.venueContext,
        campusContext: parsed.data.campusContext,
        hospitalContext: parsed.data.hospitalContext,
        createdAt: now,
        updatedAt: now,
      };
      session.sessionUrl = buildTranslateSessionUrl(session);
      await translateStore.putSession(session);

      let smsDelivered = false;
      if (parsed.data.officerPhone) {
        try {
          const smsEnv = await buildSmsFactoryEnvForAgency(user.agencyId, {
            extraMock: env.translateMock,
          });
          const sent = await sendIncidentMediaLinkSms(smsEnv, {
            toPhoneE164: parsed.data.officerPhone,
            messageBody: `Rapid Cortex Translate session: ${session.sessionUrl}`,
            agencyId: user.agencyId,
            incidentId: session.incidentId || sessionId,
            messageType: "translate_session_link",
          });
          smsDelivered = sent.status === "queued" || sent.status === "sent";
        } catch {
          smsDelivered = false;
        }
      }

      let notificationDelivered = false;
      if (parsed.data.officerUserId) {
        try {
          await sendWebSocketMessage({
            userId: parsed.data.officerUserId,
            message: {
              type: "translate_link",
              data: { sessionId, sessionUrl: session.sessionUrl },
            },
          });
          notificationDelivered = true;
        } catch {
          notificationDelivered = false;
        }
      }

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.TRANSLATE_LINK_SENT,
        details: { sessionId, vertical, smsDelivered, notificationDelivered },
        createdAt: now,
        resourceType: "session",
        resourceId: sessionId,
      });

      return withCorrelationHeaders(
        event,
        ok({
          sessionId,
          sessionUrl: session.sessionUrl,
          smsDelivered,
          notificationDelivered,
          expiresAt,
        }, 201),
      );
    }

    if (parts[0] === "sessions" && parts[1]) {
      const sessionId = parts[1];
      let session = await translateStore.getSession(user.agencyId, sessionId);
      if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
      session = await maybeExpire(session);
      if (!canReadSession(user, session)) {
        return withCorrelationHeaders(event, forbidden());
      }

      if (method === "GET" && parts.length === 2) {
        return withCorrelationHeaders(event, ok({ session }));
      }

      if (method === "GET" && parts[2] === "segments") {
        const items = await translateStore.listSegments(sessionId, user.agencyId);
        return withCorrelationHeaders(event, ok({ items }));
      }

      if (method === "GET" && parts[2] === "ws-token") {
        const wsRole = query.role === "monitor" ? "monitor" : "officer";
        if (wsRole === "monitor") {
          if (!canMonitorTranslateSessionForVertical(user, user.agencyId, session.vertical)) {
            return withCorrelationHeaders(event, forbidden());
          }
        } else if (
          session.officerId !== user.userId &&
          !canStartTranslateSessionForVertical(user, user.agencyId, session.vertical)
        ) {
          return withCorrelationHeaders(event, forbidden());
        }
        const token = await signTranslateWsToken({
          sub: user.userId,
          agencyId: user.agencyId,
          sessionId,
          wsRole,
        });
        return withCorrelationHeaders(
          event,
          ok({ token, wsEndpoint: wsEndpointWithToken(token), expiresIn: 3600 }),
        );
      }

      if (method === "POST" && parts[2] === "monitor") {
        if (!canMonitorTranslateSessionForVertical(user, user.agencyId, session.vertical)) {
          return withCorrelationHeaders(event, forbidden());
        }
        if (!session.monitorUserIds.includes(user.userId)) {
          session = {
            ...session,
            monitorUserIds: [...session.monitorUserIds, user.userId],
            updatedAt: new Date().toISOString(),
          };
          await translateStore.putSession(session);
        }
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: user.agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.TRANSLATE_MONITOR_JOINED,
          details: { sessionId, vertical: session.vertical },
          createdAt: new Date().toISOString(),
          resourceType: "session",
          resourceId: sessionId,
        });
        const token = await signTranslateWsToken({
          sub: user.userId,
          agencyId: user.agencyId,
          sessionId,
          wsRole: "monitor",
        });
        return withCorrelationHeaders(
          event,
          ok({ session, wsEndpoint: wsEndpointWithToken(token) }),
        );
      }

      if (method === "POST" && parts[2] === "close") {
        const parsed = translateSessionCloseRequestSchema.safeParse(parseBody(event.body) ?? {});
        if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
        if (session.status === "CLOSED" || session.status === "EXPIRED") {
          return withCorrelationHeaders(event, conflict("Session already closed"));
        }
        if (
          session.officerId !== user.userId &&
          !canStartTranslateSessionForVertical(user, user.agencyId, session.vertical)
        ) {
          return withCorrelationHeaders(event, forbidden());
        }
        const now = new Date().toISOString();
        const segments = await translateStore.listSegments(sessionId, user.agencyId);
        const summary = await generateSessionSummary(session, segments);
        session = {
          ...session,
          status: "CLOSED",
          endedAt: now,
          updatedAt: now,
          sessionSummary: summary,
        };
        await translateStore.putSession(session);

        const wantWriteback = parsed.data.writebackNote === true || parsed.data.cadWriteback === true;
        let cadWritebackQueued = false;
        let writebackQueued = false;
        if (wantWriteback) {
          const result = await queueVerticalWriteback({
            session,
            summary,
            segments,
            actorId: user.userId,
          });
          writebackQueued = result.queued;
          cadWritebackQueued = result.cadQueued;
          const refreshed = await translateStore.getSession(user.agencyId, sessionId);
          if (refreshed) session = refreshed;
        }

        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: user.agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.TRANSLATE_SESSION_CLOSED,
          details: {
            sessionId,
            vertical: session.vertical,
            segmentCount: session.segmentCount,
            writebackQueued,
          },
          createdAt: now,
          resourceType: "session",
          resourceId: sessionId,
        });

        return withCorrelationHeaders(
          event,
          ok({
            session,
            summaryGenerated: Boolean(summary),
            cadWritebackQueued,
            writebackQueued,
          }),
        );
      }
    }

    return withCorrelationHeaders(event, notFound("Not found"));
  } catch (error) {
    console.error(
      JSON.stringify({
        type: "translate.http.error",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return withCorrelationHeaders(event, serverError());
  }
};
