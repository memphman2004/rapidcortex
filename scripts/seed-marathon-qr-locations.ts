/**
 * Seed QR/NFC course marker locations for a marathon event.
 *
 * Creates one QR location per physical marker on the race course:
 * mile markers, water stations, aid stations, start, and finish.
 * Volunteers scan the marker QR, then manually enter reason and bib number.
 *
 * Usage:
 *   QR_LOCATIONS_TABLE=rapid-cortex-qr-locations-dev \
 *   npx tsx scripts/seed-marathon-qr-locations.ts
 *
 * Required env:
 *   QR_LOCATIONS_TABLE  — DynamoDB table name
 *
 * Optional env:
 *   ORG_CODE   — defaults to "RCM26"
 *   AGENCY_ID  — defaults to "venue-rcm26"
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { generateRCLI, type QRLocation } from "rapid-cortex-shared";

const TABLE = process.env.QR_LOCATIONS_TABLE?.trim();
if (!TABLE) {
  console.error("ERROR: QR_LOCATIONS_TABLE is not set");
  process.exit(1);
}

const ORG_CODE  = process.env.ORG_CODE?.trim()  ?? "RCM26";
const AGENCY_ID = process.env.AGENCY_ID?.trim() ?? "venue-rcm26";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * Course markers in course order.
 * zone     = marker category shown in the console incident list
 * zoneCode = short identifier used for filtering and display
 * sequence = must be unique per orgCode — used by generateRCLI
 */
const COURSE_MARKERS = [
  { locationName: "Start Line",             zone: "Start",         zoneCode: "START",  sequence: 1  },
  { locationName: "Mile 1",                 zone: "Mile Marker",   zoneCode: "M01",    sequence: 2  },
  { locationName: "Water Station 1",        zone: "Water Station", zoneCode: "WS01",   sequence: 3  },
  { locationName: "Mile 2",                 zone: "Mile Marker",   zoneCode: "M02",    sequence: 4  },
  { locationName: "Mile 3",                 zone: "Mile Marker",   zoneCode: "M03",    sequence: 5  },
  { locationName: "Aid Station A",          zone: "Aid Station",   zoneCode: "AID-A",  sequence: 6  },
  { locationName: "Mile 4",                 zone: "Mile Marker",   zoneCode: "M04",    sequence: 7  },
  { locationName: "Water Station 2",        zone: "Water Station", zoneCode: "WS02",   sequence: 8  },
  { locationName: "Mile 5",                 zone: "Mile Marker",   zoneCode: "M05",    sequence: 9  },
  { locationName: "Mile 6",                 zone: "Mile Marker",   zoneCode: "M06",    sequence: 10 },
  { locationName: "Aid Station B",          zone: "Aid Station",   zoneCode: "AID-B",  sequence: 11 },
  { locationName: "Mile 7",                 zone: "Mile Marker",   zoneCode: "M07",    sequence: 12 },
  { locationName: "Water Station 3",        zone: "Water Station", zoneCode: "WS03",   sequence: 13 },
  { locationName: "Mile 8",                 zone: "Mile Marker",   zoneCode: "M08",    sequence: 14 },
  { locationName: "Mile 9",                 zone: "Mile Marker",   zoneCode: "M09",    sequence: 15 },
  { locationName: "Aid Station C",          zone: "Aid Station",   zoneCode: "AID-C",  sequence: 16 },
  { locationName: "Mile 10",                zone: "Mile Marker",   zoneCode: "M10",    sequence: 17 },
  { locationName: "Water Station 4",        zone: "Water Station", zoneCode: "WS04",   sequence: 18 },
  { locationName: "Mile 11",                zone: "Mile Marker",   zoneCode: "M11",    sequence: 19 },
  { locationName: "Mile 12",                zone: "Mile Marker",   zoneCode: "M12",    sequence: 20 },
  { locationName: "Mile 13 — Half Marathon",zone: "Checkpoint",    zoneCode: "HALF",   sequence: 21 },
  { locationName: "Aid Station D",          zone: "Aid Station",   zoneCode: "AID-D",  sequence: 22 },
  { locationName: "Mile 14",                zone: "Mile Marker",   zoneCode: "M14",    sequence: 23 },
  { locationName: "Water Station 5",        zone: "Water Station", zoneCode: "WS05",   sequence: 24 },
  { locationName: "Mile 15",                zone: "Mile Marker",   zoneCode: "M15",    sequence: 25 },
  { locationName: "Mile 16",                zone: "Mile Marker",   zoneCode: "M16",    sequence: 26 },
  { locationName: "Aid Station E",          zone: "Aid Station",   zoneCode: "AID-E",  sequence: 27 },
  { locationName: "Mile 17",                zone: "Mile Marker",   zoneCode: "M17",    sequence: 28 },
  { locationName: "Water Station 6",        zone: "Water Station", zoneCode: "WS06",   sequence: 29 },
  { locationName: "Mile 18",                zone: "Mile Marker",   zoneCode: "M18",    sequence: 30 },
  { locationName: "Mile 19",                zone: "Mile Marker",   zoneCode: "M19",    sequence: 31 },
  { locationName: "Aid Station F",          zone: "Aid Station",   zoneCode: "AID-F",  sequence: 32 },
  { locationName: "Mile 20",                zone: "Mile Marker",   zoneCode: "M20",    sequence: 33 },
  { locationName: "Water Station 7",        zone: "Water Station", zoneCode: "WS07",   sequence: 34 },
  { locationName: "Mile 21",                zone: "Mile Marker",   zoneCode: "M21",    sequence: 35 },
  { locationName: "Mile 22",                zone: "Mile Marker",   zoneCode: "M22",    sequence: 36 },
  { locationName: "Aid Station G",          zone: "Aid Station",   zoneCode: "AID-G",  sequence: 37 },
  { locationName: "Mile 23",                zone: "Mile Marker",   zoneCode: "M23",    sequence: 38 },
  { locationName: "Water Station 8",        zone: "Water Station", zoneCode: "WS08",   sequence: 39 },
  { locationName: "Mile 24",                zone: "Mile Marker",   zoneCode: "M24",    sequence: 40 },
  { locationName: "Mile 25",                zone: "Mile Marker",   zoneCode: "M25",    sequence: 41 },
  { locationName: "Mile 26",                zone: "Mile Marker",   zoneCode: "M26",    sequence: 42 },
  { locationName: "Finish Line",            zone: "Finish",        zoneCode: "FINISH", sequence: 43 },
  { locationName: "Volunteer Command",      zone: "Operations",    zoneCode: "CMD",    sequence: 44 },
  { locationName: "Medical Tent",           zone: "Medical",       zoneCode: "MED",    sequence: 45 },
] as const;

async function main(): Promise<void> {
  const now = new Date().toISOString();
  console.log(`Seeding ${COURSE_MARKERS.length} marathon QR locations`);
  console.log(`  Table:    ${TABLE}`);
  console.log(`  OrgCode:  ${ORG_CODE}`);
  console.log(`  AgencyId: ${AGENCY_ID}`);
  console.log();

  for (const marker of COURSE_MARKERS) {
    const rcli = generateRCLI(ORG_CODE, marker.sequence);
    const item: QRLocation = {
      rcli,
      agencyId: AGENCY_ID,
      orgCode: ORG_CODE,
      vertical: "venue",
      locationName: marker.locationName,
      building: "Race Course",
      floor: "Ground",
      zone: marker.zone,
      zoneCode: marker.zoneCode,
      active: true,
      scanCount: 0,
      createdBy: "seed-marathon-qr-locations",
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    console.log(`  ✓ ${rcli}  ${marker.locationName}`);
  }

  console.log();
  console.log(`Done — ${COURSE_MARKERS.length} locations seeded`);
  console.log(`Verify in RC Admin → Agencies → ${AGENCY_ID} → QR & NFC Codes`);
}

main().catch((err: unknown) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
