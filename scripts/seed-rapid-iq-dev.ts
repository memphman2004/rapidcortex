#!/usr/bin/env npx tsx
/**
 * Seeds 10 Rapid IQ opportunities (+ signals/contacts/sources) for local/dev demos.
 * Run: STAGE=dev npx tsx scripts/seed-rapid-iq-dev.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

const STAGE = process.env.STAGE ?? "dev";
const PREFIX = process.env.DYNAMO_TABLE_PREFIX ?? "rapid-cortex";
const OPP =
  process.env.RAPID_IQ_OPPORTUNITIES_TABLE ?? `${PREFIX}-rapid-iq-opportunities-${STAGE}`;
const SIG = process.env.RAPID_IQ_SIGNALS_TABLE ?? `${PREFIX}-rapid-iq-signals-${STAGE}`;
const CON = process.env.RAPID_IQ_CONTACTS_TABLE ?? `${PREFIX}-rapid-iq-contacts-${STAGE}`;
const SRC = process.env.RAPID_IQ_SOURCES_TABLE ?? `${PREFIX}-rapid-iq-sources-${STAGE}`;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const now = new Date().toISOString();

type SeedOpp = {
  opportunityId: string;
  vertical: "911" | "campus" | "venue";
  agencyName: string;
  state: string;
  county: string;
  city: string;
  population: number;
  opportunityScore: number;
  estimatedDollarValue: number;
  aiHeadline: string;
  aiSummary: string;
  tags: string[];
  isActNow: boolean;
  intentStage: "awareness" | "evaluation" | "active_rfp" | "award_imminent";
  incumbentVendor: string | null;
  rcProduct: "core" | "campus" | "venue" | "connect";
};

const SEEDS: SeedOpp[] = [
  {
    opportunityId: "seed-fl-desoto",
    vertical: "911",
    agencyName: "DeSoto County ECC",
    state: "FL",
    county: "DeSoto",
    city: "Arcadia",
    population: 36744,
    opportunityScore: 95,
    estimatedDollarValue: 850000,
    aiHeadline: "DeSoto County ECC soliciting next-gen CAD/911 platform replacement",
    aiSummary:
      "Commission minutes authorize $850K for DeSoto County ECC modernization including CAD replacement and NG911-ready recording. The ECC serves Arcadia and surrounding DeSoto County with a Hexagon incumbent stack under active displacement review. Rapid Cortex Core's real-time transcription, CAD integration, and AI coaching map directly to the next-gen CAD/911 platform replacement they are soliciting. Outreach should happen before RFP scoring closes — this is an active procurement window.",
    tags: ["RFP LIVE", "NG911", "PSAP SOFTWARE"],
    isActNow: true,
    intentStage: "active_rfp",
    incumbentVendor: "Hexagon",
    rcProduct: "core",
  },
  {
    opportunityId: "seed-wv-upshur",
    vertical: "911",
    agencyName: "Upshur County 911",
    state: "WV",
    county: "Upshur",
    city: "Buckhannon",
    population: 24623,
    opportunityScore: 92,
    estimatedDollarValue: 420000,
    aiHeadline: "Upshur County evaluating NG911 recording and analytics stack",
    aiSummary:
      "A budget workshop discusses $420K for NG911 readiness including recording analytics and QA tooling for Upshur County 911. The center currently runs a Motorola Solutions–centric stack and is assessing analytics that improve call QA and supervisor visibility. Rapid Cortex Core's AI coaching and real-time transcription complement NG911 recording modernization without requiring a full CAD rip-and-replace. Contact before the next commission budget vote — the evaluation window is open now.",
    tags: ["NG911", "OPPORTUNITY"],
    isActNow: true,
    intentStage: "evaluation",
    incumbentVendor: "Motorola Solutions",
    rcProduct: "core",
  },
  {
    opportunityId: "seed-ga-muscogee",
    vertical: "911",
    agencyName: "Muscogee County 911",
    state: "GA",
    county: "Muscogee",
    city: "Columbus",
    population: 206922,
    opportunityScore: 78,
    estimatedDollarValue: 1200000,
    aiHeadline: "Muscogee County reviewing AI-assisted dispatch tooling",
    aiSummary:
      "The July Muscogee County Commission budget workshop discusses $1.2M in capital improvements for 911 technology modernization, specifically mentioning AI-assisted dispatch tools and supervisor coaching systems. Muscogee County 911 currently runs a legacy CAD environment and serves Columbus GA — population 206,922 — with high annual call volume. Rapid Cortex Core's real-time transcription, AI coaching, and CAD integration directly address the AI dispatch tooling they are evaluating; this is RC's home market. Outreach should happen before the next commission meeting — the budget approval window is open now.",
    tags: ["PSAP SOFTWARE", "CAD INTEGRATION"],
    isActNow: false,
    intentStage: "evaluation",
    incumbentVendor: null,
    rcProduct: "core",
  },
  {
    opportunityId: "seed-al-jefferson",
    vertical: "911",
    agencyName: "Jefferson County EMA",
    state: "AL",
    county: "Jefferson",
    city: "Birmingham",
    population: 674721,
    opportunityScore: 71,
    estimatedDollarValue: 2100000,
    aiHeadline: "Jefferson County EMA exploring multi-PSAP consolidation software",
    aiSummary:
      "Jefferson County EMA materials reference a $2.1M emergency communications and multi-PSAP consolidation software initiative with CentralSquare cited as the incumbent environment. The county serves the Birmingham metro and is modernizing EMA/911 coordination tooling under a regional capital plan. Rapid Cortex Core can displace or complement CentralSquare workflows with AI-assisted dispatch intelligence and CAD-adjacent transcription. Competitor displacement outreach should land before the next EMA board or procurement milestone — within the current capital cycle.",
    tags: ["OPPORTUNITY", "COMPETITOR"],
    isActNow: false,
    intentStage: "awareness",
    incumbentVendor: "CentralSquare",
    rcProduct: "core",
  },
  {
    opportunityId: "seed-uga",
    vertical: "campus",
    agencyName: "University of Georgia Police",
    state: "GA",
    county: "Clarke",
    city: "Athens",
    population: 40118,
    opportunityScore: 74,
    estimatedDollarValue: 350000,
    aiHeadline: "UGA Police evaluating campus safety console and QR wayfinding",
    aiSummary: "Board materials reference campus safety tech refresh and emergency notification upgrades.",
    tags: ["OPPORTUNITY"],
    isActNow: false,
    intentStage: "evaluation",
    incumbentVendor: null,
    rcProduct: "campus",
  },
  {
    opportunityId: "seed-gt",
    vertical: "campus",
    agencyName: "Georgia Tech Police",
    state: "GA",
    county: "Fulton",
    city: "Atlanta",
    population: 45000,
    opportunityScore: 68,
    estimatedDollarValue: 275000,
    aiHeadline: "Georgia Tech reviewing campus dispatch and Clery reporting workflow",
    aiSummary: "IT governance notes cite Clery automation and campus console consolidation.",
    tags: ["OPPORTUNITY"],
    isActNow: false,
    intentStage: "awareness",
    incumbentVendor: null,
    rcProduct: "campus",
  },
  {
    opportunityId: "seed-gsu",
    vertical: "campus",
    agencyName: "Georgia State University Public Safety",
    state: "GA",
    county: "Fulton",
    city: "Atlanta",
    population: 52000,
    opportunityScore: 66,
    estimatedDollarValue: 190000,
    aiHeadline: "GSU public safety exploring incident media and campus QR locations",
    aiSummary: "Procurement pre-solicitation for campus safety software suite.",
    tags: ["OPPORTUNITY"],
    isActNow: false,
    intentStage: "awareness",
    incumbentVendor: null,
    rcProduct: "campus",
  },
  {
    opportunityId: "seed-venue-mbs",
    vertical: "venue",
    agencyName: "Mercedes-Benz Stadium",
    state: "GA",
    county: "Fulton",
    city: "Atlanta",
    population: 71000,
    opportunityScore: 80,
    estimatedDollarValue: 480000,
    aiHeadline: "Mercedes-Benz Stadium RFI for venue operations + guest services console",
    aiSummary: "Security ops seeking unified guest-report and security console with orange-branded workflows.",
    tags: ["RFP LIVE", "OPPORTUNITY"],
    isActNow: false,
    intentStage: "active_rfp",
    incumbentVendor: null,
    rcProduct: "venue",
  },
  {
    opportunityId: "seed-venue-trui",
    vertical: "venue",
    agencyName: "Truist Park",
    state: "GA",
    county: "Cobb",
    city: "Atlanta",
    population: 41000,
    opportunityScore: 72,
    estimatedDollarValue: 310000,
    aiHeadline: "Truist Park evaluating venue security incident intake",
    aiSummary: "Meeting notes mention guest services escalation and security radio integration.",
    tags: ["OPPORTUNITY"],
    isActNow: false,
    intentStage: "evaluation",
    incumbentVendor: null,
    rcProduct: "venue",
  },
  {
    opportunityId: "seed-venue-amalie",
    vertical: "venue",
    agencyName: "Amalie Arena",
    state: "FL",
    county: "Hillsborough",
    city: "Tampa",
    population: 19000,
    opportunityScore: 69,
    estimatedDollarValue: 220000,
    aiHeadline: "Amalie Arena exploring event-day ops console",
    aiSummary: "Budget line for venue operations software and guest services routing.",
    tags: ["OPPORTUNITY", "GRANT FUNDING"],
    isActNow: false,
    intentStage: "awareness",
    incumbentVendor: null,
    rcProduct: "venue",
  },
];

const SEED_SOURCE_URLS: Record<string, { url: string; docUrl: string; sourceName: string }> = {
  "seed-fl-desoto": {
    url: "https://www.desotocountyfl.gov/government/bcc/agendas",
    docUrl: "https://www.desotocountyfl.gov/government/bcc/agendas",
    sourceName: "DeSoto County BCC agendas",
  },
  "seed-wv-upshur": {
    url: "https://upshurwv.org/commission/agendas",
    docUrl: "https://upshurwv.org/commission/agendas",
    sourceName: "Upshur County Commission agendas",
  },
  "seed-ga-muscogee": {
    url: "https://www.columbusga.gov/government/council/agendas",
    docUrl: "https://www.columbusga.gov/government/council/agendas",
    sourceName: "Columbus / Muscogee County Council agendas",
  },
  "seed-al-jefferson": {
    url: "https://www.jccal.org",
    docUrl: "https://www.jccal.org",
    sourceName: "Jefferson County AL Commission",
  },
  "seed-uga": {
    url: "https://www.usg.edu/board/meeting-materials",
    docUrl: "https://www.usg.edu/board/meeting-materials",
    sourceName: "University System of Georgia Board meeting materials",
  },
};

async function main() {
  console.log(`Seeding ${SEEDS.length} opportunities → ${OPP}`);
  for (const s of SEEDS) {
    const talkingPoints = [
      `Open with the ${s.aiHeadline} signal.`,
      `Confirm the ~$${s.estimatedDollarValue.toLocaleString()} budget status.`,
      s.incumbentVendor
        ? `Ask how ${s.incumbentVendor} fits their 12-month plan.`
        : "Ask which incumbent stack they run today.",
      `Position Rapid Cortex ${s.rcProduct} for ${s.agencyName}.`,
      "Offer a 20-minute tailored demo this week.",
    ];
    await ddb.send(
      new PutCommand({
        TableName: OPP,
        Item: {
          ...s,
          agencyType:
            s.vertical === "campus" ? "university" : s.vertical === "venue" ? "venue" : "county_911",
          fitScore: Math.max(40, s.opportunityScore - 6),
          estimatedDecisionDays: 60,
          contractExpirySignal: Boolean(s.incumbentVendor),
          dollarValueSource: "Seed agenda extract",
          talkingPoints,
          signalCount: 2,
          lastSignalAt: now,
          detectedAt: now,
          lastRefreshedAt: now,
          status: "new",
          convertedLeadId: null,
          assignedTo: null,
          notes: null,
        },
      }),
    );

    const sourceMeta = SEED_SOURCE_URLS[s.opportunityId] ?? {
      url: `https://www.${s.city.toLowerCase().replace(/\s+/g, "")}.gov/meetings`,
      docUrl: `https://www.${s.city.toLowerCase().replace(/\s+/g, "")}.gov/meetings`,
      sourceName: `${s.county} public meetings`,
    };

    for (let i = 0; i < 2; i++) {
      const signalId = `sig#${s.opportunityId}#${i}`;
      await ddb.send(
        new PutCommand({
          TableName: SIG,
          Item: {
            signalId,
            opportunityId: s.opportunityId,
            signalType: i === 0 ? "meeting_minutes" : "budget",
            title: s.aiHeadline,
            summary: s.aiSummary,
            excerpt: "public safety software procurement",
            sourceName: sourceMeta.sourceName,
            sourceType: "government_doc",
            sourceUrl: sourceMeta.url,
            sourceDocUrl: sourceMeta.docUrl,
            pageReference: i === 0 ? "agenda" : "budget",
            publishedAt: now,
            detectedAt: now,
            scoreContrib: 18,
          },
        }),
      );
      await ddb.send(
        new PutCommand({
          TableName: SRC,
          Item: {
            sourceId: `src#${signalId}`,
            opportunityId: s.opportunityId,
            sourceRole: i === 0 ? "primary" : "budget",
            title: `${s.agencyName} — ${sourceMeta.sourceName}`,
            url: sourceMeta.url,
            docUrl: sourceMeta.docUrl,
            documentType: i === 0 ? "agenda" : "budget_pdf",
            excerpt: "public safety software procurement",
            pageReference: i === 0 ? "agenda" : "budget",
            publishedAt: now,
            retrievedAt: now,
          },
        }),
      );
    }

    const contacts = [
      {
        name: "Jordan Lee",
        title: "Communications Director",
        roleTier: "primary",
        matchType: "exact",
        verificationStatus: "verified",
        email: `comms@${s.opportunityId}.example`,
        emailVerified: true,
      },
      {
        name: "Casey Morgan",
        title: "IT / CAD Manager",
        roleTier: "secondary",
        matchType: "related",
        verificationStatus: "predicted",
        email: `cad@${s.opportunityId}.example`,
        emailVerified: false,
      },
      {
        name: null,
        title: "Procurement Officer",
        roleTier: "procurement",
        matchType: "none",
        verificationStatus: "unverified",
        email: null,
        emailVerified: false,
      },
    ];
    for (const c of contacts) {
      await ddb.send(
        new PutCommand({
          TableName: CON,
          Item: {
            contactId: randomUUID(),
            opportunityId: s.opportunityId,
            name: c.name,
            title: c.title,
            roleTier: c.roleTier,
            matchType: c.matchType,
            matchedOn: c.title,
            verificationStatus: c.verificationStatus,
            verificationSource: c.verificationStatus === "verified" ? "agency directory" : null,
            sourceCount: c.verificationStatus === "verified" ? 2 : 0,
            verifiedAt: c.verificationStatus === "verified" ? now : null,
            sourceUrl: null,
            email: c.email,
            emailVerified: c.emailVerified,
            phone: null,
            linkedInUrl: null,
          },
        }),
      );
    }
  }
  console.log(`✓ Seeded ${SEEDS.length} opportunities with signals, sources, and contacts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
