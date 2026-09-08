/**
 * Seed RCLI locations for live UGA campus + MBS venue tenants.
 *
 * Campus Miller/Myers/Tate rows are demo catalog. Live campus locations come from
 * Field QR/NFC (`scripts/sync-campus-buildings-from-qr.ts`). Set
 * ALLOW_DEMO_CAMPUS_RCLI=1 only when you intentionally want those fixtures.
 *
 * Usage:
 *   QR_LOCATIONS_TABLE=rapid-cortex-qr-locations-dev \
 *   npx tsx scripts/seed-prod-rcli-uga-mbs.ts
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

const LOCATIONS = [
  {
    orgCode: "UGA",
    agencyId: "test-campus-uga",
    vertical: "campus" as const,
    locationName: "Miller Learning Center — Main Entrance",
    building: "Miller Learning Center",
    floor: "Ground",
    zone: "Academic Core",
    zoneCode: "UGA101",
    sequence: 1,
  },
  {
    orgCode: "UGA",
    agencyId: "test-campus-uga",
    vertical: "campus" as const,
    locationName: "Tate Student Center — Food Court",
    building: "Tate Student Center",
    floor: "Level 1",
    zone: "Campus Core",
    zoneCode: "UGA102",
    sequence: 2,
  },
  {
    orgCode: "UGA",
    agencyId: "test-campus-uga",
    vertical: "campus" as const,
    locationName: "Myers Hall — Lobby",
    building: "Myers Hall",
    floor: "Ground",
    zone: "Residential",
    zoneCode: "UGA103",
    sequence: 3,
  },
  {
    orgCode: "MBS",
    agencyId: "test-venue-mbs",
    vertical: "venue" as const,
    locationName: "Section 101 — Gate A",
    building: "Lower Bowl",
    floor: "Level 1",
    zone: "South End",
    zoneCode: "MBS101",
    sequence: 1,
  },
  {
    orgCode: "MBS",
    agencyId: "test-venue-mbs",
    vertical: "venue" as const,
    locationName: "Concourse C — Food Court",
    building: "Main Concourse",
    floor: "Level 2",
    zone: "West Concourse",
    zoneCode: "MBS102",
    sequence: 2,
  },
];

async function main(): Promise<void> {
  const now = new Date().toISOString();
  const allowDemoCampus = process.env.ALLOW_DEMO_CAMPUS_RCLI === "1";
  const rows = allowDemoCampus ? LOCATIONS : LOCATIONS.filter((row) => row.vertical !== "campus");
  if (!allowDemoCampus) {
    console.log("Skipping campus demo RCLI (Miller/Myers/Tate). Set ALLOW_DEMO_CAMPUS_RCLI=1 to seed them.");
  }
  for (const row of rows) {
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
      createdBy: "seed-prod-rcli-uga-mbs",
      createdAt: now,
      updatedAt: now,
    };
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    console.log(`Seeded ${rcli} — ${row.locationName}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
