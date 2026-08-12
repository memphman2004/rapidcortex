/**
 * Seed Allied Universal company + three confirmed contacts into the Contacts address book.
 *
 * Usage:
 *   CONTACT_COMPANIES_TABLE=rapid-cortex-contact-companies-dev \
 *   CONTACT_PERSONS_TABLE=rapid-cortex-contact-persons-dev \
 *     npx tsx scripts/seed-contacts-au.ts
 *
 *   STAGE=dev npx tsx scripts/seed-contacts-au.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const stage = process.env.STAGE?.trim() || process.env.DEPLOYMENT_STAGE?.trim() || "dev";
const companiesTable =
  process.env.CONTACT_COMPANIES_TABLE?.trim() || `rapid-cortex-contact-companies-${stage}`;
const personsTable =
  process.env.CONTACT_PERSONS_TABLE?.trim() || `rapid-cortex-contact-persons-${stage}`;

const now = new Date().toISOString();

const AU_COMPANY = {
  companyId: "company#allied-universal",
  name: "Allied Universal",
  relationshipType: "partner",
  verticals: ["venue", "campus"],
  industry: "Physical Security Services",
  website: "https://www.aus.com",
  hq: "Santa Ana, CA",
  phone: null,
  linkedInUrl: "https://www.linkedin.com/company/allied-universal",
  notes:
    "Gold sponsor at Secure Venues Summit 2026 (Sept 28, Seattle). " +
    "800,000+ employees. $20B+ revenue. " +
    "Primary contacts: Taylor Carr (Tech Services), " +
    "Ken Woodlin (Chief Safety), DelMar Laury (Southeast).",
  tags: ["SVS 2026", "Partnership", "Physical Security", "Event Security"],
  contactCount: 3,
  linkedSignalIds: [],
  linkedProspectIds: [],
  lastActivityAt: now,
  addedBy: "seed:contacts-au",
  createdAt: now,
  updatedAt: now,
};

const AU_CONTACTS = [
  {
    contactId: "contact#taylor-carr-au",
    companyId: "company#allied-universal",
    companyName: "Allied Universal",
    firstName: "Taylor",
    lastName: "Carr",
    title: "President, Technology Services",
    department: "Technology Services",
    email: "taylor.carr@aus.com",
    emailVerified: true,
    phone: null,
    mobilePhone: null,
    linkedInUrl: null,
    location: "United States",
    notes: "Primary technology partnership contact. Runs AU's Technology Services business unit.",
    source: "manual",
    verifiedAt: now,
    tags: ["technology", "partnership", "primary"],
    lastContactedAt: null,
    lastContactedBy: null,
    outreachStatus: "not_contacted",
    addedBy: "seed:contacts-au",
    createdAt: now,
    updatedAt: now,
  },
  {
    contactId: "contact#ken-woodlin-au",
    companyId: "company#allied-universal",
    companyName: "Allied Universal",
    firstName: "Ken",
    lastName: "Woodlin",
    title: "Chief Safety and Risk Officer, North America",
    department: "Safety & Risk",
    email: "ken.woodlin@aus.com",
    emailVerified: true,
    phone: null,
    mobilePhone: null,
    linkedInUrl: null,
    location: "North America",
    notes:
      "Owns safety outcomes across all NA operations. RC's guest reporting gap story is directly his problem.",
    source: "manual",
    verifiedAt: now,
    tags: ["safety", "risk", "primary"],
    lastContactedAt: null,
    lastContactedBy: null,
    outreachStatus: "not_contacted",
    addedBy: "seed:contacts-au",
    createdAt: now,
    updatedAt: now,
  },
  {
    contactId: "contact#delmar-laury-au",
    companyId: "company#allied-universal",
    companyName: "Allied Universal",
    firstName: "DelMar",
    lastName: "Laury",
    title: "Southeast Regional President",
    department: "Regional Operations",
    email: "delmar.laury@aus.com",
    emailVerified: true,
    phone: null,
    mobilePhone: null,
    linkedInUrl: null,
    location: "Southeast United States",
    notes: "Covers GA, AL, FL, SC, TN — RC's primary market. Start local before going to corporate.",
    source: "manual",
    verifiedAt: now,
    tags: ["southeast", "regional", "local"],
    lastContactedAt: null,
    lastContactedBy: null,
    outreachStatus: "not_contacted",
    addedBy: "seed:contacts-au",
    createdAt: now,
    updatedAt: now,
  },
];

async function main() {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  console.log(`Seeding Allied Universal → ${companiesTable} / ${personsTable}`);
  await client.send(new PutCommand({ TableName: companiesTable, Item: AU_COMPANY }));
  for (const contact of AU_CONTACTS) {
    await client.send(new PutCommand({ TableName: personsTable, Item: contact }));
    console.log(`  + ${contact.firstName} ${contact.lastName}`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
