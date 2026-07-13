#!/usr/bin/env npx tsx
/**
 * Set GPS + isEnabledForConnect on Ring devices for the Sonoma Point / Columbus pilot.
 *
 * Usage:
 *   STAGE=dev AGENCY_ID=test-agency \\
 *   LAT=40.06425 LNG=-83.01975 \\
 *   npx tsx scripts/seed-ring-sonoma-point-gps.ts
 *
 * Optional DEVICE_NAME_CONTAINS=Living to target Jeff's Living Room camera only.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const stage = process.env.STAGE?.trim() || "dev";
const agencyId = process.env.AGENCY_ID?.trim() || "test-agency";
const table =
  process.env.RING_TABLE_DEVICES?.trim() || `RapidCortexRingDevices-${stage}`;
const lat = Number.parseFloat(process.env.LAT ?? "40.06425");
const lng = Number.parseFloat(process.env.LNG ?? "-83.01975");
const nameFilter = process.env.DEVICE_NAME_CONTAINS?.trim().toLowerCase() ?? "";

if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
  console.error("LAT and LNG must be numbers");
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

async function main(): Promise<void> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: table,
      IndexName: "agencyId-index",
      KeyConditionExpression: "agencyId = :agencyId",
      ExpressionAttributeValues: { ":agencyId": agencyId },
    }),
  );

  const items = out.Items ?? [];
  let updated = 0;
  for (const item of items) {
    const deviceName = String(item.deviceName ?? "");
    if (nameFilter && !deviceName.toLowerCase().includes(nameFilter)) continue;
    const agencyUserKey = String(item.agencyUserKey ?? "");
    const deviceId = String(item.deviceId ?? "");
    if (!agencyUserKey || !deviceId) continue;

    await ddb.send(
      new UpdateCommand({
        TableName: table,
        Key: { agencyUserKey, deviceId },
        UpdateExpression:
          "SET latitude = :lat, longitude = :lng, isEnabledForConnect = :enabled, updatedAt = :ts",
        ExpressionAttributeValues: {
          ":lat": lat,
          ":lng": lng,
          ":enabled": true,
          ":ts": new Date().toISOString(),
          ":agencyId": agencyId,
        },
        ConditionExpression: "agencyId = :agencyId",
      }),
    );
    updated += 1;
    console.log(
      JSON.stringify({
        msg: "updated",
        deviceId,
        deviceName,
        latitude: lat,
        longitude: lng,
        isEnabledForConnect: true,
      }),
    );
  }

  console.log(JSON.stringify({ msg: "done", agencyId, table, matched: items.length, updated }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
