#!/usr/bin/env npx tsx
/**
 * Re-discover Ring Appstore homeowner devices into RapidCortexRingDevices-{stage}
 * and stamp GPS at the incident map address (Ring does not provide precise GPS).
 *
 * Usage:
 *   STAGE=dev AGENCY_ID=test-agency \
 *   LAT=32.5369 LNG=-84.9274 \
 *   npx tsx scripts/resync-ring-homeowner-devices.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { RingApiClient } from "../packages/integrations/ring/dist/ring-client.js";
import { RingDeviceService } from "../packages/integrations/ring/dist/ring-devices.js";

const stage = process.env.STAGE?.trim() || "dev";
const agencyId = process.env.AGENCY_ID?.trim() || "test-agency";
const accountsTable =
  process.env.RING_TABLE_ACCOUNTS?.trim() || `RapidCortexRingAccounts-${stage}`;
const devicesTable =
  process.env.RING_TABLE_DEVICES?.trim() || `RapidCortexRingDevices-${stage}`;
const lat = Number.parseFloat(process.env.LAT ?? "32.5369");
const lng = Number.parseFloat(process.env.LNG ?? "-84.9274");

if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
  console.error("LAT and LNG must be numbers (incident map pin)");
  process.exit(1);
}

process.env.RING_TABLE_ACCOUNTS = accountsTable;
process.env.RING_TABLE_DEVICES = devicesTable;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const sm = new SecretsManagerClient({});
const devices = new RingDeviceService();

async function loadAccessToken(secretKey: string): Promise<string> {
  const out = await sm.send(new GetSecretValueCommand({ SecretId: secretKey }));
  const raw = out.SecretString;
  if (!raw) throw new Error(`Empty secret ${secretKey}`);
  const parsed = JSON.parse(raw) as { accessToken?: string; access_token?: string };
  const token = parsed.accessToken ?? parsed.access_token;
  if (!token) throw new Error(`No accessToken in ${secretKey}`);
  return token;
}

async function main(): Promise<void> {
  const accountsOut = await ddb.send(
    new ScanCommand({
      TableName: accountsTable,
      FilterExpression: "agencyId = :a AND connectionStatus = :c",
      ExpressionAttributeValues: { ":a": agencyId, ":c": "CONNECTED" },
    }),
  );
  const accounts = (accountsOut.Items ?? []).filter(
    (a) => typeof a.userId === "string" && !String(a.userId).startsWith("ring-oauth-state"),
  );
  if (accounts.length === 0) {
    console.error(JSON.stringify({ msg: "no_connected_ring_accounts", agencyId, accountsTable }));
    process.exit(1);
  }

  let totalDevices = 0;
  for (const account of accounts) {
    const userId = String(account.userId);
    const ringAccountId = String(account.ringAccountId ?? "");
    const secretKey = String(account.secretsManagerTokenKey ?? "");
    if (!ringAccountId || !secretKey) continue;

    let accessToken: string;
    try {
      accessToken = await loadAccessToken(secretKey);
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "token_load_failed",
          userId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      continue;
    }

    try {
      const client = new RingApiClient(accessToken);
      const raw = await client.getDevices();
      console.log(
        JSON.stringify({
          msg: "ring_discovery_probe",
          userId,
          discovered: raw.length,
          names: raw.map((d) => d.deviceName),
        }),
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "ring_discovery_probe_failed",
          userId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      continue;
    }

    const saved = await devices.discoverAndSaveDevices(agencyId, userId, ringAccountId, accessToken, {
      enableForConnect: true,
      fallbackLatitude: lat,
      fallbackLongitude: lng,
    });
    totalDevices += saved.length;
    console.log(
      JSON.stringify({
        msg: "saved",
        userId,
        count: saved.length,
        devices: saved.map((d) => ({
          deviceId: d.deviceId,
          deviceName: d.deviceName,
          latitude: d.latitude,
          longitude: d.longitude,
          isEnabledForConnect: d.isEnabledForConnect,
        })),
      }),
    );
  }

  const verify = await ddb.send(
    new QueryCommand({
      TableName: devicesTable,
      IndexName: "agencyId-index",
      KeyConditionExpression: "agencyId = :agencyId",
      ExpressionAttributeValues: { ":agencyId": agencyId },
    }),
  );

  console.log(
    JSON.stringify({
      msg: "done",
      agencyId,
      devicesTable,
      savedTotal: totalDevices,
      tableCount: verify.Items?.length ?? 0,
      mapPin: { lat, lng },
      hint: "Nearby search uses the incident map pin; devices must have GPS near that address.",
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
