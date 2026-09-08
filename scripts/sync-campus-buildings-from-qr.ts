/**
 * Replace seeded UGA demo buildings with live Field QR/NFC report codes.
 *
 *   AWS_PROFILE=rapid-cortex \
 *   CAMPUS_CONFIG_TABLE=rapid-cortex-campus-config-dev \
 *   QR_NFC_CODES_TABLE=rapid-cortex-qr-nfc-codes-dev \
 *   QR_LOCATIONS_TABLE=rapid-cortex-qr-locations-dev \
 *   AGENCY_ID=test-campus-uga \
 *   npx tsx scripts/sync-campus-buildings-from-qr.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { campusCodeFromAgencyId } from "../apps/api/src/handlers/vertical/agency-id.js";
import {
  deleteCampusDemoFixtureBuildings,
  upsertCampusBuildingFromQr,
} from "../apps/api/src/campus/campus-building-from-qr.js";
import type { QRNFCRecord } from "rapid-cortex-shared";

const REGION = process.env.AWS_REGION?.trim() || "us-east-1";
const AGENCY_ID = process.env.AGENCY_ID?.trim() || "test-campus-uga";
const QR_TABLE = process.env.QR_NFC_CODES_TABLE?.trim() || "rapid-cortex-qr-nfc-codes-dev";
const RCLI_TABLE = process.env.QR_LOCATIONS_TABLE?.trim() || "";
const SEED_RCLI = new Set(["RCLI-UGA-000001", "RCLI-UGA-000002", "RCLI-UGA-000003"]);

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

async function listCampusQrCodes(agencyId: string): Promise<QRNFCRecord[]> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: QR_TABLE,
      KeyConditionExpression: "agencyId = :agencyId",
      ExpressionAttributeValues: { ":agencyId": agencyId },
    }),
  );
  return ((out.Items ?? []) as QRNFCRecord[]).filter((row) => row.vertical === "campus");
}

async function deactivateSeedRcliLocations(): Promise<string[]> {
  if (!RCLI_TABLE) return [];
  const now = new Date().toISOString();
  const deactivated: string[] = [];
  for (const rcli of SEED_RCLI) {
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: RCLI_TABLE,
          Key: { rcli },
          UpdateExpression: "SET active = :off, updatedAt = :now, deactivatedReason = :reason",
          ConditionExpression: "agencyId = :agencyId",
          ExpressionAttributeValues: {
            ":off": false,
            ":now": now,
            ":reason": "demo-catalog-not-live-field-codes",
            ":agencyId": AGENCY_ID,
          },
        }),
      );
      deactivated.push(rcli);
    } catch (err) {
      const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
      if (name === "ConditionalCheckFailedException") continue;
      throw err;
    }
  }
  return deactivated;
}

async function main(): Promise<void> {
  if (!process.env.CAMPUS_CONFIG_TABLE?.trim()) {
    throw new Error("CAMPUS_CONFIG_TABLE is required");
  }
  const campusCode = campusCodeFromAgencyId(AGENCY_ID);
  const codes = await listCampusQrCodes(AGENCY_ID);
  if (codes.length === 0) {
    throw new Error(`No campus QR/NFC codes for ${AGENCY_ID}`);
  }

  const removed = await deleteCampusDemoFixtureBuildings(campusCode);
  for (const record of codes) {
    await upsertCampusBuildingFromQr(record);
    console.log(`Synced building from QR: ${record.name.trim()} (${record.qrId})`);
  }
  const deactivated = await deactivateSeedRcliLocations();
  console.log(
    JSON.stringify(
      {
        agencyId: AGENCY_ID,
        campusCode,
        qrCodes: codes.map((c) => c.name.trim()),
        removedDemoKeys: removed,
        deactivatedSeedRcli: deactivated,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
