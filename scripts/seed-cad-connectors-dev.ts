/**
 * Seed two mock CAD connector configs for local/dev UI work.
 * Never uses real credentials.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.CAD_CONNECTORS_TABLE?.trim() || "rapid-cortex-cad-connectors-dev";
const REGION = process.env.AWS_REGION?.trim() || "us-east-1";
const AGENCY = process.env.SEED_AGENCY_ID?.trim() || "test-agency";

async function main() {
  const now = new Date().toISOString();
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const mockArn = "arn:aws:secretsmanager:us-east-1:000000000000:secret:mock/cad-credentials";
  const rows = [
    {
      connectorId: "cadc_seed_law",
      agencyId: AGENCY,
      vendorId: "motorola_premierone",
      displayName: "Law Enforcement CAD",
      department: "law_enforcement",
      enabled: true,
      connectionMode: "polling",
      pollingIntervalSeconds: 60,
      credentials: { authType: "api_key", secretArn: mockArn },
      fieldMappings: [],
      routingRules: [],
      createdAt: now,
      updatedAt: now,
      createdByUserId: "seed-cad-connectors",
      baseUrlEncrypted: `mock:${Buffer.from("https://cad-law.example.local", "utf8").toString("base64")}`,
      lastHealthCheck: { connectorId: "cadc_seed_law", status: "healthy", checkedAt: now },
    },
    {
      connectorId: "cadc_seed_fire",
      agencyId: AGENCY,
      vendorId: "tyler_new_world",
      displayName: "Fire/EMS CAD",
      department: "combined_fire_ems",
      enabled: true,
      connectionMode: "polling",
      pollingIntervalSeconds: 90,
      credentials: { authType: "basic", secretArn: mockArn },
      fieldMappings: [],
      routingRules: [],
      createdAt: now,
      updatedAt: now,
      createdByUserId: "seed-cad-connectors",
      baseUrlEncrypted: `mock:${Buffer.from("https://cad-fire.example.local", "utf8").toString("base64")}`,
      lastHealthCheck: { connectorId: "cadc_seed_fire", status: "healthy", checkedAt: now },
    },
  ];
  for (const item of rows) {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    console.log(`[seed-cad-connectors-dev] upserted ${item.connectorId}`);
  }
}

main().catch((error) => {
  console.error("[seed-cad-connectors-dev] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
