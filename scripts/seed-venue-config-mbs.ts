/**
 * Seed MBS venue org config into VENUE_CONFIG_TABLE (prod/dev stage).
 *
 * Usage:
 *   VENUE_CONFIG_TABLE=rapid-cortex-venue-config-dev \
 *   npx tsx scripts/seed-venue-config-mbs.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.VENUE_CONFIG_TABLE?.trim();
if (!TABLE) {
  console.error("Set VENUE_CONFIG_TABLE");
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function main(): Promise<void> {
  const now = new Date().toISOString();
  const venueCode = "MBS";
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `VENUE_CONFIG#${venueCode}`,
        sk: "CONFIG",
        agencyId: "test-venue-mbs",
        venueCode,
        venueName: "Mercedes-Benz Stadium",
        venueType: "stadium",
        capacity: 71000,
        levels: ["lower", "club", "upper", "suite"],
        gateCount: 4,
        city: "Atlanta",
        state: "GA",
        timezone: "America/New_York",
        active: true,
        smsEnabled: true,
        qrEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
    }),
  );
  console.log(`Seeded venue config: ${venueCode} → test-venue-mbs (${TABLE})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
