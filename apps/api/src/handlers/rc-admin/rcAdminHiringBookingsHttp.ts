/**
 * RC Admin hiring Bookings settings — GET/PUT /api/rc-admin/settings/hiring-bookings
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { canAccessRcFinancePortal, HiringBookingsConfigSchema, normalizeHiringBookingsConfig } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import {
  badRequestFromZod,
  forbidden,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { PlatformSettingsRepository } from "../../repositories/platformSettingsRepository.js";

const repo = new PlatformSettingsRepository();

function method(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext as { http?: { method?: string } }).http?.method ?? "GET";
}

function parseBody(event: Parameters<APIGatewayProxyHandlerV2>[0]): unknown {
  try {
    const raw =
      event.isBase64Encoded && event.body
        ? Buffer.from(event.body, "base64").toString("utf8")
        : (event.body ?? "{}");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return withCorrelationHeaders(event, unauthorized());
  if (!isUserAccountActive(user)) {
    return withCorrelationHeaders(event, forbidden(ACCOUNT_INACTIVE_MESSAGE));
  }
  if (!canAccessRcFinancePortal(user.role) || !env.enableHiring) {
    return withCorrelationHeaders(event, forbidden());
  }
  if (!env.platformSettingsTable) {
    return withCorrelationHeaders(event, serverError("PLATFORM_SETTINGS_TABLE not set"));
  }

  const m = method(event);

  try {
    if (m === "GET") {
      const cfg = await repo.getHiringBookings();
      return withCorrelationHeaders(event, ok(cfg));
    }

    if (m === "PUT" || m === "PATCH") {
      const raw = parseBody(event);
      if (raw === null) {
        return withCorrelationHeaders(event, {
          statusCode: 400,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ error: "Invalid JSON" }),
        });
      }
      const parsed = HiringBookingsConfigSchema.safeParse(raw);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const normalized = normalizeHiringBookingsConfig(parsed.data);
      if (!normalized.ok) {
        return withCorrelationHeaders(event, {
          statusCode: 400,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ error: normalized.error }),
        });
      }
      await repo.putHiringBookings(normalized.value);
      return withCorrelationHeaders(event, ok({ ok: true, ...normalized.value }));
    }

    return withCorrelationHeaders(event, {
      statusCode: 405,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "hiring_bookings_settings_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return withCorrelationHeaders(event, serverError());
  }
};
