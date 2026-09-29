/**
 * Seed Camden County K-12 demo agency + district schools (sites).
 *
 * Usage:
 *   CAMPUS_CONFIG_TABLE=rapid-cortex-campus-config-dev \
 *   AGENCIES_TABLE=rapid-cortex-agencies-dev \
 *   npx tsx apps/api/src/scripts/seed-k12-camden-demo.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const AGENCY_ID = process.env.K12_DEMO_AGENCY_ID ?? "test-campus-camden";
const CAMPUS_CODE = "CAMDEN";
const NOW = new Date().toISOString();

const schools = [
  {
    code: "CCHS",
    name: "Camden County High School",
    shortName: "CCHS",
    gradeLevel: "hs" as const,
    alertStatus: "clear" as const,
    activeIncidentCount: 0,
    respondersOnDuty: 2,
    active: true,
  },
  {
    code: "CCMS",
    name: "Camden County Middle School",
    shortName: "CCMS",
    gradeLevel: "ms" as const,
    alertStatus: "clear" as const,
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
  {
    code: "KES",
    name: "Kingsland Elementary",
    shortName: "KES",
    gradeLevel: "es" as const,
    alertStatus: "clear" as const,
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
  {
    code: "SME",
    name: "St. Marys Elementary",
    shortName: "SME",
    gradeLevel: "es" as const,
    alertStatus: "clear" as const,
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
];

async function main() {
  const agenciesTable = process.env.AGENCIES_TABLE?.trim();
  const campusConfigTable = process.env.CAMPUS_CONFIG_TABLE?.trim();
  if (!agenciesTable || !campusConfigTable) {
    throw new Error("AGENCIES_TABLE and CAMPUS_CONFIG_TABLE are required");
  }

  const existing = await ddb.send(
    new GetCommand({ TableName: agenciesTable, Key: { agencyId: AGENCY_ID } }),
  );

  if (!existing.Item) {
    await ddb.send(
      new PutCommand({
        TableName: agenciesTable,
        Item: {
          agencyId: AGENCY_ID,
          name: "Camden County Schools",
          type: "campus",
          vertical: "campus",
          institutionType: "k12",
          status: "active",
          state: "GA",
          region: "southeast",
          primaryContactName: "Campus Demo",
          primaryContactEmail: "camden-admin@appsondemand.net",
          deploymentMode: "side_by_side",
          protocolPackId: "default",
          retentionPolicyId: "default",
          integrationMode: "standalone",
          createdAt: NOW,
          updatedAt: NOW,
          createdByUserId: "seed-k12-camden-demo",
          config: {
            campus: {
              displayName: "Camden County Schools",
              campusType: "k12",
              institutionType: "k12",
              timezone: "America/New_York",
            },
          },
        },
      }),
    );
    console.log("Created agency", AGENCY_ID);
  } else {
    const row = existing.Item as {
      config?: { campus?: Record<string, unknown> };
      [key: string]: unknown;
    };
    await ddb.send(
      new PutCommand({
        TableName: agenciesTable,
        Item: {
          ...row,
          institutionType: "k12",
          updatedAt: NOW,
          config: {
            ...(row.config ?? {}),
            campus: {
              ...(row.config?.campus ?? {}),
              campusType: "k12",
              institutionType: "k12",
              displayName:
                (row.config?.campus?.displayName as string | undefined) ??
                "Camden County Schools",
              timezone:
                (row.config?.campus?.timezone as string | undefined) ?? "America/New_York",
            },
          },
        },
      }),
    );
    console.log("Updated agency institutionType=k12", AGENCY_ID);
  }

  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable,
      Item: {
        pk: `CAMPUS#${CAMPUS_CODE}`,
        sk: "SITES",
        agencyId: AGENCY_ID,
        campusCode: CAMPUS_CODE,
        sites: schools,
        updatedAt: NOW,
        updatedBy: "seed-k12-camden-demo",
      },
    }),
  );
  console.log("Seeded", schools.length, "district schools for", CAMPUS_CODE);
  console.log("Sign-in path: /app/campus/CAMDEN (agencyId", AGENCY_ID + ")");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
