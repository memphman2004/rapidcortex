import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { ok, serverError } from "../../lib/response.js";
import { routeInboundSms } from "../../services/smsInboundRouter.js";

function paramsFromBody(body: string | undefined): URLSearchParams {
  return new URLSearchParams(body ?? "");
}

function recordToMap(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

function fieldsFromEvent(body: string | undefined): {
  rawBody: string;
  callerPhone: string;
  toPhone: string;
  inboundParams: Record<string, string>;
} {
  const trimmed = body?.trim() ?? "";
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const callerPhone = String(parsed.From ?? parsed.originationNumber ?? parsed.callerPhone ?? "");
      const toPhone = String(parsed.To ?? parsed.destinationNumber ?? parsed.toPhone ?? "");
      const rawBody = String(parsed.Body ?? parsed.messageBody ?? parsed.rawBody ?? "").trim();
      const inboundParams: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") inboundParams[k] = v;
      }
      inboundParams.From = callerPhone;
      inboundParams.To = toPhone;
      inboundParams.Body = rawBody;
      inboundParams.Provider = inboundParams.Provider ?? "aws";
      return { rawBody, callerPhone, toPhone, inboundParams };
    } catch {
      // fall through to form-urlencoded
    }
  }
  const params = paramsFromBody(body);
  return {
    rawBody: params.get("Body")?.trim() ?? "",
    callerPhone: params.get("From") ?? "",
    toPhone: params.get("To") ?? "",
    inboundParams: recordToMap(params),
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const { rawBody, callerPhone, toPhone, inboundParams } = fieldsFromEvent(event.body);

    if (!rawBody) return withCorrelationHeaders(event, ok({ ok: true, skipped: true }));

    await routeInboundSms({
      toPhone,
      callerPhone,
      rawBody,
      inboundParams,
    });

    return withCorrelationHeaders(event, ok({ ok: true }));
  } catch (err) {
    console.error("[venue-sms-inbound]", err);
    return withCorrelationHeaders(event, serverError());
  }
};
