import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../../lib/env.js";
import { ringJson } from "./ring-api-response.js";
import { consumeRingPublicOAuthRateSlot } from "./ring-consent-rate-limit.js";

/** Closed enum of valid US state + DC codes. */
const VALID_STATE_CODES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY",
]);

const PUBLIC_STATE_INDEX = "publicState-index";

function clientIp(event: { requestContext?: { http?: { sourceIp?: string } } }): string {
  return event.requestContext?.http?.sourceIp?.trim() || "unknown";
}

function emptyAgenciesResponse(statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
    body: JSON.stringify({ agencies: [] as const }),
  };
}

/**
 * Public agency directory by US state for Ring device-owner enrollment.
 * Empty list is success — never treat "no agencies" as an error.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const allowed = await consumeRingPublicOAuthRateSlot(clientIp(event));
    if (!allowed) {
      return ringJson({ success: false, error: "Too many requests." }, 429);
    }

    const rawState = event.queryStringParameters?.state?.trim().toUpperCase() ?? "";
    if (!rawState || !VALID_STATE_CODES.has(rawState)) {
      return ringJson({ success: false, error: "Invalid or missing state code." }, 400);
    }

    const table = env.agenciesTable;
    const res = await ddb.send(
      new QueryCommand({
        TableName: table,
        IndexName: PUBLIC_STATE_INDEX,
        KeyConditionExpression: "publicState = :state",
        FilterExpression: "publicDirectoryOptIn = :true",
        ExpressionAttributeValues: {
          ":state": rawState,
          ":true": true,
        },
        ProjectionExpression: "agencyId, publicDisplayName, publicCity",
      }),
    );

    const agencies = (res.Items ?? [])
      .map((item) => ({
        agencyId: String(item.agencyId ?? ""),
        name: String(item.publicDisplayName ?? ""),
        city: String(item.publicCity ?? ""),
      }))
      .filter((a) => a.agencyId && a.name);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify({ agencies }),
    };
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_public_agencies_by_state_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    // Soft-fail: enrollment must not hard-block when the directory is unavailable.
    return emptyAgenciesResponse(200);
  }
};
