/**
 * Insert the first-tenant KCPD directory row (`agencyId: kcpd`) so RC agency
 * switchers can select the Call Assist tenant already keyed in
 * `rapid-cortex-call-assist-dev`. Does not rewrite Call Assist config or DIDs.
 *
 *   AGENCIES_TABLE=rapid-cortex-agencies-dev npx tsx scripts/seed-kcpd-agency-dev.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { defaultAgencyNetworkPolicy } from "rapid-cortex-shared";

const TABLE = process.env.AGENCIES_TABLE?.trim() || "rapid-cortex-agencies-dev";
const REGION = process.env.AWS_REGION?.trim() || "us-east-1";
const AGENCY_ID = "kcpd";

async function main() {
  const now = new Date().toISOString();
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  const existing = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { agencyId: AGENCY_ID },
    }),
  );
  if (existing.Item && process.env.FORCE !== "1") {
    console.log(`[seed-kcpd-agency-dev] ${AGENCY_ID} already exists in ${TABLE}; skip (FORCE=1 to replace)`);
    return;
  }

  const networkPolicy = defaultAgencyNetworkPolicy("seed-kcpd-agency");
  networkPolicy.shiftSchedule.timezone = "America/Chicago";

  const item = {
    agencyId: AGENCY_ID,
    name: "Kansas City Missouri Police Department",
    type: "city" as const,
    status: "active" as const,
    vertical: "core" as const,
    state: "MO",
    city: "Kansas City",
    centerName: "KCPD",
    region: "Midwest",
    primaryContactName: "KCPD Demo",
    primaryContactEmail: "rcadmin@rapidcortex.us",
    deploymentMode: "side_by_side" as const,
    protocolPackId: "default",
    retentionPolicyId: "mo-sunshine-default",
    integrationMode: "mock_adapters" as const,
    createdAt: existing.Item?.createdAt ?? now,
    updatedAt: now,
    createdByUserId: "seed-kcpd-agency",
    monetizationPlanId: "command",
    subscriptionStatus: "active" as const,
    planId: "command",
    latitude: 39.0997,
    longitude: -94.5786,
    addons: [] as string[],
    planTier: "command" as const,
    pilotMode: true,
    config: {
      agencyId: AGENCY_ID,
      protocolPackId: "default",
      aiProviderProfileId: "default",
      retentionPolicyId: "mo-sunshine-default",
      integrationMode: "mock_adapters" as const,
      transcriptRedactionEnabled: true,
      auditExportEnabled: false,
      environmentFlags: {},
      triage: {
        enabled: true,
        nonEmergencyQueueEnabled: true,
      },
      supervisorEscalationRules: {},
      createdAt: existing.Item?.createdAt ?? now,
      updatedAt: now,
    },
    networkPolicy,
  };

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: item,
    }),
  );
  console.log(`[seed-kcpd-agency-dev] Wrote ${AGENCY_ID} to ${TABLE}`);
}

main().catch((error) => {
  console.error("[seed-kcpd-agency-dev] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
