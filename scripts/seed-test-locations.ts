/**
 * Seed QR test locations into QRLocationsTable (dev/staging only).
 *
 * Usage:
 *   QR_LOCATIONS_TABLE=rapid-cortex-qr-locations-dev npx tsx scripts/seed-test-locations.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { generateRCLI, type QRLocation } from "rapid-cortex-shared";

const TABLE = process.env.QR_LOCATIONS_TABLE?.trim();
if (!TABLE) {
  console.error("Set QR_LOCATIONS_TABLE");
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TEST_LOCATIONS = [
  {
    orgCode: "CSU",
    agencyId: "columbus-state",
    vertical: "campus" as const,
    locationName: "Library — Main Entrance",
    building: "Simon Schwob Memorial Library",
    floor: "Ground",
    zone: "Academic Core",
    zoneCode: "RC101",
    sequence: 1,
  },
  {
    orgCode: "CSU",
    agencyId: "columbus-state",
    vertical: "campus" as const,
    locationName: "Parking Garage B — Level 2",
    building: "Parking Structure B",
    floor: "Level 2",
    zone: "North Campus",
    zoneCode: "RC102",
    sequence: 2,
  },
  {
    orgCode: "CSU",
    agencyId: "columbus-state",
    vertical: "campus" as const,
    locationName: "Student Center — Main Lobby",
    building: "Student Center",
    floor: "Ground",
    zone: "Campus Core",
    zoneCode: "RC103",
    sequence: 3,
  },
  {
    orgCode: "MBS",
    agencyId: "mercedes-benz-stadium",
    vertical: "venue" as const,
    locationName: "Section 101 — Gate A",
    building: "Lower Bowl",
    floor: "Level 1",
    zone: "South End",
    zoneCode: "RC201",
    sequence: 1,
  },
  {
    orgCode: "MBS",
    agencyId: "mercedes-benz-stadium",
    vertical: "venue" as const,
    locationName: "Concourse C — Food Court",
    building: "Main Concourse",
    floor: "Level 2",
    zone: "West Concourse",
    zoneCode: "RC202",
    sequence: 2,
  },
];

async function main() {
  const now = new Date().toISOString();
  for (const row of TEST_LOCATIONS) {
    const rcli = generateRCLI(row.orgCode, row.sequence);
    const item: QRLocation = {
      rcli,
      agencyId: row.agencyId,
      orgCode: row.orgCode,
      vertical: row.vertical,
      locationName: row.locationName,
      building: row.building,
      floor: row.floor,
      zone: row.zone,
      zoneCode: row.zoneCode,
      active: true,
      scanCount: 0,
      createdBy: "seed-test-locations",
      createdAt: now,
      updatedAt: now,
    };
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
      }),
    );
    console.log(`Seeded ${rcli} — ${row.locationName}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
