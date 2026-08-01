#!/usr/bin/env npx tsx
/**
 * Set callerLocationLat/Lng on an existing incident so Ring nearby search unlocks.
 *
 * Defaults match Ring homeowner device fallback GPS (Columbus GA / Sonoma Pointe pilot):
 *   LAT=32.5369 LNG=-84.9274
 *
 * Flow: incident address → map pin coordinates → proximity search → eligible Ring cameras.
 *
 * Usage:
 *   AWS_PROFILE=rapid-cortex STAGE=dev \
 *   INCIDENT_ID=inc_… \
 *   npx tsx scripts/set-incident-caller-gps.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const stage = process.env.STAGE?.trim() || "dev";
const incidentId = process.env.INCIDENT_ID?.trim();
const table = process.env.INCIDENTS_TABLE?.trim() || `rapid-cortex-incidents-${stage}`;
const lat = Number.parseFloat(process.env.LAT ?? "32.5369");
const lng = Number.parseFloat(process.env.LNG ?? "-84.9274");
const mapLabel = process.env.MAP_LABEL?.trim() || "seed:columbus-ga-sonoma-pointe";

if (!incidentId) {
  console.error("INCIDENT_ID is required");
  process.exit(1);
}
if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
  console.error("LAT and LNG must be numbers");
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

async function main(): Promise<void> {
  const existing = await ddb.send(new GetCommand({ TableName: table, Key: { incidentId } }));
  if (!existing.Item) {
    console.error(JSON.stringify({ msg: "incident_not_found", incidentId, table }));
    process.exit(1);
  }

  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: table,
      Key: { incidentId },
      UpdateExpression:
        "SET callerLocationLat = :lat, callerLocationLng = :lng, callerLocationMapLabel = :ml, cadCoordinates = :cc, updatedAt = :u",
      ExpressionAttributeValues: {
        ":lat": lat,
        ":lng": lng,
        ":ml": mapLabel,
        ":cc": { lat, lng },
        ":u": now,
      },
    }),
  );

  console.log(
    JSON.stringify({
      msg: "updated",
      incidentId,
      table,
      callerLocationLat: lat,
      callerLocationLng: lng,
      title: existing.Item.title,
      agencyId: existing.Item.agencyId,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
