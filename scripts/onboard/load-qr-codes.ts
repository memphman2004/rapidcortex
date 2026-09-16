/**
 * Load QR/NFC location codes from CSV after day-0 onboard.
 *
 * CSV header:
 * name,zone,reportType
 *
 * Env: QR_NFC_CODES_TABLE, AGENCY_ID, AGENCY_NAME, VERTICAL, APP_PUBLIC_BASE_URL, AWS_REGION
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

function parseCsv(path: string): { name: string; zone: string; reportType: string }[] {
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (lines.length < 2) throw new Error("CSV needs a header and at least one row");
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`CSV missing column ${name}`);
    return i;
  };
  const name = idx("name");
  const zone = idx("zone");
  const reportType = idx("reportType");
  return lines.slice(1).map((line) => {
    const parts = line.split(",").map((p) => p.trim());
    return {
      name: parts[name] ?? "",
      zone: parts[zone] ?? "",
      reportType: parts[reportType] || "both",
    };
  });
}

function qrId(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 26; i++) out += alphabet[bytes[i % bytes.length]! % 32];
  return out;
}

function fileArg(): string {
  const i = process.argv.indexOf("--file");
  const path = i >= 0 ? process.argv[i + 1] : process.env.QR_CSV;
  if (!path) throw new Error("Pass --file path/to/qr-codes.csv");
  return path;
}

async function main(): Promise<void> {
  const agencyId = process.env.AGENCY_ID?.trim();
  const agencyName = process.env.AGENCY_NAME?.trim() || agencyId;
  const vertical = (process.env.VERTICAL ?? "campus").trim().toLowerCase();
  const table = process.env.QR_NFC_CODES_TABLE?.trim();
  if (!agencyId || !table) throw new Error("Set AGENCY_ID and QR_NFC_CODES_TABLE");
  const appBase = (process.env.APP_PUBLIC_BASE_URL ?? "https://app.rapidcortex.us").replace(/\/$/, "");
  const rows = parseCsv(fileArg());
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" }));
  const now = new Date().toISOString();
  for (const row of rows) {
    if (!row.name) continue;
    const id = qrId();
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: {
          agencyId,
          qrId: id,
          agencyName,
          name: row.name,
          zone: row.zone,
          vertical,
          reportType: row.reportType,
          nfcEnabled: false,
          active: true,
          url: `${appBase}/report/${id}`,
          scanCount: 0,
          nfcTapCount: 0,
          totalEngagements: 0,
          createdBy: "onboard-load-qr",
          createdByRole: "onboard-load-qr",
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
    // eslint-disable-next-line no-console
    console.log(`[load-qr] ${row.name} ${id}`);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[load-qr] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
