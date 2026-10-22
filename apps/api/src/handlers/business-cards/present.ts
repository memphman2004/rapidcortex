import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { BizCardError } from "../../lib/business-cards/domain.js";
import { badRequestFromZod, serverError } from "../../lib/response.js";
import type { ZodError } from "zod";
import type { BusinessCardProfile, NFCCard } from "../../lib/business-cards/types.js";

export function readJson(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(raw) as unknown;
}

export function presentProfile(profile: BusinessCardProfile) {
  const {
    pk: _pk,
    sk: _sk,
    gsi1pk: _g1,
    gsi1sk: _g1s,
    gsi2pk: _g2,
    gsi2sk: _g2s,
    gsi3pk: _g3,
    gsi3sk: _g3s,
    ...rest
  } = profile;
  return rest;
}

export function presentCard(card: NFCCard) {
  const { pk: _pk, sk: _sk, gsi1pk: _g1, gsi1sk: _g1s, gsi2pk: _g2, gsi2sk: _g2s, ...rest } = card;
  return rest;
}

export function mapBizCardError(error: unknown): APIGatewayProxyResultV2 {
  if (error instanceof BizCardError) {
    return {
      statusCode: error.status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.code, message: error.message }),
    };
  }
  if (error instanceof SyntaxError) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "invalid_json" }),
    };
  }
  console.error(
    JSON.stringify({
      msg: "business_cards_failed",
      error: error instanceof Error ? error.name : "unknown",
    }),
  );
  return serverError();
}

export function zodFailure(error: ZodError): APIGatewayProxyResultV2 {
  return badRequestFromZod(error);
}
