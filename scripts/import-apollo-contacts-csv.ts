/**
 * Import Apollo contact CSVs into:
 *  1) Email list (EMAILLIST#) + marketing leads — source = apollo
 *  2) Campus outreach catalog (outreach-prospects.json) — fill/create by company name
 *  3) PSAP prospects DynamoDB — fill primary contact / contacts; create when unmatched
 *
 * Usage:
 *   AWS_PROFILE=rapid-cortex npx tsx scripts/import-apollo-contacts-csv.ts --dry-run
 *   AWS_PROFILE=rapid-cortex npx tsx scripts/import-apollo-contacts-csv.ts
 *
 * Optional:
 *   --campus=path/to/campus.csv --psap=path/to/psap.csv --stage=dev
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const STAGE =
  argv.find((a) => a.startsWith("--stage="))?.slice("--stage=".length) ??
  process.env.STAGE ??
  "dev";
const CAMPUS_CSV = resolve(
  argv.find((a) => a.startsWith("--campus="))?.slice("--campus=".length) ??
    join(ROOT, "scripts/data/apollo/apollo-contacts-Campus_Higher_ED.csv"),
);
const PSAP_CSV = resolve(
  argv.find((a) => a.startsWith("--psap="))?.slice("--psap=".length) ??
    join(ROOT, "scripts/data/apollo/apollo-contacts-PSAP.csv"),
);
const OUTREACH_JSON = resolve(
  ROOT,
  "apps/web/lib/psap/outreach-prospects.json",
);

const REGION = process.env.AWS_REGION ?? "us-east-1";
const MARKETING =
  process.env.MARKETING_LEADS_TABLE ?? `rapid-cortex-marketing-leads-${STAGE}`;
const PIPELINE =
  process.env.RAPID_IQ_PIPELINE_SIGNALS_TABLE ??
  `rapid-cortex-rapid-iq-pipeline-signals-${STAGE}`;
const PSAP_TABLE =
  process.env.PSAP_PROSPECTS_TABLE ?? `rapid-cortex-psap-prospects-${STAGE}`;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

const STATE_ABBR: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

type ApolloRow = {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  email: string;
  address: string;
  city: string;
  state: string;
};

type OutreachProspect = {
  id: string;
  vertical: "campus" | "venue" | "transit";
  listKey: string;
  listLabel: string;
  name: string;
  state: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  contactName: string;
  contactRole: string;
  priority: string;
  studentCount?: number;
};

type OutreachCatalog = {
  generatedAt: string;
  counts: {
    total: number;
    byVertical: Record<string, number>;
    byList: Record<string, number>;
  };
  items: OutreachProspect[];
};

type PsapProspect = {
  psapId: string;
  psapName: string;
  county: string;
  state: string;
  city: string;
  phone: string;
  fips: string;
  latitude: number;
  longitude: number;
  mailingAddress?: Record<string, unknown>;
  primaryContactName?: string;
  primaryContactTitle?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  contacts?: Array<Record<string, unknown>>;
  contactCount?: number;
  lastEnrichedAt?: string;
  website?: string;
  outreachStatus: string;
  activities: unknown[];
  createdAt: string;
  updatedAt: string;
  importedFrom: string;
  notes?: string;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseApolloCsv(path: string): ApolloRow[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const iFirst = idx("first name");
  const iLast = idx("last name");
  const iTitle = idx("title");
  const iCompany = idx("company name");
  const iEmail = idx("email");
  const iAddress = idx("address");
  const iCity = idx("city");
  const iState = idx("state");
  const rows: ApolloRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const email = (cols[iEmail] ?? "").trim().toLowerCase();
    const company = (cols[iCompany] ?? "").trim();
    if (!email || !email.includes("@") || !company) continue;
    rows.push({
      firstName: (cols[iFirst] ?? "").trim(),
      lastName: (cols[iLast] ?? "").trim(),
      title: (cols[iTitle] ?? "").trim(),
      company,
      email,
      address: (cols[iAddress] ?? "").trim(),
      city: (cols[iCity] ?? "").trim(),
      state: (cols[iState] ?? "").trim(),
    });
  }
  return rows;
}

function toStateAbbr(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return STATE_ABBR[t.toLowerCase()] ?? t.slice(0, 2).toUpperCase();
}

function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(the|university|college|campus|immersion|system|district|city|of|police|department|dept|pd|comm|communications|emergency|center|centre)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function displayName(row: ApolloRow): string {
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
}

function streetFromApolloAddress(address: string, city: string, state: string): string {
  let a = address.trim();
  if (!a || a.toLowerCase() === "united states") return "";
  // Strip trailing "City, State, United States"
  a = a.replace(/,?\s*united states\s*$/i, "").trim();
  if (city) {
    const re = new RegExp(`,\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*$`, "i");
    const stripped = a.replace(re, "").trim();
    if (stripped && stripped !== a) return stripped;
  }
  if (state) {
    const abbr = toStateAbbr(state);
    const re = new RegExp(`,\\s*${abbr}\\b.*$`, "i");
    const stripped = a.replace(re, "").trim();
    if (stripped && stripped !== a) return stripped;
  }
  // If address is just "City, State" leave street empty
  if (city && a.toLowerCase().startsWith(city.toLowerCase())) return "";
  return a;
}

function contactRank(title: string): number {
  const t = title.toLowerCase();
  if (/\b(chief of (college )?police|chief of police|police chief)\b/.test(t)) return 100;
  if (/\b(911 director|emergency communications director|communications director)\b/.test(t))
    return 95;
  if (/\b(director of public safety|public safety director)\b/.test(t)) return 90;
  if (/\bcampus (police|safety)\b/.test(t)) return 85;
  if (/\bassociate vice president\b/.test(t)) return 70;
  if (/\bcity manager\b/.test(t)) return 60;
  if (/\bassistant city manager\b/.test(t)) return 40;
  return 20;
}

function campusListFor(company: string): { listKey: string; listLabel: string } {
  const n = company.toLowerCase();
  if (
    /\bhbcus?\b/.test(n) ||
    /\bhistorically black\b/.test(n) ||
    /\b(howard university|spelman|morehouse|hampton university|fisk university|tuskegee)\b/.test(n)
  ) {
    return { listKey: "campus-hbcu", listLabel: "HBCU Campuses" };
  }
  if (
    /\bcommunity college\b/.test(n) ||
    /\bjunior college\b/.test(n) ||
    /\btechnical college\b/.test(n) ||
    /\bcc system\b/.test(n)
  ) {
    return { listKey: "campus-cc-systems", listLabel: "Community College Systems" };
  }
  return { listKey: "campus-universities", listLabel: "Physical University Campuses" };
}

function stableId(prefix: string, name: string): string {
  const hash = createHash("sha256").update(name.toLowerCase()).digest("hex").slice(0, 12);
  return `${prefix}-${hash}`;
}

async function upsertEmailList(opts: {
  email: string;
  vertical: "PSAP" | "CAMPUS";
  name?: string;
  agencyName?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  state?: string;
}): Promise<"created" | "updated" | "skipped"> {
  const email = opts.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const existingList = await ddb.send(
    new GetCommand({
      TableName: PIPELINE,
      Key: { pk: `EMAILLIST#${opts.vertical}`, sk: `EMAIL#${email}` },
    }),
  );
  const listItem = existingList.Item;
  if (listItem && listItem.unsubscribed === true) return "skipped";

  const entry = {
    email,
    vertical: opts.vertical,
    name: opts.name || (typeof listItem?.name === "string" ? listItem.name : undefined),
    agencyName:
      opts.agencyName ||
      (typeof listItem?.agencyName === "string" ? listItem.agencyName : undefined),
    source: "apollo",
    createdAt:
      typeof listItem?.createdAt === "string" ? listItem.createdAt : now,
    createdBy:
      typeof listItem?.createdBy === "string"
        ? listItem.createdBy
        : "system:apollo-csv-import",
    unsubscribed: false,
  };

  if (!DRY_RUN) {
    await ddb.send(
      new PutCommand({
        TableName: PIPELINE,
        Item: {
          ...entry,
          pk: `EMAILLIST#${opts.vertical}`,
          sk: `EMAIL#${email}`,
          entityType: "email_list",
          agencyId: "platform",
          updatedAt: now,
        },
      }),
    );
  }

  const existingLead = await ddb.send(
    new GetCommand({
      TableName: MARKETING,
      Key: { pk: `LEAD#${email}`, sk: "PROFILE" },
    }),
  );
  const lead = existingLead.Item;
  const leadVertical = opts.vertical === "CAMPUS" ? "campus" : "rc911";
  if (lead && (lead.status === "unsubscribed" || lead.status === "bounced" || lead.status === "complained")) {
    return listItem ? "updated" : "created";
  }

  if (!lead) {
    const unsubscribeToken = randomUUID();
    const leadId = randomUUID();
    const ttl = Math.floor(Date.now() / 1000) + 365 * 3 * 86400;
    if (!DRY_RUN) {
      await ddb.send(
        new PutCommand({
          TableName: MARKETING,
          Item: {
            pk: `LEAD#${email}`,
            sk: "PROFILE",
            leadId,
            email,
            firstName: opts.firstName || undefined,
            lastName: opts.lastName || undefined,
            title: opts.title || undefined,
            agencyName: opts.agencyName || undefined,
            state: opts.state || undefined,
            vertical: leadVertical,
            source: "apollo",
            sourceId: "apollo-csv-import",
            subscribed: true,
            status: "active",
            unsubscribeToken,
            createdAt: now,
            updatedAt: now,
            ttl,
          },
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
      await ddb.send(
        new PutCommand({
          TableName: MARKETING,
          Item: {
            pk: `TOKEN#${unsubscribeToken}`,
            sk: "UNSUBSCRIBE",
            email,
            leadId,
            ttl,
          },
        }),
      );
    }
  } else if (!DRY_RUN) {
    const names: Record<string, string> = { "#vertical": "vertical", "#src": "source" };
    const values: Record<string, unknown> = {
      ":vertical": leadVertical,
      ":now": now,
      ":source": "apollo",
      ":true": true,
    };
    let expr =
      "SET #vertical = if_not_exists(#vertical, :vertical), updatedAt = :now, " +
      "#src = if_not_exists(#src, :source), subscribed = if_not_exists(subscribed, :true)";
    if (opts.firstName) {
      expr += ", firstName = if_not_exists(firstName, :firstName)";
      values[":firstName"] = opts.firstName;
    }
    if (opts.lastName) {
      expr += ", lastName = if_not_exists(lastName, :lastName)";
      values[":lastName"] = opts.lastName;
    }
    if (opts.title) {
      expr += ", title = if_not_exists(title, :title)";
      values[":title"] = opts.title;
    }
    if (opts.agencyName) {
      expr += ", agencyName = if_not_exists(agencyName, :agencyName)";
      values[":agencyName"] = opts.agencyName;
    }
    if (opts.state) {
      expr += ", #st = if_not_exists(#st, :state)";
      names["#st"] = "state";
      values[":state"] = opts.state;
    }
    await ddb.send(
      new UpdateCommand({
        TableName: MARKETING,
        Key: { pk: `LEAD#${email}`, sk: "PROFILE" },
        UpdateExpression: expr,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
  }

  return listItem ? "updated" : "created";
}

async function scanAllPsaps(): Promise<PsapProspect[]> {
  const out: PsapProspect[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const r = await ddb.send(
      new ScanCommand({
        TableName: PSAP_TABLE,
        ExclusiveStartKey,
      }),
    );
    out.push(...((r.Items as PsapProspect[]) ?? []));
    ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return out;
}

function pickBestContact(rows: ApolloRow[]): ApolloRow {
  return [...rows].sort((a, b) => contactRank(b.title) - contactRank(a.title))[0]!;
}

function recomputeCounts(items: OutreachProspect[]): OutreachCatalog["counts"] {
  const byVertical: Record<string, number> = {};
  const byList: Record<string, number> = {};
  for (const item of items) {
    byVertical[item.vertical] = (byVertical[item.vertical] ?? 0) + 1;
    byList[item.listKey] = (byList[item.listKey] ?? 0) + 1;
  }
  return { total: items.length, byVertical, byList };
}

async function importCampus(rows: ApolloRow[]): Promise<{
  emailCreated: number;
  emailUpdated: number;
  emailSkipped: number;
  prospectsFilled: number;
  prospectsCreated: number;
}> {
  const catalog = JSON.parse(readFileSync(OUTREACH_JSON, "utf8")) as OutreachCatalog;
  const byNorm = new Map<string, OutreachProspect>();
  for (const item of catalog.items) {
    if (item.vertical !== "campus") continue;
    byNorm.set(normalizeName(item.name), item);
  }

  const byCompany = new Map<string, ApolloRow[]>();
  for (const row of rows) {
    const key = row.company.trim().toLowerCase();
    const list = byCompany.get(key) ?? [];
    list.push(row);
    byCompany.set(key, list);
  }

  let emailCreated = 0;
  let emailUpdated = 0;
  let emailSkipped = 0;
  let prospectsFilled = 0;
  let prospectsCreated = 0;

  for (const row of rows) {
    const result = await upsertEmailList({
      email: row.email,
      vertical: "CAMPUS",
      name: displayName(row) || undefined,
      agencyName: row.company,
      firstName: row.firstName || undefined,
      lastName: row.lastName || undefined,
      title: row.title || undefined,
      state: toStateAbbr(row.state) || undefined,
    });
    if (result === "created") emailCreated += 1;
    else if (result === "updated") emailUpdated += 1;
    else emailSkipped += 1;
  }

  for (const [, companyRows] of byCompany) {
    const best = pickBestContact(companyRows);
    const norm = normalizeName(best.company);
    let item = byNorm.get(norm);
    // Fuzzy: try includes either way for short unique tokens
    if (!item && norm.length >= 6) {
      for (const [k, v] of byNorm) {
        if (k.includes(norm) || norm.includes(k)) {
          item = v;
          break;
        }
      }
    }

    const state = toStateAbbr(best.state);
    const city = best.city;
    const street = streetFromApolloAddress(best.address, best.city, best.state);
    const contact = displayName(best);

    if (item) {
      let changed = false;
      if (!item.email && best.email) {
        item.email = best.email;
        changed = true;
      }
      if ((!item.contactName || /police|public safety|administration/i.test(item.contactName)) && contact) {
        if (!item.contactName || contactRank(best.title) >= 70) {
          item.contactName = contact;
          item.contactRole = best.title || item.contactRole;
          changed = true;
        }
      } else if (!item.contactRole && best.title) {
        item.contactRole = best.title;
        changed = true;
      }
      if (!item.city && city) {
        item.city = city;
        changed = true;
      }
      if (!item.state && state) {
        item.state = state;
        changed = true;
      }
      if (!item.address && street) {
        item.address = street;
        changed = true;
      }
      if (changed) prospectsFilled += 1;
      continue;
    }

    const list = campusListFor(best.company);
    const created: OutreachProspect = {
      id: stableId(list.listKey, best.company),
      vertical: "campus",
      listKey: list.listKey,
      listLabel: list.listLabel,
      name: best.company,
      state,
      city,
      phone: "",
      email: best.email,
      website: "",
      address: street,
      contactName: contact,
      contactRole: best.title,
      priority: "apollo",
    };
    catalog.items.push(created);
    byNorm.set(norm, created);
    prospectsCreated += 1;
  }

  catalog.generatedAt = new Date().toISOString().slice(0, 10);
  catalog.counts = recomputeCounts(catalog.items);
  if (!DRY_RUN) {
    writeFileSync(OUTREACH_JSON, `${JSON.stringify(catalog)}\n`, "utf8");
  }

  return {
    emailCreated,
    emailUpdated,
    emailSkipped,
    prospectsFilled,
    prospectsCreated,
  };
}

async function importPsap(rows: ApolloRow[]): Promise<{
  emailCreated: number;
  emailUpdated: number;
  emailSkipped: number;
  prospectsFilled: number;
  prospectsCreated: number;
}> {
  console.log("Scanning PSAP prospects table…");
  const all = await scanAllPsaps();
  console.log(`Loaded ${all.length} PSAP prospects`);

  const byNorm = new Map<string, PsapProspect[]>();
  const byCityState = new Map<string, PsapProspect[]>();
  for (const p of all) {
    const n = normalizeName(p.psapName);
    if (n) {
      const list = byNorm.get(n) ?? [];
      list.push(p);
      byNorm.set(n, list);
    }
    const cs = `${(p.city || "").toLowerCase().trim()}|${(p.state || "").toUpperCase().trim()}`;
    if (p.city && p.state) {
      const list = byCityState.get(cs) ?? [];
      list.push(p);
      byCityState.set(cs, list);
    }
  }

  const byCompany = new Map<string, ApolloRow[]>();
  for (const row of rows) {
    const key = row.company.trim().toLowerCase();
    const list = byCompany.get(key) ?? [];
    list.push(row);
    byCompany.set(key, list);
  }

  let emailCreated = 0;
  let emailUpdated = 0;
  let emailSkipped = 0;
  let prospectsFilled = 0;
  let prospectsCreated = 0;

  for (const row of rows) {
    const result = await upsertEmailList({
      email: row.email,
      vertical: "PSAP",
      name: displayName(row) || undefined,
      agencyName: row.company,
      firstName: row.firstName || undefined,
      lastName: row.lastName || undefined,
      title: row.title || undefined,
      state: toStateAbbr(row.state) || undefined,
    });
    if (result === "created") emailCreated += 1;
    else if (result === "updated") emailUpdated += 1;
    else emailSkipped += 1;
  }

  for (const [, companyRows] of byCompany) {
    const best = pickBestContact(companyRows);
    const state = toStateAbbr(best.state);
    const city = best.city;
    const norm = normalizeName(best.company);
    let matches = byNorm.get(norm) ?? [];

    if (!matches.length && norm.length >= 5) {
      for (const [k, list] of byNorm) {
        if (k.includes(norm) || norm.includes(k)) {
          matches = list;
          break;
        }
      }
    }

    if (!matches.length && city && state) {
      const cs = `${city.toLowerCase()}|${state}`;
      const cityMatches = byCityState.get(cs) ?? [];
      // Prefer PSAPs whose name mentions the city or "city of"
      const preferred = cityMatches.filter((p) =>
        p.psapName.toLowerCase().includes(city.toLowerCase()),
      );
      matches = preferred.length ? preferred : cityMatches.slice(0, 1);
    }

    const contactName = displayName(best);
    const street = streetFromApolloAddress(best.address, best.city, best.state);
    const now = new Date().toISOString();

    const contactRecord = {
      contactId: randomUUID(),
      name: contactName || null,
      title: best.title || "Contact",
      roleTier: contactRank(best.title) >= 90 ? "primary" : "secondary",
      email: best.email,
      emailVerified: false,
      phone: null,
      verificationStatus: "unverified",
      verificationSource: "apollo-csv",
      source: "apollo",
      addedAt: now,
    };

    if (matches.length) {
      for (const prospect of matches) {
        const existingEmails = new Set(
          (prospect.contacts ?? [])
            .map((c) => (typeof c.email === "string" ? c.email.toLowerCase() : ""))
            .filter(Boolean),
        );
        for (const row of companyRows) {
          if (row.email && !existingEmails.has(row.email)) {
            existingEmails.add(row.email);
            const rec = {
              ...contactRecord,
              contactId: randomUUID(),
              name: displayName(row) || null,
              title: row.title || "Contact",
              email: row.email,
              roleTier: contactRank(row.title) >= 90 ? "primary" : "secondary",
            };
            prospect.contacts = [...(prospect.contacts ?? []), rec];
          }
        }
        prospect.contactCount = prospect.contacts?.length ?? 0;
        prospect.lastEnrichedAt = now;
        prospect.updatedAt = now;

        let filled = false;
        if (!prospect.primaryContactEmail && best.email) {
          prospect.primaryContactEmail = best.email;
          filled = true;
        }
        if (!prospect.primaryContactName && contactName) {
          prospect.primaryContactName = contactName;
          filled = true;
        }
        if (!prospect.primaryContactTitle && best.title) {
          prospect.primaryContactTitle = best.title;
          filled = true;
        }
        if (
          street &&
          (!prospect.mailingAddress ||
            !(prospect.mailingAddress as { streetAddress?: string }).streetAddress)
        ) {
          prospect.mailingAddress = {
            ...(prospect.mailingAddress ?? {}),
            streetAddress: street,
            city: city || prospect.city || "",
            state: state || prospect.state || "",
            county: prospect.county || "",
            verified: false,
            source: "apollo",
          };
          filled = true;
        }
        if (filled || (prospect.contacts?.length ?? 0) > 0) {
          // StateUpdatedIndex / PhoneIndex reject empty-string keys.
          if (!String(prospect.state ?? "").trim()) {
            continue;
          }
          const item: Record<string, unknown> = { ...prospect };
          if (!String(item.phone ?? "").trim()) delete item.phone;
          if (!String(item.fips ?? "").trim()) delete item.fips;
          if (!String(item.county ?? "").trim()) delete item.county;
          prospectsFilled += 1;
          if (!DRY_RUN) {
            await ddb.send(
              new PutCommand({
                TableName: PSAP_TABLE,
                Item: item,
              }),
            );
          }
        }
      }
      continue;
    }

    // No match — create a lightweight Apollo prospect so it appears under PSAP vertical.
    // StateUpdatedIndex rejects empty string keys — require a real state abbr.
    if (!state) {
      continue;
    }
    const psapId = randomUUID();
    // PhoneIndex / StateUpdatedIndex reject empty-string keys — omit blank attrs (sparse GSIs).
    const created: Record<string, unknown> = {
      psapId,
      psapName: best.company,
      state,
      city: city || "Unknown",
      latitude: 0,
      longitude: 0,
      primaryContactName: contactName || undefined,
      primaryContactTitle: best.title || undefined,
      primaryContactEmail: best.email,
      contacts: companyRows.map((row) => ({
        contactId: randomUUID(),
        name: displayName(row) || null,
        title: row.title || "Contact",
        roleTier: contactRank(row.title) >= 90 ? "primary" : "secondary",
        email: row.email,
        emailVerified: false,
        phone: null,
        verificationStatus: "unverified",
        verificationSource: "apollo-csv",
        source: "apollo",
        addedAt: now,
      })),
      contactCount: companyRows.length,
      lastEnrichedAt: now,
      outreachStatus: "UNCONTACTED",
      activities: [],
      createdAt: now,
      updatedAt: now,
      importedFrom: `apollo_psap_csv_${now.slice(0, 10)}`,
      notes: "Imported from Apollo PSAP contact CSV",
    };
    if (street || city) {
      created.mailingAddress = {
        ...(street ? { streetAddress: street } : {}),
        city: city || "Unknown",
        state,
        verified: false,
        source: "apollo",
      };
    }
    prospectsCreated += 1;
    if (!DRY_RUN) {
      await ddb.send(
        new PutCommand({
          TableName: PSAP_TABLE,
          Item: created,
          ConditionExpression: "attribute_not_exists(psapId)",
        }),
      );
    }
  }

  return {
    emailCreated,
    emailUpdated,
    emailSkipped,
    prospectsFilled,
    prospectsCreated,
  };
}

async function main() {
  console.log(
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        stage: STAGE,
        campusCsv: CAMPUS_CSV,
        psapCsv: PSAP_CSV,
        marketing: MARKETING,
        pipeline: PIPELINE,
        psapTable: PSAP_TABLE,
      },
      null,
      2,
    ),
  );

  const campusRows = parseApolloCsv(CAMPUS_CSV);
  const psapRows = parseApolloCsv(PSAP_CSV);
  console.log(`Campus rows with email+company: ${campusRows.length}`);
  console.log(`PSAP rows with email+company: ${psapRows.length}`);

  const campus = await importCampus(campusRows);
  console.log("Campus result:", campus);

  const psap = await importPsap(psapRows);
  console.log("PSAP result:", psap);

  console.log(DRY_RUN ? "Dry run complete — no writes." : "Import complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
