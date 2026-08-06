/**
 * Seed PSAP prospects from FCC/NENA registry Excel into DynamoDB.
 *
 * Usage:
 *   PSAP_PROSPECTS_TABLE=rapid-cortex-psap-prospects-dev \
 *     npx tsx scripts/seed-psap-prospects.ts ./rc-psap-with-coordinates.xlsx
 *
 * Requires optional peer dep `xlsx` (install: `npm i -D xlsx`).
 * Phone-based dedup via PhoneIndex GSI — re-runs skip existing phones.
 */

import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.PSAP_PROSPECTS_TABLE;
if (!TABLE) {
  console.error("ERROR: PSAP_PROSPECTS_TABLE env var is required");
  process.exit(1);
}

const FILE = resolve(process.argv[2] ?? "./rc-psap-with-coordinates.xlsx");
const BATCH_LABEL = process.env.PSAP_IMPORT_LABEL ?? "psap_registry_2026";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

type XlsxModule = {
  readFile: (path: string) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: {
    sheet_to_json: <T>(sheet: unknown) => T[];
  };
};

async function loadXlsx(): Promise<XlsxModule> {
  try {
    const mod = (await import("xlsx")) as unknown as XlsxModule & { default?: XlsxModule };
    return mod.default ?? mod;
  } catch {
    console.error(
      "ERROR: package `xlsx` is required. Install with `npm i -D xlsx` (or ensure it is resolvable).",
    );
    process.exit(1);
  }
}

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

async function phoneExists(phone: string): Promise<boolean> {
  const r = await client.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: "PhoneIndex",
      KeyConditionExpression: "phone = :p",
      ExpressionAttributeValues: { ":p": phone },
      Limit: 1,
    }),
  );
  return (r.Count ?? 0) > 0 || (r.Items?.length ?? 0) > 0;
}

async function seed() {
  const XLSX = await loadXlsx();
  const workbook = XLSX.readFile(FILE);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    console.error("ERROR: workbook has no sheets");
    process.exit(1);
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  console.log(`Seeding ${rows.length} rows from ${FILE} → ${TABLE}`);

  for (const row of rows) {
    const phone = cell(row, "phone", "Phone", "PHONE");
    if (!phone) {
      skipped++;
      continue;
    }

    try {
      if (await phoneExists(phone)) {
        skipped++;
        continue;
      }

      const now = new Date().toISOString();
      const item = {
        psapId: randomUUID(),
        psapName: cell(row, "psap_name", "psapName", "PSAP Name", "name").toUpperCase(),
        county: cell(row, "county", "County").toUpperCase(),
        state: cell(row, "state", "State").toUpperCase().slice(0, 2),
        city: cell(row, "city", "City").toUpperCase(),
        phone,
        fips: cell(row, "fips", "FIPS", "Fips"),
        latitude: Number(row["latitude"] ?? row["lat"] ?? row["Latitude"] ?? 0),
        longitude: Number(row["longitude"] ?? row["lon"] ?? row["lng"] ?? row["Longitude"] ?? 0),
        outreachStatus: "UNCONTACTED" as const,
        activities: [] as unknown[],
        createdAt: now,
        updatedAt: now,
        importedFrom: BATCH_LABEL,
      };

      if (!item.psapName || !item.state) {
        skipped++;
        continue;
      }

      await client.send(
        new PutCommand({
          TableName: TABLE,
          Item: item,
          ConditionExpression: "attribute_not_exists(psapId)",
        }),
      );
      inserted++;
      if (inserted % 100 === 0) {
        console.log(`Progress: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);
      }
    } catch (e: unknown) {
      const name = (e as { name?: string })?.name;
      if (name === "ConditionalCheckFailedException") {
        skipped++;
      } else {
        console.error(`Error inserting ${phone}:`, e);
        errors++;
      }
    }
  }

  console.log(`\nDone. ${inserted} inserted, ${skipped} skipped, ${errors} errors.`);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
