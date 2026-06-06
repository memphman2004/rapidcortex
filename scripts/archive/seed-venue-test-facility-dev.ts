/**
 * Seed a demo venue facility for `test-agency` so venue intelligence matches incidents
 * whose caller address normalizes to TEST_VENUE_ADDRESS below.
 */
import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

/** Use as incident `callerAddressLine` when testing venue intelligence in dev. */
export const TEST_VENUE_ADDRESS = "100 Test Venue Way, Testville, GA 30301";

const AGENCY_ID = "test-agency";
const FACILITY_ID = "test-venue-facility-001";
const FACILITIES_TABLE =
  process.env.VENUE_FACILITIES_TABLE?.trim() || "rapid-cortex-venue-facilities-dev";
const REGION = process.env.AWS_REGION?.trim() || "us-east-1";

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, " ");
}

function hashAddress(address: string): string {
  return createHash("sha256").update(normalizeAddress(address)).digest("hex");
}

async function main() {
  const now = new Date().toISOString();
  const addressHash = hashAddress(TEST_VENUE_ADDRESS);
  const item = {
    pk: `FACILITY#${FACILITY_ID}`,
    sk: "PROFILE",
    facilityId: FACILITY_ID,
    agencyId: AGENCY_ID,
    name: "Testville Community Center",
    address: TEST_VENUE_ADDRESS,
    addressHash,
    lat: 33.749,
    lng: -84.388,
    facilityType: "OTHER",
    floorCount: 2,
    timezone: "America/New_York",
    status: "ACTIVE",
    emergencyContacts: [
      {
        role: "Security",
        name: "Test Security Desk",
        phone: "+15555550100",
        available24x7: true,
      },
    ],
    cameraRoutingEnabled: true,
    enrolledBy: "seed-venue-test-facility-dev",
    createdAt: now,
    updatedAt: now,
  };

  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  await ddb.send(new PutCommand({ TableName: FACILITIES_TABLE, Item: item }));
  console.log(
    `[seed-venue-test-facility-dev] Upserted facility ${FACILITY_ID} for ${AGENCY_ID} (addressHash=${addressHash.slice(0, 12)}…)`,
  );
  console.log(`[seed-venue-test-facility-dev] Set incident callerAddressLine to: ${TEST_VENUE_ADDRESS}`);
}

main().catch((error) => {
  console.error(
    "[seed-venue-test-facility-dev] failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
