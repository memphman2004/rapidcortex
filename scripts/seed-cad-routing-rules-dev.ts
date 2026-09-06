/**
 * Seed example CAD routing rules for the dev agency.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.CAD_CONNECTORS_TABLE?.trim() || "rapid-cortex-cad-connectors-dev";
const REGION = process.env.AWS_REGION?.trim() || "us-east-1";
const AGENCY = process.env.SEED_AGENCY_ID?.trim() || "test-agency";

async function main() {
  const now = new Date().toISOString();
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        connectorId: "__agency_routing__",
        agencyId: AGENCY,
        vendorId: "generic_rest",
        displayName: "Agency routing",
        department: "combined_all",
        enabled: false,
        connectionMode: "polling",
        credentials: {
          authType: "api_key",
          secretArn: "arn:aws:secretsmanager:us-east-1:000000000000:secret:mock/cad-routing",
        },
        fieldMappings: [],
        routingRules: [
          {
            ruleId: "cadr_seed_1",
            priority: 1,
            description: "Law incidents → Law CAD",
            conditions: [{ field: "department", operator: "eq", value: "law_enforcement" }],
            targetConnectorId: "cadc_seed_law",
            requireSupervisorApproval: false,
            enabled: true,
          },
          {
            ruleId: "cadr_seed_2",
            priority: 2,
            description: "Fire → Fire CAD",
            conditions: [{ field: "department", operator: "eq", value: "fire" }],
            targetConnectorId: "cadc_seed_fire",
            requireSupervisorApproval: false,
            enabled: true,
          },
          {
            ruleId: "cadr_seed_3",
            priority: 3,
            description: "EMS → Fire CAD",
            conditions: [{ field: "department", operator: "eq", value: "ems" }],
            targetConnectorId: "cadc_seed_fire",
            requireSupervisorApproval: false,
            enabled: true,
          },
          {
            ruleId: "cadr_seed_4",
            priority: 4,
            description: "Combined fire/EMS → Fire CAD",
            conditions: [{ field: "department", operator: "eq", value: "combined_fire_ems" }],
            targetConnectorId: "cadc_seed_fire",
            requireSupervisorApproval: false,
            enabled: true,
          },
          {
            ruleId: "cadr_seed_99",
            priority: 99,
            description: "Catch-all → Law CAD with approval",
            conditions: [],
            targetConnectorId: "cadc_seed_law",
            requireSupervisorApproval: true,
            enabled: true,
          },
        ],
        createdAt: now,
        updatedAt: now,
        createdByUserId: "seed-cad-routing",
        baseUrlEncrypted: "mock:",
      },
    }),
  );
  console.log("[seed-cad-routing-rules-dev] wrote agency routing rules");
}

main().catch((error) => {
  console.error("[seed-cad-routing-rules-dev] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
