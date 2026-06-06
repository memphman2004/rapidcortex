/**
 * Seeds UGA campus config/buildings/zones into CAMPUS_CONFIG_TABLE.
 * Usage:
 *   npx tsx apps/api/src/scripts/seed-campus-test-agency.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
type ZoneSeed = { floor: number; roomCode: string; cameraIds?: string[] };
type BuildingSeed = {
  id: string;
  code: string;
  name: string;
  type: "academic" | "residential" | "dining" | "athletic" | "administrative" | "outdoor";
  floors: number;
  capacity?: number;
  cameraIds?: string[];
  zones: ZoneSeed[];
};

type CampusSeed = { name: string; buildings: BuildingSeed[] };

const fixturesCampusByCode: Record<string, CampusSeed> = {
  UGA: {
    name: "University of Georgia",
    buildings: [
      {
        id: "b-mlc",
        code: "MLC",
        name: "Miller Learning Center",
        type: "academic",
        floors: 4,
        capacity: 2200,
        cameraIds: ["CAM-MLC-01", "CAM-MLC-02"],
        zones: [
          { floor: 1, roomCode: "101", cameraIds: ["CAM-MLC-01"] },
          { floor: 2, roomCode: "214", cameraIds: ["CAM-MLC-02"] },
        ],
      },
      {
        id: "b-myers",
        code: "MYERS",
        name: "Myers Hall",
        type: "residential",
        floors: 8,
        capacity: 900,
        cameraIds: ["CAM-MYR-01"],
        zones: [
          { floor: 2, roomCode: "204", cameraIds: ["CAM-MYR-01"] },
          { floor: 3, roomCode: "302", cameraIds: ["CAM-MYR-01"] },
        ],
      },
      {
        id: "b-tate",
        code: "TATE",
        name: "Tate Student Center",
        type: "dining",
        floors: 3,
        capacity: 1400,
        cameraIds: ["CAM-TATE-01"],
        zones: [{ floor: 1, roomCode: "FoodCourt", cameraIds: ["CAM-TATE-01"] }],
      },
    ],
  },
};


const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function tableName(): string {
  const t = process.env.CAMPUS_CONFIG_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_CONFIG_TABLE not set");
  return t;
}

async function put(item: Record<string, unknown>): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: item,
    }),
  );
}

async function seedCampus(campusCode = "UGA"): Promise<void> {
  const fixture = fixturesCampusByCode[campusCode];
  if (!fixture) throw new Error(`No fixture for campus ${campusCode}`);

  const pk = `CAMPUS_CONFIG#${campusCode}`;

  await put({
    pk,
    sk: "SETTINGS",
    campusCode,
    campusName: fixture.name,
    smsEnabled: true,
    qrEnabled: true,
    active: true,
    cleryEnabled: true,
    cleryAcademicYear: "2026-2027",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log(`Seeded campus settings: ${campusCode}`);

  for (const building of fixture.buildings) {
    await put({
      pk,
      sk: `BUILDING#${building.code}`,
      id: building.id,
      campusCode,
      code: building.code,
      label: building.name,
      type: building.type,
      floors: building.floors,
      capacity: building.capacity ?? null,
      cameraIds: building.cameraIds ?? [],
      activeIncidents: 0,
      zones: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`Seeded building: ${building.code}`);

    for (const zone of building.zones) {
      const zoneCode = `${building.code}-${zone.floor}-${zone.roomCode}`.replace(/\s+/g, "-").toUpperCase();
      await put({
        pk,
        sk: `ZONE#${zoneCode}`,
        code: zoneCode,
        label: `${building.name} Floor ${zone.floor} Room ${zone.roomCode}`,
        buildingCode: building.code,
        buildingLabel: building.name,
        floor: zone.floor,
        roomCode: zone.roomCode,
        cameraIds: zone.cameraIds ?? [],
        qrUrl: `https://www.rapidcortex.us/report/campus/${campusCode}?zone=${zoneCode}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log(`  └─ Zone: ${zoneCode}`);
    }
  }
}

void seedCampus(process.argv[2] ?? "UGA")
  .then(() => {
    console.log("Campus seed complete.");
  })
  .catch((err) => {
    console.error("Campus seed failed:", err);
    process.exit(1);
  });
