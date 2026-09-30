/**
 * Seed Camden County K-12 demo agency + full district school list (sites) +
 * buildings/zones under CAMPUS_CONFIG#CAMDEN (dashboard Zones page).
 *
 * Usage:
 *   CAMPUS_CONFIG_TABLE=rapid-cortex-campus-config-dev \
 *   AGENCIES_TABLE=rapid-cortex-agencies-dev \
 *   npx tsx apps/api/src/scripts/seed-k12-camden-demo.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { K12_ZONE_DEFAULTS } from "rapid-cortex-shared";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const AGENCY_ID = process.env.K12_DEMO_AGENCY_ID ?? "test-campus-camden";
const CAMPUS_CODE = "CAMDEN";
const NOW = new Date().toISOString();

/** Core school zones published on every campus building (subset of K12_ZONE_DEFAULTS). */
const SCHOOL_ZONE_LABELS = [
  "Main Office / Front Entrance",
  "Classroom Wing",
  "Cafeteria",
  "Gymnasium",
  "Parking Lot",
  "Bus Loading Zone",
  "Visitor Entrance",
] as const;

type GradeLevel = "es" | "ms" | "hs" | "k8" | "pk12";

type SchoolSeed = {
  code: string;
  name: string;
  shortName: string;
  gradeLevel: GradeLevel;
  alertStatus: "clear";
  activeIncidentCount: number;
  respondersOnDuty: number;
  active: boolean;
};

/** Official Camden County Schools roster (district console sites). */
const schools: SchoolSeed[] = [
  {
    code: "CCHS",
    name: "Camden County High School",
    shortName: "CCHS",
    gradeLevel: "hs",
    alertStatus: "clear",
    activeIncidentCount: 0,
    respondersOnDuty: 2,
    active: true,
  },
  {
    code: "CMS",
    name: "Camden Middle School",
    shortName: "CMS",
    gradeLevel: "ms",
    alertStatus: "clear",
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
  {
    code: "SMMS",
    name: "St. Marys Middle School",
    shortName: "SMMS",
    gradeLevel: "ms",
    alertStatus: "clear",
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
  {
    code: "CSA",
    name: "Camden Success Academy",
    shortName: "CSA",
    gradeLevel: "pk12",
    alertStatus: "clear",
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
  {
    code: "CRE",
    name: "Crooked River Elementary",
    shortName: "CRE",
    gradeLevel: "es",
    alertStatus: "clear",
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
  {
    code: "DLR",
    name: "David L. Rainer Elementary",
    shortName: "DLR",
    gradeLevel: "es",
    alertStatus: "clear",
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
  {
    code: "KES",
    name: "Kingsland Elementary",
    shortName: "KES",
    gradeLevel: "es",
    alertStatus: "clear",
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
  {
    code: "MLG",
    name: "Mamie Lou Gross Elementary",
    shortName: "MLG",
    gradeLevel: "es",
    alertStatus: "clear",
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
  {
    code: "MLC",
    name: "Mary Lee Clark Elementary",
    shortName: "MLC",
    gradeLevel: "es",
    alertStatus: "clear",
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
  {
    code: "MHE",
    name: "Matilda Harris Elementary",
    shortName: "MHE",
    gradeLevel: "es",
    alertStatus: "clear",
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
  {
    code: "SME",
    name: "St. Marys Elementary",
    shortName: "SME",
    gradeLevel: "es",
    alertStatus: "clear",
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
  {
    code: "SMELE",
    name: "Sugarmill Elementary",
    shortName: "Sugarmill",
    gradeLevel: "es",
    alertStatus: "clear",
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
  {
    code: "WBE",
    name: "Woodbine Elementary",
    shortName: "WBE",
    gradeLevel: "es",
    alertStatus: "clear",
    activeIncidentCount: 0,
    respondersOnDuty: 1,
    active: true,
  },
];

function slugZone(label: string): string {
  return label
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

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
          name: "Camden County Schools",
          institutionType: "k12",
          vertical: "campus",
          type: "campus",
          updatedAt: NOW,
          config: {
            ...(row.config ?? {}),
            campus: {
              ...(row.config?.campus ?? {}),
              campusType: "k12",
              institutionType: "k12",
              displayName: "Camden County Schools",
              timezone:
                (row.config?.campus?.timezone as string | undefined) ?? "America/New_York",
            },
          },
        },
      }),
    );
    console.log("Updated agency institutionType=k12", AGENCY_ID);
  }

  // Sites live under CAMPUS_CONFIG#{code} / SITES (same pk as buildings/zones).
  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable,
      Item: {
        pk: `CAMPUS_CONFIG#${CAMPUS_CODE}`,
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

  const configPk = `CAMPUS_CONFIG#${CAMPUS_CODE}`;
  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable,
      Item: {
        pk: configPk,
        sk: "SETTINGS",
        campusCode: CAMPUS_CODE,
        agencyId: AGENCY_ID,
        campusName: "Camden County Schools",
        institutionType: "k12",
        campusType: "k12",
        smsEnabled: true,
        qrEnabled: true,
        active: true,
        cleryEnabled: false,
        suggestedZones: [...K12_ZONE_DEFAULTS],
        createdAt: NOW,
        updatedAt: NOW,
      },
    }),
  );
  console.log("Seeded campus settings (institutionType=k12, cleryEnabled=false)");

  for (const school of schools) {
    await ddb.send(
      new PutCommand({
        TableName: campusConfigTable,
        Item: {
          pk: configPk,
          sk: `BUILDING#${school.code}`,
          id: `b-${school.code.toLowerCase()}`,
          campusCode: CAMPUS_CODE,
          agencyId: AGENCY_ID,
          code: school.code,
          label: school.name,
          type: "academic",
          floors: 2,
          capacity: null,
          cameraIds: [],
          activeIncidents: 0,
          siteCode: school.code,
          zones: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      }),
    );

    for (const [idx, label] of SCHOOL_ZONE_LABELS.entries()) {
      const zoneCode = `${school.code}-1-${slugZone(label)}`;
      await ddb.send(
        new PutCommand({
          TableName: campusConfigTable,
          Item: {
            pk: configPk,
            sk: `ZONE#${zoneCode}`,
            code: zoneCode,
            label,
            buildingCode: school.code,
            buildingLabel: school.name,
            floor: 1,
            roomCode: slugZone(label),
            cameraIds: [],
            siteCode: school.code,
            qrUrl: `https://www.rapidcortex.us/report/campus/${CAMPUS_CODE}?zone=${zoneCode}`,
            sortOrder: idx,
            createdAt: NOW,
            updatedAt: NOW,
          },
        }),
      );
    }
    console.log(`Seeded building+zones: ${school.code} — ${school.name}`);
  }

  console.log("Sign-in path: /app/campus/CAMDEN (agencyId", AGENCY_ID + ")");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
