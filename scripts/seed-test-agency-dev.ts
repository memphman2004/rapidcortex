/**
 * Re-create the dev `test-agency` tenant row after data-layer table resets.
 * Cognito QA users use custom:agencyId=test-agency (see scripts/seed-role-test-users.ts).
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { defaultAgencyNetworkPolicy } from "rapid-cortex-shared";

const TABLE = process.env.AGENCIES_TABLE?.trim() || "rapid-cortex-agencies-dev";
const REGION = process.env.AWS_REGION?.trim() || "us-east-1";

async function main() {
  const now = new Date().toISOString();
  const agencyId = "test-agency";
  const item = {
    agencyId,
    name: "Rapid Cortex Test Agency",
    type: "pilot" as const,
    status: "active" as const,
    state: "GA",
    region: "Development",
    primaryContactName: "Test Admin",
    primaryContactEmail: "admin@appsondemand.net",
    deploymentMode: "side_by_side" as const,
    protocolPackId: "default",
    retentionPolicyId: "cjis-default-v1",
    integrationMode: "mock_adapters" as const,
    createdAt: now,
    updatedAt: now,
    createdByUserId: "seed-test-agency",
    monetizationPlanId: "essential",
    subscriptionStatus: "active" as const,
    planId: "essential",
    config: {
      agencyId,
      protocolPackId: "default",
      aiProviderProfileId: "default",
      retentionPolicyId: "cjis-default-v1",
      integrationMode: "mock_adapters" as const,
      transcriptRedactionEnabled: true,
      auditExportEnabled: false,
      environmentFlags: {},
      supervisorEscalationRules: {},
      createdAt: now,
      updatedAt: now,
    },
    networkPolicy: defaultAgencyNetworkPolicy("seed-test-agency"),
  };

  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(agencyId)",
      }),
    );
    console.log(`[seed-test-agency-dev] Created ${agencyId} in ${TABLE}`);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ConditionalCheckFailedException"
    ) {
      await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
      console.log(`[seed-test-agency-dev] Updated existing ${agencyId} in ${TABLE}`);
    } else {
      throw error;
    }
  }
}

main().catch((error) => {
  console.error("[seed-test-agency-dev] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
