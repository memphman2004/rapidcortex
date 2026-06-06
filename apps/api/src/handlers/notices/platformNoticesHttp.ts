/**
 * Platform notice dispatch — admin create/list/cancel + active notices for tenants.
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  isRcAdmin,
  isRcItAdmin,
  isRcSuperAdmin,
} from "rapid-cortex-security";
import { createNoticeInputSchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import {
  acknowledgePlatformNotice,
  cancelPlatformNotice,
  createPlatformNotice,
  listActiveNoticesForUser,
  listAdminNotices,
} from "../../services/platform-notice-service.js";

function httpMethod(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext as { http?: { method?: string } }).http?.method ?? "GET";
}

function rawPath(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return event.rawPath ?? event.requestContext.http?.path ?? "";
}

function isPlatformNoticeSender(role: string): boolean {
  return isRcSuperAdmin(role) || isRcAdmin(role) || isRcItAdmin(role);
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd);

    const method = httpMethod(event);
    const path = rawPath(event);
    const noticeId = event.pathParameters?.noticeId?.trim();

    if (path.endsWith("/ack") && method === "POST" && noticeId) {
      try {
        const result = await acknowledgePlatformNotice(noticeId, user);
        return withCorrelationHeaders(event, ok(result));
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "NOT_FOUND") return withCorrelationHeaders(event, notFound());
          if (error.message === "FORBIDDEN") return withCorrelationHeaders(event, forbidden());
        }
        throw error;
      }
    }

    if (path.endsWith("/active") && method === "GET") {
      const notices = await listActiveNoticesForUser(user);
      return withCorrelationHeaders(event, ok({ notices }));
    }

    if (path.startsWith("/api/admin/notices")) {
      if (!isPlatformNoticeSender(user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }

      if (method === "GET") {
        const targetType = event.queryStringParameters?.targetType as
          | "all"
          | "vertical"
          | "agency"
          | undefined;
        const targetAgencyId = event.queryStringParameters?.targetAgencyId?.trim();
        const notices = await listAdminNotices({ targetType, targetAgencyId });
        return withCorrelationHeaders(event, ok({ notices }));
      }

      if (method === "POST") {
        let body: unknown;
        try {
          body = JSON.parse(event.body ?? "{}");
        } catch {
          return withCorrelationHeaders(event, badRequest("Invalid JSON"));
        }
        const parsed = createNoticeInputSchema.safeParse(body);
        if (!parsed.success) {
          return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
        }
        const notice = await createPlatformNotice(parsed.data, user);
        return withCorrelationHeaders(event, ok(notice, 201));
      }

      if (method === "DELETE" && noticeId) {
        const cancelled = await cancelPlatformNotice(noticeId, user);
        if (!cancelled) return withCorrelationHeaders(event, notFound());
        return withCorrelationHeaders(event, ok({ notice: cancelled }));
      }
    }

    return withCorrelationHeaders(event, notFound());
  } catch (error) {
    console.error("[platform-notices]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
