/**
 * Load venue zones from CSV after day-0 onboard.
 *
 * CSV header:
 * zoneCode,zoneName,level
 *
 * Env: VENUE_CONFIG_TABLE, VENUE_CODE, AGENCY_ID, AWS_REGION
 */
import { readFileSync } from "node:fs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

function parseCsv(path: string): { zoneCode: string; zoneName: string; level: string }[] {
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (lines.length < 2) throw new Error("CSV needs a header and at least one row");
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`CSV missing column ${name}`);
    return i;
  };
  const zoneCode = idx("zoneCode");
  const zoneName = idx("zoneName");
  const level = idx("level");
  return lines.slice(1).map((line) => {
    const parts = line.split(",").map((p) => p.trim());
    return {
      zoneCode: (parts[zoneCode] ?? "").toUpperCase(),
      zoneName: parts[zoneName] ?? "",
      level: parts[level] ?? "",
    };
  });
}

function fileArg(): string {
  const i = process.argv.indexOf("--file");
  const path = i >= 0 ? process.argv[i + 1] : process.env.ZONES_CSV;
  if (!path) throw new Error("Pass --file path/to/venue-zones.csv");
  return path;
}

async function main(): Promise<void> {
  const venueCode = (process.env.VENUE_CODE ?? process.env.ORG_CODE ?? "").trim().toUpperCase();
  const agencyId = process.env.AGENCY_ID?.trim();
  const table = process.env.VENUE_CONFIG_TABLE?.trim();
  if (!venueCode || !agencyId || !table) {
    throw new Error("Set VENUE_CODE (or ORG_CODE), AGENCY_ID, and VENUE_CONFIG_TABLE");
  }
  const rows = parseCsv(fileArg());
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" }));
  const now = new Date().toISOString();
  for (const row of rows) {
    if (!row.zoneCode) continue;
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: {
          pk: `VENUE_CONFIG#${venueCode}`,
          sk: `ZONE#${row.zoneCode}`,
          agencyId,
          venueCode,
          zoneCode: row.zoneCode,
          zoneName: row.zoneName || row.zoneCode,
          level: row.level,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
    // eslint-disable-next-line no-console
    console.log(`[load-venue] zone ${row.zoneCode}`);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[load-venue] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
