/**
 * Assign an agency its own outbound SMS sender (dev).
 *
 *   STAGE=dev AGENCY_ID=test-agency PHONE_NUMBER=+14707482763 \
 *     npx tsx scripts/seed-agency-sms-sender-dev.ts
 *
 * The number must already belong to the Twilio Messaging Service pool, otherwise Twilio
 * rejects the send with 21606.
 *
 * `vertical` is deliberately "911": the same table drives inbound routing, where "campus" and
 * "venue" hand replies to those intake parsers. "911" keeps inbound replies logged as unrouted,
 * which is the current behavior for this number.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { SmsRoutingRecord } from "rapid-cortex-shared";

const REGION = process.env.AWS_REGION?.trim() || "us-east-1";
const STAGE = process.env.STAGE?.trim() || "dev";
const TABLE = process.env.SMS_ROUTING_TABLE?.trim() || `rapid-cortex-sms-routing-${STAGE}`;
const AGENCY_ID = process.env.AGENCY_ID?.trim() || "test-agency";
const AGENCY_NAME = process.env.AGENCY_NAME?.trim() || "Rapid Cortex Test Agency";
const PHONE_NUMBER = process.env.PHONE_NUMBER?.trim() || "+14707482763";
const LABEL = process.env.LABEL?.trim() || "Primary 10DLC sender";

function assertE164(value: string): void {
  if (!/^\+[1-9]\d{7,14}$/.test(value)) {
    throw new Error(`PHONE_NUMBER must be E.164 (e.g. +14707482763), got: ${value}`);
  }
}

async function main() {
  assertE164(PHONE_NUMBER);
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  const existing = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { phoneNumber: PHONE_NUMBER } }),
  );
  const prior = existing.Item as SmsRoutingRecord | undefined;
  if (prior && prior.agencyId !== AGENCY_ID) {
    throw new Error(
      `${PHONE_NUMBER} is already assigned to agency "${prior.agencyId}". ` +
        "Deactivate that record before reassigning, or one tenant will send as another.",
    );
  }

  const now = new Date().toISOString();
  const record: SmsRoutingRecord = {
    phoneNumber: PHONE_NUMBER,
    agencyId: AGENCY_ID,
    vertical: "911",
    agencyName: AGENCY_NAME,
    label: LABEL,
    active: true,
    createdAt: prior?.createdAt ?? now,
    createdBy: prior?.createdBy ?? "seed-agency-sms-sender",
    updatedAt: now,
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: record }));
  console.log(
    JSON.stringify(
      { msg: prior ? "updated" : "created", table: TABLE, ...record },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    "[seed-agency-sms-sender-dev] failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
