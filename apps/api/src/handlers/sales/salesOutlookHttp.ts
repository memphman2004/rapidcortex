/**
 * Personal Sales Tools Outlook OAuth + send.
 * Routes:
 *   GET  /api/sales/outlook/status
 *   GET  /api/sales/outlook/connect
 *   POST /api/sales/outlook/callback
 *   POST /api/sales/outlook/disconnect
 *   POST /api/sales/send-email
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import {
  canAccessSalesTools,
  salesOutlookCallbackBodySchema,
  salesSendEmailRequestSchema,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  buildPersonalOutlookAuthorizeUrl,
  encryptOutlookToken,
  ensureOutlookAccessToken,
  exchangePersonalOutlookAuthCode,
  isOutlookGraphMock,
  isOutlookOAuthConfigured,
  resolveOutlookClientSecret,
  sendOutlookMail,
  signOutlookOAuthState,
  verifyOutlookOAuthState,
  type SalesOutlookConnection,
} from "../../lib/rapid-iq/outlook-graph.js";
import {
  deleteUserOutlookConnection,
  getUserOutlookConnection,
  putUserOutlookConnection,
} from "../../lib/rapid-iq/sales-automation-db.js";
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

const auditRepo = new AuditRepository();

function pathOf(event: APIGatewayProxyEventV2): string {
  return event.rawPath || event.requestContext?.http?.path || "";
}

function methodOf(event: APIGatewayProxyEventV2): string {
  return (event.requestContext?.http?.method || "GET").toUpperCase();
}

function parseBody(event: APIGatewayProxyEventV2): unknown | null {
  try {
    const raw =
      event.isBase64Encoded && event.body
        ? Buffer.from(event.body, "base64").toString("utf8")
        : (event.body ?? "{}");
    return JSON.parse(raw || "{}") as unknown;
  } catch {
    return null;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainToHtml(body: string): string {
  return `<div>${escapeHtml(body).replace(/\n/g, "<br/>")}</div>`;
}

async function personalOutlookStatus(userId: string) {
  const conn = await getUserOutlookConnection(userId);
  return {
    configured: isOutlookOAuthConfigured() || isOutlookGraphMock(),
    mock: isOutlookGraphMock() || Boolean(conn?.mock),
    connected: Boolean(conn),
    mailbox: conn?.mailbox,
    requiredDomain: "@nexcortiq.us",
    connectedAt: conn?.connectedAt,
  };
}

async function audit(
  userId: string,
  type: string,
  resourceId: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: "__platform__",
      actorId: userId,
      type,
      details,
      createdAt: new Date().toISOString(),
      resourceType: "sales_lead",
      resourceId,
    });
  } catch {
    /* never fail business path on audit */
  }
}

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

  const method = methodOf(event);
  const path = pathOf(event);

  try {
    if (method === "GET" && path.includes("/outlook/status")) {
      return withCorrelationHeaders(
        event,
        ok({ outlook: await personalOutlookStatus(user.userId) }),
      );
    }

    if (method === "GET" && path.includes("/outlook/connect")) {
      if (isOutlookGraphMock() || !isOutlookOAuthConfigured()) {
        if (!isOutlookOAuthConfigured() && !isOutlookGraphMock()) {
          return serviceUnavailable("Outlook OAuth is not configured");
        }
        const now = new Date().toISOString();
        const mailbox =
          (typeof user.email === "string" && user.email.toLowerCase().endsWith("@nexcortiq.us")
            ? user.email.trim().toLowerCase()
            : "sales.rep@nexcortiq.us") || "sales.rep@nexcortiq.us";
        const conn: SalesOutlookConnection = {
          agencyId: "platform",
          userId: user.userId,
          mailbox,
          mock: true,
          connectedBy: user.userId,
          connectedAt: now,
          updatedAt: now,
        };
        await putUserOutlookConnection(user.userId, conn);
        await audit(user.userId, AUDIT_EVENT_TYPES.SALES_OUTLOOK_CONNECTED, user.userId, {
          mailbox: conn.mailbox,
          mock: true,
          personal: true,
        });
        return withCorrelationHeaders(
          event,
          ok({
            connected: true,
            mock: true,
            mailbox: conn.mailbox,
            outlook: await personalOutlookStatus(user.userId),
          }),
        );
      }

      const secret = await resolveOutlookClientSecret();
      if (!secret) return serviceUnavailable("Outlook OAuth client secret is not configured");
      const state = signOutlookOAuthState(user.userId, secret);
      const loginHint =
        typeof user.email === "string" && user.email.toLowerCase().endsWith("@nexcortiq.us")
          ? user.email
          : undefined;
      return withCorrelationHeaders(
        event,
        ok({
          authorizeUrl: buildPersonalOutlookAuthorizeUrl(state, loginHint),
          mock: false,
        }),
      );
    }

    if (method === "POST" && path.includes("/outlook/callback")) {
      if (isOutlookGraphMock()) {
        return badRequest("Outlook mock mode does not use an OAuth callback");
      }
      const body = parseBody(event);
      if (body === null) return badRequest("Invalid JSON");
      const parsed = salesOutlookCallbackBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const secret = await resolveOutlookClientSecret();
      if (!secret) return serviceUnavailable("Outlook OAuth client secret is not configured");
      const verified = verifyOutlookOAuthState(parsed.data.state, secret);
      if (!verified) return badRequest("Invalid or expired Outlook OAuth state");
      if (verified.userId !== user.userId) {
        return forbidden();
      }
      try {
        const tokens = await exchangePersonalOutlookAuthCode(parsed.data.code);
        const now = new Date().toISOString();
        const conn: SalesOutlookConnection = {
          agencyId: "platform",
          userId: user.userId,
          mailbox: tokens.mailbox,
          mock: false,
          refreshTokenEnc: await encryptOutlookToken(tokens.refreshToken),
          accessTokenEnc: await encryptOutlookToken(tokens.accessToken),
          accessTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
          connectedBy: user.userId,
          connectedAt: now,
          updatedAt: now,
        };
        await putUserOutlookConnection(user.userId, conn);
        await audit(user.userId, AUDIT_EVENT_TYPES.SALES_OUTLOOK_CONNECTED, user.userId, {
          mailbox: conn.mailbox,
          mock: false,
          personal: true,
        });
        return withCorrelationHeaders(
          event,
          ok({
            connected: true,
            mock: false,
            mailbox: conn.mailbox,
            outlook: await personalOutlookStatus(user.userId),
          }),
        );
      } catch (err) {
        return badRequest(err instanceof Error ? err.message : "Outlook connect failed");
      }
    }

    if (method === "POST" && path.includes("/outlook/disconnect")) {
      const previous = await getUserOutlookConnection(user.userId);
      await deleteUserOutlookConnection(user.userId);
      await audit(user.userId, AUDIT_EVENT_TYPES.SALES_OUTLOOK_DISCONNECTED, user.userId, {
        mailbox: previous?.mailbox,
        personal: true,
      });
      return withCorrelationHeaders(
        event,
        ok({ disconnected: true, outlook: await personalOutlookStatus(user.userId) }),
      );
    }

    if (method === "POST" && path.includes("/send-email")) {
      const body = parseBody(event);
      if (body === null) return badRequest("Invalid JSON");
      const parsed = salesSendEmailRequestSchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);

      let conn = await getUserOutlookConnection(user.userId);
      if (!conn) {
        return badRequest("Connect Outlook with a @nexcortiq.us mailbox before sending");
      }

      if (conn.mock || isOutlookGraphMock()) {
        console.info(
          JSON.stringify({
            msg: "sales_personal_outlook_send_mock",
            to: parsed.data.to,
            mailbox: conn.mailbox,
            subjectChars: parsed.data.subject.length,
          }),
        );
        await audit(user.userId, AUDIT_EVENT_TYPES.SALES_EMAIL_SENT, user.userId, {
          toDomain: parsed.data.to.split("@")[1] ?? "",
          mailbox: conn.mailbox,
          mock: true,
          personal: true,
        });
        return withCorrelationHeaders(
          event,
          ok({ sent: true, mock: true, mailbox: conn.mailbox }),
        );
      }

      try {
        const ensured = await ensureOutlookAccessToken(conn);
        if (ensured.next) {
          conn = ensured.next;
          await putUserOutlookConnection(user.userId, ensured.next);
        }
        await sendOutlookMail({
          accessToken: ensured.accessToken,
          to: parsed.data.to,
          cc: parsed.data.cc ? [parsed.data.cc] : undefined,
          subject: parsed.data.subject,
          text: parsed.data.body,
          html: plainToHtml(parsed.data.body),
          fromMailbox: conn.mailbox,
          fromName: conn.mailbox,
        });
        await audit(user.userId, AUDIT_EVENT_TYPES.SALES_EMAIL_SENT, user.userId, {
          toDomain: parsed.data.to.split("@")[1] ?? "",
          mailbox: conn.mailbox,
          mock: false,
          personal: true,
        });
        return withCorrelationHeaders(
          event,
          ok({ sent: true, mock: false, mailbox: conn.mailbox }),
        );
      } catch (err) {
        console.error(
          JSON.stringify({
            msg: "sales_personal_outlook_send_failed",
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        return badRequest(err instanceof Error ? err.message : "Send failed");
      }
    }

    return notFound("Not found");
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "sales_outlook_http_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return serverError();
  }
};
