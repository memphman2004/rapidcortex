import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { serverError } from "../../lib/response.js";
import { routeInboundSms } from "../../services/smsInboundRouter.js";

function twiml(message: string) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/xml" },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>${message}</Message></Response>`,
  };
}

function emptyTwiml() {
  return twiml("");
}

function paramsFromBody(body: string | undefined): URLSearchParams {
  return new URLSearchParams(body ?? "");
}

function recordToMap(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const params = paramsFromBody(event.body);
    const rawBody = params.get("Body")?.trim() ?? "";
    const callerPhone = params.get("From") ?? "";
    const toPhone = params.get("To") ?? "";

    if (!rawBody) return withCorrelationHeaders(event, emptyTwiml());

    await routeInboundSms({
      toPhone,
      callerPhone,
      rawBody,
      inboundParams: recordToMap(params),
    });

    return withCorrelationHeaders(event, emptyTwiml());
  } catch (err) {
    console.error("[venue-sms-inbound]", err);
    return withCorrelationHeaders(event, serverError());
  }
};
