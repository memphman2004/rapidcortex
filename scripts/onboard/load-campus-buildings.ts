/**
 * Load campus buildings/zones from CSV after day-0 onboard.
 *
 * CSV header:
 * buildingCode,buildingName,type,floors,zoneFloor,zoneRoom
 *
 * Env: CAMPUS_CONFIG_TABLE, CAMPUS_CODE, AGENCY_ID, AWS_REGION
 */
import { readFileSync } from "node:fs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

type Row = {
  buildingCode: string;
  buildingName: string;
  type: string;
  floors: string;
  zoneFloor: string;
  zoneRoom: string;
};

function parseCsv(path: string): Row[] {
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (lines.length < 2) throw new Error("CSV needs a header and at least one row");
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`CSV missing column ${name}`);
    return i;
  };
  const cols = {
    buildingCode: idx("buildingCode"),
    buildingName: idx("buildingName"),
    type: idx("type"),
    floors: idx("floors"),
    zoneFloor: idx("zoneFloor"),
    zoneRoom: idx("zoneRoom"),
  };
  return lines.slice(1).map((line) => {
    const parts = line.split(",").map((p) => p.trim());
    return {
      buildingCode: parts[cols.buildingCode] ?? "",
      buildingName: parts[cols.buildingName] ?? "",
      type: parts[cols.type] ?? "academic",
      floors: parts[cols.floors] ?? "1",
      zoneFloor: parts[cols.zoneFloor] ?? "1",
      zoneRoom: parts[cols.zoneRoom] ?? "",
    };
  });
}

function fileArg(): string {
  const i = process.argv.indexOf("--file");
  const path = i >= 0 ? process.argv[i + 1] : process.env.BUILDINGS_CSV;
  if (!path) throw new Error("Pass --file path/to/campus-buildings.csv");
  return path;
}

async function main(): Promise<void> {
  const campusCode = (process.env.CAMPUS_CODE ?? process.env.ORG_CODE ?? "").trim().toUpperCase();
  const agencyId = process.env.AGENCY_ID?.trim();
  const table = process.env.CAMPUS_CONFIG_TABLE?.trim();
  if (!campusCode || !agencyId || !table) {
    throw new Error("Set CAMPUS_CODE (or ORG_CODE), AGENCY_ID, and CAMPUS_CONFIG_TABLE");
  }
  const rows = parseCsv(fileArg());
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" }));
  const pk = `CAMPUS_CONFIG#${campusCode}`;
  const now = new Date().toISOString();
  const buildings = new Map<string, Row>();
  for (const row of rows) {
    if (!row.buildingCode) continue;
    buildings.set(row.buildingCode.toUpperCase(), row);
  }
  for (const [code, row] of buildings) {
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: {
          pk,
          sk: `BUILDING#${code}`,
          id: `b-${code.toLowerCase()}`,
          agencyId,
          campusCode,
          code,
          label: row.buildingName || code,
          type: row.type || "academic",
          floors: Number(row.floors) || 1,
          cameraIds: [],
          activeIncidents: 0,
          zones: [],
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
    // eslint-disable-next-line no-console
    console.log(`[load-campus] building ${code}`);
  }
  for (const row of rows) {
    if (!row.buildingCode || !row.zoneRoom) continue;
    const bcode = row.buildingCode.toUpperCase();
    const zoneCode = `${bcode}-${row.zoneFloor}-${row.zoneRoom}`.replace(/\s+/g, "-").toUpperCase();
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: {
          pk,
          sk: `ZONE#${zoneCode}`,
          agencyId,
          code: zoneCode,
          label: `${row.buildingName} Floor ${row.zoneFloor} ${row.zoneRoom}`,
          buildingCode: bcode,
          buildingLabel: row.buildingName,
          floor: Number(row.zoneFloor) || 1,
          roomCode: row.zoneRoom,
          cameraIds: [],
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
    // eslint-disable-next-line no-console
    console.log(`[load-campus] zone ${zoneCode}`);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[load-campus] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
