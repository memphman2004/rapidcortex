import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { operationalPasswordBlock } from "../lib/operationalPasswordGate.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import {
  badRequest,
  forbidden,
  jsonStatus,
  ok,
  serverError,
  badRequestFromZod,
  unauthorized,
  serviceUnavailable,
} from "../lib/response.js";
import { MonetizationInvoiceRepository } from "../repositories/monetizationInvoiceRepository.js";
import { UsageMeterService } from "../services/monetization/usageMeterService.js";
import { z } from "zod";

/** Tenant billing facade (subscription snapshot + internal invoicing reads). Procurement is handled outside Rapid Cortex checkout flows. */
const auth = new AuthorizationService();
const agencies = new AgencyRepository();
const invoices = new MonetizationInvoiceRepository();
const usage = new UsageMeterService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath ?? "";

    if (method === "OPTIONS") {
      return {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "authorization,content-type",
        },
      };
    }

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const pwd = operationalPasswordBlock(user);
    if (pwd) return pwd;

    const q = event.queryStringParameters ?? {};
    const resolveAgencyId = (): string | null =>
      isRcsuperadmin(user)
        ? typeof q.agencyId === "string" && q.agencyId.trim()
          ? q.agencyId.trim()
          : (user.agencyId ?? null)
        : user.agencyId ?? null;

    if (path === "/api/billing/current-subscription" && method === "GET") {
      const agencyId = resolveAgencyId();
      if (!agencyId) return badRequest("agencyId query required when acting as RC Super Admin (rcsuperadmin)");
      if (!isRcsuperadmin(user) && user.agencyId !== agencyId) return forbidden();
      const a = await agencies.get(agencyId);
      if (!a) return jsonStatus({ error: "Agency not found" }, 404);
      return ok({
        agencyId: a.agencyId,
        planId: a.monetizationPlanId ?? a.planId,
        addOnIds: a.monetizationAddOnIds ?? [],
        billingStatus: a.billingStatus,
        subscriptionStatus: a.subscriptionStatus,
        externalBillingCustomerId: a.externalBillingCustomerId,
        externalBillingSubscriptionId: a.externalBillingSubscriptionId,
        paymentMethod: a.paymentMethod,
      });
    }

    if (path === "/api/billing/invoices" && method === "GET") {
      const agencyId = resolveAgencyId();
      if (!agencyId) return badRequest("agencyId query required when acting as RC Super Admin (rcsuperadmin)");
      if (!isRcsuperadmin(user) && user.agencyId !== agencyId) return forbidden();
      try {
        const items = await invoices.listByAgencyRecent(agencyId);
        return ok({ items });
      } catch {
        return ok({ items: [], note: "MONETIZATION_INVOICES_TABLE unavailable in this environment." });
      }
    }

    if (path === "/api/billing/usage" && method === "GET") {
      auth.assertCanPerform(user, "billing.usage_view");
      const agencyId = resolveAgencyId();
      const period = q.period;
      if (!agencyId) return badRequest("agencyId query required when acting as RC Super Admin (rcsuperadmin)");
      if (!isRcsuperadmin(user) && user.agencyId !== agencyId) return forbidden();
      const u = await usage.getUsageForBillingPeriod(agencyId, period);
      return ok({ agencyId, period: period ?? "current", usage: u });
    }

    const reportBody = z.object({
      agencyId: z.string(),
      kind: z.enum([
        "incident",
        "api_call",
        "ai_summary",
        "transcription_minutes",
        "translation_minutes",
        "media_session",
        "cad_export",
        "webhook_delivery",
      ]),
      amount: z.number().int().positive().max(1_000_000),
    });

    if (path === "/api/billing/report-usage" && method === "POST") {
      if (!isRcsuperadmin(user)) return forbidden();
      const parsed = reportBody.safeParse(
        JSON.parse(event.isBase64Encoded && event.body ? Buffer.from(event.body, "base64").toString("utf8") : event.body ?? "{}"),
      );
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const { agencyId, kind, amount } = parsed.data;
      const period = typeof q.period === "string" ? q.period : undefined;
      switch (kind) {
        case "incident":
          await usage.recordIncidentCreated(agencyId, period);
          break;
        case "api_call":
          await usage.recordApiCall(agencyId, undefined, period);
          break;
        case "ai_summary":
          await usage.recordAiSummary(agencyId, "_", period);
          break;
        case "transcription_minutes":
          await usage.recordTranscriptionMinutes(agencyId, amount, period);
          break;
        case "translation_minutes":
          await usage.recordTranslationMinutes(agencyId, amount, period);
          break;
        case "media_session":
          await usage.recordMediaSession(agencyId, "generic", period);
          break;
        case "cad_export":
          await usage.recordCadExport(agencyId, "_", period);
          break;
        case "webhook_delivery":
          await usage.recordWebhookDelivery(agencyId, "_", period);
          break;
        default:
          break;
      }
      return ok({ accepted: true });
    }

    return jsonStatus({ error: "Not found" }, 404);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = (e as Error & { statusCode?: number }).statusCode;
    if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
    if (e instanceof Error && e.message === "MONETIZATION_INVOICES_DISABLED") {
      return serviceUnavailable("Invoices table not configured");
    }
    return serverError();
  }
};
