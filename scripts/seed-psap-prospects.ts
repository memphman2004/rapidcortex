/**
 * Seed / upsert PSAP prospects from FCC/NENA registry Excel into DynamoDB.
 *
 * Match order (upsert):
 *   1. Phone (PhoneIndex) — preferred unique key
 *   2. FIPS + PSAP name — when phone changed or missing in sheet
 *   3. Else insert new
 *
 * Preserves CRM fields on update: outreachStatus, activities, contacts,
 * mailingAddress, assignments, notes, estimatedValue, etc.
 *
 * Usage:
 *   PSAP_PROSPECTS_TABLE=rapid-cortex-psap-prospects-dev \
 *     npx tsx scripts/seed-psap-prospects.ts ./file.xls
 *
 *   # Preview only
 *   PSAP_PROSPECTS_TABLE=… npx tsx scripts/seed-psap-prospects.ts ./file.xls --dry-run
 *
 *   # Old behavior: skip existing phones, never update
 *   PSAP_PROSPECTS_TABLE=… npx tsx scripts/seed-psap-prospects.ts ./file.xls --insert-only
 *
 * Requires `xlsx` (`npm i -D xlsx`).
 */

import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.PSAP_PROSPECTS_TABLE;
if (!TABLE) {
  console.error("ERROR: PSAP_PROSPECTS_TABLE env var is required");
  process.exit(1);
}

const argv = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const FLAGS = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const DRY_RUN = FLAGS.has("--dry-run");
const INSERT_ONLY = FLAGS.has("--insert-only");

const FILE = resolve(argv[0] ?? "./rc-psap-with-coordinates.xlsx");
const BATCH_LABEL = process.env.PSAP_IMPORT_LABEL ?? `psap_registry_${new Date().toISOString().slice(0, 10)}`;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

type XlsxModule = {
  readFile: (path: string) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: {
    sheet_to_json: <T>(sheet: unknown) => T[];
  };
};

type ProspectRow = {
  psapId: string;
  psapName: string;
  county: string;
  state: string;
  city: string;
  phone: string;
  fips: string;
  latitude?: number;
  longitude?: number;
  mailingAddress?: unknown;
  outreachStatus?: string;
  activities?: unknown[];
  [key: string]: unknown;
};

type SheetContact = {
  name: string;
  title: string;
  email: string;
  phone: string;
  roleTier: "primary" | "secondary" | "procurement" | "executive";
  isPrimary: boolean;
};

type SheetFields = {
  psapName: string;
  county: string;
  state: string;
  city: string;
  phone: string;
  fips: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  streetAddress?: string;
  addressLine2?: string;
  zip?: string;
  sourcePsapId?: string;
  notes?: string;
  contacts: SheetContact[];
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

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function normalizeFips(fips: string): string {
  const digits = fips.replace(/\D/g, "");
  if (!digits) return "";
  // County FIPS is typically 5 digits; left-pad when sheet drops leading zeros.
  return digits.length <= 5 ? digits.padStart(5, "0") : digits;
}

function normalizeName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, " ");
}

function fipsNameKey(fips: string, name: string): string {
  return `${normalizeFips(fips)}|${normalizeName(name)}`;
}

function mapContactRole(raw: string): SheetContact["roleTier"] {
  const t = raw.trim().toUpperCase();
  if (t.includes("PRIMARY") || t.includes("DIRECTOR") || t.includes("CHIEF")) return "primary";
  if (t.includes("PROCURE") || t.includes("FINANCE")) return "procurement";
  if (t.includes("EXEC") || t.includes("SHERIFF")) return "executive";
  return "secondary";
}

function parseSheetRow(row: Record<string, unknown>): SheetFields | null {
  const phone = cell(
    row,
    "Main_Phone",
    "main_phone",
    "phone",
    "Phone",
    "PHONE",
    "Phone number",
    "phone number",
    "Phone Number",
    "Contact_Phone",
  );
  const psapName = cell(
    row,
    "PSAP_Name",
    "psap_name",
    "psapName",
    "PSAP Name",
    "NAME",
    "name",
    "Name",
  );
  const abbrev = cell(row, "State_Abbreviation", "state_abbreviation", "ST", "st").toUpperCase();
  const stateRaw = cell(row, "state", "State").toUpperCase();
  const state = (abbrev || (stateRaw.length === 2 ? stateRaw : "")).slice(0, 2);
  if (!psapName || !state) return null;
  if (!phone && !cell(row, "fips", "FIPS", "Fips")) return null;

  const latRaw = row["latitude"] ?? row["lat"] ?? row["Latitude"];
  const lngRaw = row["longitude"] ?? row["lon"] ?? row["lng"] ?? row["Longitude"];
  const latitude = latRaw === "" || latRaw == null ? undefined : Number(latRaw);
  const longitude = lngRaw === "" || lngRaw == null ? undefined : Number(lngRaw);

  const contactName = cell(row, "Contact_Full_Name", "Contact Name", "primaryContactName");
  const contactTitle = cell(row, "Contact_Title", "Contact Title", "primaryContactTitle");
  const contactEmail = cell(row, "Contact_Email", "Contact Email", "primaryContactEmail");
  const contactPhone = cell(row, "Contact_Phone", "Contact Phone", "primaryContactPhone");
  const contactType = cell(row, "Contact_Type", "Contact Type");
  const isPrimaryRaw = row["Is_Primary_Contact"];
  const isPrimary =
    isPrimaryRaw === true ||
    String(isPrimaryRaw ?? "").toLowerCase() === "true" ||
    String(isPrimaryRaw ?? "") === "1" ||
    contactType.toUpperCase().includes("PRIMARY");

  const contacts: SheetContact[] = [];
  if (contactName || contactEmail || contactPhone) {
    contacts.push({
      name: contactName,
      title: contactTitle || "Communications",
      email: contactEmail,
      phone: contactPhone || phone,
      roleTier: mapContactRole(contactType || (isPrimary ? "PRIMARY DECISION MAKER" : "OPERATIONS")),
      isPrimary,
    });
  }

  const street = cell(row, "Street_Address", "streetAddress", "Address", "address");
  const zip = cell(row, "ZIP_Code", "Zip", "ZIP", "zip");
  const website = cell(row, "Website", "website", "URL", "url");
  const notes = cell(row, "Notes", "notes");

  return {
    psapName: normalizeName(psapName),
    county: cell(row, "county", "County").toUpperCase(),
    state,
    city: cell(row, "city", "City").toUpperCase(),
    phone,
    fips: normalizeFips(cell(row, "fips", "FIPS", "Fips")),
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
    website: website || undefined,
    streetAddress: street || undefined,
    addressLine2: cell(row, "Address_Line_2", "addressLine2") || undefined,
    zip: zip || undefined,
    sourcePsapId: cell(row, "PSAP_ID", "psapId") || undefined,
    notes: notes || undefined,
    contacts,
  };
}

function nameStateKey(name: string, state: string): string {
  return `${normalizeName(name)}|${state.trim().toUpperCase()}`;
}

async function loadExisting(): Promise<{
  byPhone: Map<string, ProspectRow>;
  byFipsName: Map<string, ProspectRow>;
  byNameState: Map<string, ProspectRow>;
}> {
  const byPhone = new Map<string, ProspectRow>();
  const byFipsName = new Map<string, ProspectRow>();
  const byNameState = new Map<string, ProspectRow>();
  let ExclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const r = await client.send(
      new ScanCommand({
        TableName: TABLE,
        ExclusiveStartKey,
        ProjectionExpression:
          "psapId, psapName, county, #st, city, phone, fips, latitude, longitude, mailingAddress, outreachStatus, activities, contacts, primaryContactName, primaryContactTitle, primaryContactEmail, primaryContactPhone, website, notes, createdAt, importedFrom",
        ExpressionAttributeNames: { "#st": "state" },
      }),
    );
    for (const it of r.Items ?? []) {
      const p = it as ProspectRow;
      if (p.phone) {
        const digits = normalizePhone(p.phone);
        if (digits) byPhone.set(digits, p);
        byPhone.set(p.phone, p);
      }
      if (p.fips && p.psapName) {
        byFipsName.set(fipsNameKey(p.fips, p.psapName), p);
      }
      if (p.psapName && p.state) {
        byNameState.set(nameStateKey(p.psapName, String(p.state)), p);
      }
    }
    ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  return { byPhone, byFipsName, byNameState };
}

function findMatch(
  fields: SheetFields,
  byPhone: Map<string, ProspectRow>,
  byFipsName: Map<string, ProspectRow>,
  byNameState: Map<string, ProspectRow>,
): { existing: ProspectRow; via: "phone" | "fips+name" | "name+state" } | null {
  if (fields.phone) {
    const digits = normalizePhone(fields.phone);
    const hit = byPhone.get(digits) ?? byPhone.get(fields.phone);
    if (hit) return { existing: hit, via: "phone" };
  }
  if (fields.fips && fields.psapName) {
    const hit = byFipsName.get(fipsNameKey(fields.fips, fields.psapName));
    if (hit) return { existing: hit, via: "fips+name" };
  }
  if (fields.psapName && fields.state) {
    const hit = byNameState.get(nameStateKey(fields.psapName, fields.state));
    if (hit) return { existing: hit, via: "name+state" };
  }
  return null;
}

function mergeMailingAddress(
  existing: ProspectRow,
  fields: SheetFields,
): Record<string, unknown> | undefined {
  const street = [fields.streetAddress, fields.addressLine2].filter(Boolean).join(", ").trim();
  if (!street && !fields.zip) return undefined;
  const prev = (existing.mailingAddress ?? {}) as Record<string, unknown>;
  return {
    ...prev,
    streetAddress: street || prev.streetAddress,
    city: fields.city || prev.city || existing.city,
    county: fields.county || prev.county || existing.county,
    state: fields.state || prev.state || existing.state,
    zip: fields.zip || prev.zip,
    verified: prev.verified === true,
    source: prev.source ?? "import",
  };
}

function sheetContactsToItems(fields: SheetFields): unknown[] {
  const now = new Date().toISOString();
  return fields.contacts.slice(0, 5).map((c) => ({
    contactId: randomUUID(),
    name: c.name || null,
    title: c.title,
    roleTier: c.roleTier,
    email: c.email || null,
    emailVerified: false,
    phone: c.phone || null,
    linkedInUrl: null,
    verificationStatus: "unverified",
    verificationSource: "SafetySource / National Public Safety Information Bureau",
    source: "directory",
    addedAt: now,
  }));
}

async function updateProspect(existing: ProspectRow, fields: SheetFields): Promise<void> {
  const now = new Date().toISOString();
  const names: Record<string, string> = {
    "#psapName": "psapName",
    "#county": "county",
    "#state": "state",
    "#city": "city",
    "#phone": "phone",
    "#fips": "fips",
    "#updatedAt": "updatedAt",
    "#importedFrom": "importedFrom",
  };
  const values: Record<string, unknown> = {
    ":psapName": fields.psapName,
    ":county": fields.county || existing.county,
    ":state": fields.state,
    ":city": fields.city || existing.city,
    ":phone": fields.phone || existing.phone,
    ":fips": fields.fips || existing.fips,
    ":updatedAt": now,
    ":importedFrom": BATCH_LABEL,
  };
  const sets = [
    "#psapName = :psapName",
    "#county = :county",
    "#state = :state",
    "#city = :city",
    "#phone = :phone",
    "#fips = :fips",
    "#updatedAt = :updatedAt",
    "#importedFrom = :importedFrom",
  ];

  // Only overwrite coords when the sheet provides them (this phone-numbers file has none).
  if (fields.latitude !== undefined && fields.longitude !== undefined) {
    names["#latitude"] = "latitude";
    names["#longitude"] = "longitude";
    values[":latitude"] = fields.latitude;
    values[":longitude"] = fields.longitude;
    sets.push("#latitude = :latitude", "#longitude = :longitude");
  }

  const mailing = mergeMailingAddress(existing, fields);
  if (mailing) {
    names["#mailingAddress"] = "mailingAddress";
    values[":mailingAddress"] = mailing;
    sets.push("#mailingAddress = :mailingAddress");
  }
  if (fields.website) {
    names["#website"] = "website";
    values[":website"] = fields.website;
    sets.push("#website = :website");
  }
  if (fields.notes && !existing.notes) {
    names["#notes"] = "notes";
    values[":notes"] = fields.notes;
    sets.push("#notes = :notes");
  }
  const primary = fields.contacts.find((c) => c.isPrimary) ?? fields.contacts[0];
  if (primary && !existing.primaryContactName) {
    if (primary.name) {
      names["#primaryContactName"] = "primaryContactName";
      values[":primaryContactName"] = primary.name;
      sets.push("#primaryContactName = :primaryContactName");
    }
    if (primary.title) {
      names["#primaryContactTitle"] = "primaryContactTitle";
      values[":primaryContactTitle"] = primary.title;
      sets.push("#primaryContactTitle = :primaryContactTitle");
    }
    if (primary.email) {
      names["#primaryContactEmail"] = "primaryContactEmail";
      values[":primaryContactEmail"] = primary.email;
      sets.push("#primaryContactEmail = :primaryContactEmail");
    }
    if (primary.phone) {
      names["#primaryContactPhone"] = "primaryContactPhone";
      values[":primaryContactPhone"] = primary.phone;
      sets.push("#primaryContactPhone = :primaryContactPhone");
    }
  }
  const existingContacts = Array.isArray(existing.contacts) ? existing.contacts : [];
  if (fields.contacts.length > 0 && existingContacts.length === 0) {
    names["#contacts"] = "contacts";
    names["#contactCount"] = "contactCount";
    values[":contacts"] = sheetContactsToItems(fields);
    values[":contactCount"] = fields.contacts.length;
    sets.push("#contacts = :contacts", "#contactCount = :contactCount");
  }

  await client.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { psapId: existing.psapId },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

async function insertProspect(fields: SheetFields): Promise<void> {
  const now = new Date().toISOString();
  const primary = fields.contacts.find((c) => c.isPrimary) ?? fields.contacts[0];
  const mailing = mergeMailingAddress({} as ProspectRow, fields);
  const item: Record<string, unknown> = {
    psapId: randomUUID(),
    psapName: fields.psapName,
    county: fields.county,
    state: fields.state,
    city: fields.city,
    phone: fields.phone,
    latitude: fields.latitude ?? 0,
    longitude: fields.longitude ?? 0,
    outreachStatus: "UNCONTACTED" as const,
    activities: [] as unknown[],
    createdAt: now,
    updatedAt: now,
    importedFrom: BATCH_LABEL,
  };
  if (fields.fips) item.fips = fields.fips;
  if (mailing) item.mailingAddress = mailing;
  if (fields.website) item.website = fields.website;
  if (fields.notes) item.notes = fields.notes;
  if (primary?.name) item.primaryContactName = primary.name;
  if (primary?.title) item.primaryContactTitle = primary.title;
  if (primary?.email) item.primaryContactEmail = primary.email;
  if (primary?.phone) item.primaryContactPhone = primary.phone;
  if (fields.contacts.length > 0) {
    item.contacts = sheetContactsToItems(fields);
    item.contactCount = fields.contacts.length;
  }

  await client.send(
    new PutCommand({
      TableName: TABLE,
      Item: item,
      ConditionExpression: "attribute_not_exists(psapId)",
    }),
  );
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

  console.log("─────────────────────────────────────────────────────────────");
  console.log("  Rapid Cortex — PSAP seed / upsert");
  console.log(`  File:        ${FILE}`);
  console.log(`  Table:       ${TABLE}`);
  console.log(`  Rows:        ${rows.length}`);
  console.log(`  Mode:        ${INSERT_ONLY ? "insert-only" : "upsert (phone → FIPS+name → name+state)"}`);
  console.log(`  Dry run:     ${DRY_RUN}`);
  console.log(`  Batch label: ${BATCH_LABEL}`);
  console.log("─────────────────────────────────────────────────────────────");

  const { byPhone, byFipsName, byNameState } = await loadExisting();
  console.log(
    `Loaded ${byPhone.size} phone keys, ${byFipsName.size} FIPS+name keys, ${byNameState.size} name+state keys from DynamoDB`,
  );

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const viaCounts = { phone: 0, "fips+name": 0, "name+state": 0 };

  for (const row of rows) {
    const fields = parseSheetRow(row);
    if (!fields) {
      skipped++;
      continue;
    }

    try {
      const match = findMatch(fields, byPhone, byFipsName, byNameState);

      if (match) {
        if (INSERT_ONLY) {
          skipped++;
          continue;
        }
        viaCounts[match.via]++;
        if (DRY_RUN) {
          console.log(
            `↻ [DRY] update via ${match.via}: ${fields.psapName} (${fields.state}) fips=${fields.fips || "—"}`,
          );
          updated++;
          continue;
        }
        await updateProspect(match.existing, fields);
        // Keep maps fresh if phone/name/fips changed
        const digits = normalizePhone(fields.phone || match.existing.phone);
        if (digits) byPhone.set(digits, { ...match.existing, ...fields, psapId: match.existing.psapId });
        if (fields.fips) {
          byFipsName.set(fipsNameKey(fields.fips, fields.psapName), {
            ...match.existing,
            ...fields,
            psapId: match.existing.psapId,
          });
        }
        byNameState.set(nameStateKey(fields.psapName, fields.state), {
          ...match.existing,
          ...fields,
          psapId: match.existing.psapId,
        });
        updated++;
        if (updated % 200 === 0) {
          console.log(`Progress: ${updated} updated, ${inserted} inserted, ${skipped} skipped`);
        }
        continue;
      }

      if (!fields.phone) {
        // New row without phone — skip (table relies on PhoneIndex for CRM)
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`+ [DRY] insert: ${fields.psapName} (${fields.state}) ${fields.phone}`);
        inserted++;
        continue;
      }

      await insertProspect(fields);
      const digits = normalizePhone(fields.phone);
      const stub = {
        psapId: "new",
        ...fields,
      } as ProspectRow;
      if (digits) byPhone.set(digits, stub);
      if (fields.fips) byFipsName.set(fipsNameKey(fields.fips, fields.psapName), stub);
      byNameState.set(nameStateKey(fields.psapName, fields.state), stub);
      inserted++;
      if (inserted % 200 === 0) {
        console.log(`Progress: ${updated} updated, ${inserted} inserted, ${skipped} skipped`);
      }
    } catch (e: unknown) {
      const name = (e as { name?: string })?.name;
      if (name === "ConditionalCheckFailedException") {
        skipped++;
      } else {
        console.error(`Error on ${fields.psapName} / ${fields.phone}:`, e);
        errors++;
      }
    }
  }

  console.log("\n─────────────────────────────────────────────────────────────");
  console.log(
    `  Updated:   ${updated} (phone=${viaCounts.phone}, fips+name=${viaCounts["fips+name"]}, name+state=${viaCounts["name+state"]})`,
  );
  console.log(`  Inserted:  ${inserted}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errors}`);
  if (DRY_RUN) console.log("  (dry run — no writes)");
  console.log("─────────────────────────────────────────────────────────────\n");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
