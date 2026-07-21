/**
 * Marketing Unsubscribe
 * Route: POST /api/marketing/unsubscribe (public, token-authenticated)
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { marketingUnsubscribeBodySchema } from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";
import { env } from "../lib/env.js";

const CORS = {
  "Access-Control-Allow-Origin": "https://www.rapidcortex.us",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function json(body: object, statusCode = 200) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (event.requestContext.http.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!env.enableInsideTheCortex) {
    return json({ error: "Feature is not available" }, 503);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(event.body ?? "{}");
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = marketingUnsubscribeBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request";
    return json({ error: msg }, 400);
  }

  const token = parsed.data.token;
  const table = env.marketingLeadsTable;
  if (!table) {
    console.error(JSON.stringify({ msg: "marketing_unsub_error", error: "MARKETING_LEADS_TABLE not set" }));
    return json({ error: "Service unavailable" }, 500);
  }

  let email: string;
  try {
    const tokenRecord = await ddb.send(
      new GetCommand({
        TableName: table,
        Key: { pk: `TOKEN#${token}`, sk: "UNSUBSCRIBE" },
      }),
    );

    if (!tokenRecord.Item) {
      return json({ success: true });
    }

    email = String(tokenRecord.Item["email"] ?? "");
    if (!email) return json({ success: true });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "marketing_unsub_token_lookup_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return json({ error: "Failed to process unsubscribe" }, 500);
  }

  try {
    await ddb.send(
      new UpdateCommand({
        TableName: table,
        Key: { pk: `LEAD#${email}`, sk: "PROFILE" },
        UpdateExpression: "SET #status = :unsub, unsubscribedAt = :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":unsub": "unsubscribed",
          ":now": new Date().toISOString(),
        },
        ConditionExpression: "attribute_exists(pk)",
      }),
    );
  } catch (err: unknown) {
    if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
      return json({ success: true });
    }
    console.error(
      JSON.stringify({
        msg: "marketing_unsub_update_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return json({ error: "Failed to process unsubscribe" }, 500);
  }

  console.info(JSON.stringify({ msg: "marketing_lead_unsubscribed" }));
  return json({ success: true });
};
