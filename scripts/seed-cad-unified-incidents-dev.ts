/**
 * Seed 20 mock unified CAD incidents (including 2 intentional cross-CAD duplicates).
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { createHash } from "node:crypto";

const TABLE = process.env.CAD_UNIFIED_INCIDENTS_TABLE?.trim() || "rapid-cortex-cad-unified-incidents-dev";
const REGION = process.env.AWS_REGION?.trim() || "us-east-1";
const AGENCY = process.env.SEED_AGENCY_ID?.trim() || "test-agency";

function dedupeKey(address: string, type: string, received: string): string {
  const minute = Math.floor(Date.parse(received) / 60_000);
  return createHash("sha256")
    .update(`${AGENCY}|${address.toUpperCase()}|${type}|${minute}`)
    .digest("hex");
}

async function main() {
  const now = Date.now();
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const ttlEpoch = Math.floor(now / 1000) + 30 * 24 * 60 * 60;
  const types = ["ARMED ROBBERY", "STRUCTURE FIRE", "MEDICAL EMERGENCY", "TRAFFIC STOP", "WELFARE CHECK"];
  for (let i = 0; i < 18; i += 1) {
    const law = i % 2 === 0;
    const received = new Date(now - i * 120_000).toISOString();
    const address = `${100 + i} Seed Ave`;
    const incidentType = types[i % types.length]!;
    const item = {
      unifiedId: `ucad_seed_${i}`,
      agencyId: AGENCY,
      connectorId: law ? "cadc_seed_law" : "cadc_seed_fire",
      vendorId: law ? "motorola_premierone" : "tyler_new_world",
      department: law ? "law_enforcement" : "combined_fire_ems",
      vendorIncidentId: law ? `P1-${4000 + i}` : `NW-${7000 + i}`,
      vendorKey: `${law ? "cadc_seed_law" : "cadc_seed_fire"}#${law ? `P1-${4000 + i}` : `NW-${7000 + i}`}`,
      cadIncidentNumber: law ? `P1-${4000 + i}` : `NW-${7000 + i}`,
      incidentType,
      priority: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      status: i % 3 === 0 ? "on_scene" : i % 3 === 1 ? "en_route" : "dispatched",
      address,
      units: [],
      callReceivedAt: received,
      dedupeKey: dedupeKey(address, incidentType, received),
      isDuplicate: false,
      ingestedAt: received,
      lastSyncAt: received,
      schemaVersion: 1,
      ttlEpoch,
    };
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  }
  const dupReceived = new Date(now - 50_000).toISOString();
  const dupAddress = "789 Elm Blvd";
  const dupType = "MEDICAL EMERGENCY";
  const key = dedupeKey(dupAddress, dupType, dupReceived);
  const canonical = {
    unifiedId: "ucad_seed_dup_a",
    agencyId: AGENCY,
    connectorId: "cadc_seed_fire",
    vendorId: "tyler_new_world",
    department: "ems",
    vendorIncidentId: "NW-DUP",
    vendorKey: "cadc_seed_fire#NW-DUP",
    cadIncidentNumber: "NW-DUP",
    incidentType: dupType,
    priority: 2 as const,
    status: "on_scene",
    address: dupAddress,
    units: [],
    callReceivedAt: dupReceived,
    dedupeKey: key,
    isDuplicate: false,
    ingestedAt: dupReceived,
    lastSyncAt: dupReceived,
    schemaVersion: 1,
    ttlEpoch,
  };
  const duplicate = {
    ...canonical,
    unifiedId: "ucad_seed_dup_b",
    connectorId: "cadc_seed_law",
    vendorId: "motorola_premierone",
    department: "law_enforcement",
    vendorIncidentId: "P1-DUP",
    vendorKey: "cadc_seed_law#P1-DUP",
    cadIncidentNumber: "P1-DUP",
    isDuplicate: true,
    canonicalUnifiedId: "ucad_seed_dup_a",
    status: "duplicate",
  };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: canonical }));
  await ddb.send(new PutCommand({ TableName: TABLE, Item: duplicate }));
  console.log("[seed-cad-unified-incidents-dev] wrote 20 incidents");
}

main().catch((error) => {
  console.error("[seed-cad-unified-incidents-dev] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
