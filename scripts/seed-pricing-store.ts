/**
 * One-time bootstrap for the PricingTable.
 *
 * Usage:
 *   PRICING_TABLE=rapid-cortex-pricing-prod \
 *   SEED_USER_EMAIL=rcsuperadmin@appsondemand.net \
 *   npx tsx scripts/seed-pricing-store.ts
 *
 * Re-run safety: skips if CONFIG#META already exists unless FORCE_RESEED=true.
 *
 * All amounts are in cents (integer). Never floating point.
 * All dates are UTC ISO-8601.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import type { CatalogItem, PlanTier } from "../packages/shared/src/pricing/pricing-types.js";

const TABLE = process.env.PRICING_TABLE;
if (!TABLE) {
  console.error("ERROR: PRICING_TABLE env var is required");
  process.exit(1);
}
const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL ?? "seed@system";
const FORCE_RESEED = process.env.FORCE_RESEED === "true";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const PK_GLOBAL = "PRICING#GLOBAL";
const PK_AUDIT = "PRICING#AUDIT";

const CAT_SK_PREFIX: Record<string, string> = {
  core: "PLAN",
  addon: "ADDON",
  support: "SUPPORT",
  professional: "PROFESSIONAL",
  vertical: "VERTICAL",
  rc_lite: "RC_LITE",
};

function skForItem(item: CatalogItem): string {
  const prefix = CAT_SK_PREFIX[item.category] ?? item.category.toUpperCase();
  const sub = item.subcategory.replace(/[^a-zA-Z0-9_-]/g, "_");
  return sub ? `${prefix}#${sub}#${item.id}` : `${prefix}#${item.id}`;
}

function plan(
  id: string,
  name: string,
  planTier: PlanTier,
  tierLabel: string,
  description: string,
  seats: string,
  callVolume: string,
  monthlyFeeCents: number,
  pilotFeeCents: number,
  setupFeeCents: number,
  dispatcherRateCents: number,
  adminRateCents: number,
  sortOrder: number,
  now: string,
): CatalogItem {
  return {
    id,
    name,
    category: "core",
    subcategory: planTier,
    description,
    tags: ["core", planTier],
    enabled: true,
    sortOrder,
    priceType: "fixed",
    unitPrice: monthlyFeeCents,
    priceMin: null,
    priceMax: null,
    billingPeriod: "monthly",
    unit: "agency/month",
    createdAt: now,
    updatedAt: now,
    // Extended fields stored in item blob:
    ...({
      plan: planTier,
      tierLabel,
      tierSpec: {
        seats,
        callVolume,
        monthlyFee: monthlyFeeCents,
        pilotFee: pilotFeeCents,
        setupFee: setupFeeCents,
        seatOverages: {
          dispatcherLabel: "Dispatcher seat",
          dispatcherRate: dispatcherRateCents,
          adminLabel: "Admin seat",
          adminRate: adminRateCents,
        },
      },
    } as Record<string, unknown>),
  } as CatalogItem;
}

function addon(
  id: string,
  name: string,
  subcategory: string,
  description: string,
  unitPrice: number | null,
  priceMin: number | null,
  priceMax: number | null,
  priceType: CatalogItem["priceType"],
  billingPeriod: string,
  unit: string,
  sortOrder: number,
  now: string,
  tags: string[] = [],
  notes?: string,
): CatalogItem {
  return {
    id,
    name,
    category: "addon",
    subcategory,
    description,
    tags: ["addon", subcategory.toLowerCase().replace(/[^a-z0-9]/g, "-"), ...tags],
    enabled: true,
    sortOrder,
    priceType,
    unitPrice,
    priceMin,
    priceMax,
    billingPeriod,
    unit,
    notes,
    createdAt: now,
    updatedAt: now,
  };
}

function professional(
  id: string,
  name: string,
  subcategory: string,
  description: string,
  unitPrice: number | null,
  priceMin: number | null,
  priceMax: number | null,
  priceType: CatalogItem["priceType"],
  billingPeriod: string,
  unit: string,
  plusTravel: boolean,
  sortOrder: number,
  now: string,
  notes?: string,
): CatalogItem {
  return {
    id,
    name,
    category: "professional",
    subcategory,
    description,
    tags: ["professional", subcategory.toLowerCase().replace(/[^a-z0-9]/g, "-")],
    enabled: true,
    sortOrder,
    priceType,
    unitPrice,
    priceMin,
    priceMax,
    billingPeriod,
    unit,
    plusTravel,
    notes,
    createdAt: now,
    updatedAt: now,
  };
}

function support(
  id: string,
  name: string,
  description: string,
  unitPrice: number | null,
  priceType: CatalogItem["priceType"],
  billingPeriod: string,
  sortOrder: number,
  now: string,
  notes?: string,
): CatalogItem {
  return {
    id,
    name,
    category: "support",
    subcategory: "Support Plan",
    description,
    tags: ["support"],
    enabled: true,
    sortOrder,
    priceType,
    unitPrice,
    priceMin: null,
    priceMax: null,
    billingPeriod,
    unit: "agency/month",
    notes,
    createdAt: now,
    updatedAt: now,
  };
}

function rcLite(
  id: string,
  name: string,
  description: string,
  unitPrice: number | null,
  priceType: CatalogItem["priceType"],
  billingPeriod: string,
  unit: string,
  sortOrder: number,
  now: string,
  notes?: string,
): CatalogItem {
  return {
    id,
    name,
    category: "rc_lite",
    subcategory: "RC Lite API",
    description,
    tags: ["rc-lite", "api"],
    enabled: true,
    sortOrder,
    priceType,
    unitPrice,
    priceMin: null,
    priceMax: null,
    billingPeriod,
    unit,
    notes,
    createdAt: now,
    updatedAt: now,
  };
}

function vertical(
  id: string,
  name: string,
  vert: string,
  description: string,
  unitPrice: number | null,
  priceMin: number | null,
  priceMax: number | null,
  priceType: CatalogItem["priceType"],
  billingPeriod: string,
  pricingBasis: string,
  sortOrder: number,
  now: string,
): CatalogItem {
  return {
    id,
    name,
    category: "vertical",
    subcategory: vert,
    description,
    tags: ["vertical", vert.toLowerCase()],
    enabled: true,
    sortOrder,
    priceType,
    unitPrice,
    priceMin,
    priceMax,
    billingPeriod,
    unit: "site/month",
    createdAt: now,
    updatedAt: now,
    ...({ vertical: vert, pricingBasis } as Record<string, unknown>),
  } as CatalogItem;
}

async function main() {
  const now = new Date().toISOString();

  // Guard against accidental re-seed
  if (!FORCE_RESEED) {
    const existing = await client.send(
      new GetCommand({ TableName: TABLE, Key: { pk: PK_GLOBAL, sk: "CONFIG#META" } }),
    );
    if (existing.Item) {
      console.log("CONFIG#META already exists — skipping (set FORCE_RESEED=true to override)");
      return;
    }
  }

  const items: CatalogItem[] = [
    // -------------------------------------------------------------------------
    // CORE PLANS — Essential (T1-T4)
    // -------------------------------------------------------------------------
    plan("ess-t1", "Essential T1", "essential", "Essential — Tier 1 (Micro)",
      "Micro PSAP, 1–3 dispatcher seats. Core AI transcription, dispatch assist, and audit.", "1–3", "≤500 calls/mo",
      50_000, 150_000, 250_000, 7_500, 5_000, 100, now),
    plan("ess-t2", "Essential T2", "essential", "Essential — Tier 2 (Small)",
      "Small PSAP, 4–8 dispatcher seats. Full Essential feature set.", "4–8", "≤1,500 calls/mo",
      80_000, 200_000, 350_000, 7_500, 5_000, 101, now),
    plan("ess-t3", "Essential T3", "essential", "Essential — Tier 3 (Medium)",
      "Medium PSAP, 9–15 dispatcher seats.", "9–15", "≤3,500 calls/mo",
      120_000, 250_000, 500_000, 7_500, 5_000, 102, now),
    plan("ess-t4", "Essential T4", "essential", "Essential — Tier 4 (Large)",
      "Large PSAP, 16–25 dispatcher seats.", "16–25", "≤7,500 calls/mo",
      180_000, 300_000, 750_000, 7_500, 5_000, 103, now),

    // CORE PLANS — Professional (T1-T4)
    plan("pro-t1", "Professional T1", "professional", "Professional — Tier 1 (Micro)",
      "Micro PSAP, 1–3 seats. Includes all Essential features plus QA scoring, supervisor dashboards, and SLA tracking.", "1–3", "≤500 calls/mo",
      90_000, 200_000, 400_000, 8_500, 6_000, 110, now),
    plan("pro-t2", "Professional T2", "professional", "Professional — Tier 2 (Small)",
      "Small PSAP, 4–8 seats. Professional feature set.", "4–8", "≤1,500 calls/mo",
      140_000, 250_000, 550_000, 8_500, 6_000, 111, now),
    plan("pro-t3", "Professional T3", "professional", "Professional — Tier 3 (Medium)",
      "Medium PSAP, 9–15 seats. Professional feature set.", "9–15", "≤3,500 calls/mo",
      200_000, 350_000, 800_000, 8_500, 6_000, 112, now),
    plan("pro-t4", "Professional T4", "professional", "Professional — Tier 4 (Large)",
      "Large PSAP, 16–25 seats. Professional feature set.", "16–25", "≤7,500 calls/mo",
      280_000, 400_000, 1_000_000, 8_500, 6_000, 113, now),

    // CORE PLANS — Command (T1-T4)
    plan("cmd-t1", "Command T1", "command", "Command — Tier 1 (Micro)",
      "Micro PSAP, 1–3 seats. Full platform: all Professional features plus Incident Command, live video, and predictive staffing.", "1–3", "≤500 calls/mo",
      150_000, 300_000, 600_000, 10_000, 7_500, 120, now),
    plan("cmd-t2", "Command T2", "command", "Command — Tier 2 (Small)",
      "Small PSAP, 4–8 seats. Command feature set.", "4–8", "≤1,500 calls/mo",
      220_000, 400_000, 850_000, 10_000, 7_500, 121, now),
    plan("cmd-t3", "Command T3", "command", "Command — Tier 3 (Medium)",
      "Medium PSAP, 9–15 seats. Command feature set.", "9–15", "≤3,500 calls/mo",
      320_000, 500_000, 1_200_000, 10_000, 7_500, 122, now),
    plan("cmd-t4", "Command T4", "command", "Command — Tier 4 (Large)",
      "Large PSAP, 16–25 seats. Command feature set.", "16–25", "≤7,500 calls/mo",
      450_000, 600_000, 1_500_000, 10_000, 7_500, 123, now),

    // CORE PLANS — Enterprise
    plan("ent-custom", "Enterprise", "enterprise", "Enterprise",
      "Custom enterprise contract. Unlimited seats, dedicated CSM, SLA guarantees, and custom integrations.",
      "Unlimited", "Unlimited", 0, 0, 0, 0, 0, 130, now),

    // -------------------------------------------------------------------------
    // ADD-ONS — CAD Integration
    // -------------------------------------------------------------------------
    addon("addon-cad-module", "CAD Integration Module", "CAD Integration",
      "Bidirectional CAD data feed: receive incident data from your CAD and surface it in Rapid Cortex.",
      30_000, null, null, "fixed", "monthly", "agency/month", 200, now,
      ["cad"], "Requires CAD vendor API access. Setup included."),
    addon("addon-cad-writeback", "CAD Write-Back", "CAD Integration",
      "Write incident data back to CAD in real time from RC dispatcher actions.",
      15_000, null, null, "fixed", "monthly", "agency/month", 201, now,
      ["cad"], "Requires CAD Integration Module. CAD vendor must support write API."),
    addon("addon-cad-poller", "CAD Data Poller", "CAD Integration",
      "Polling-based CAD feed for vendors that don't support push webhooks.",
      10_000, null, null, "fixed", "monthly", "agency/month", 202, now, ["cad"]),
    addon("addon-cad-cap", "CAP Alert Ingest", "CAD Integration",
      "Ingest CAP (Common Alerting Protocol) feeds for emergency notifications.",
      8_000, null, null, "fixed", "monthly", "agency/month", 203, now, ["cad", "cap"]),

    // ADD-ONS — AI & Call Intelligence
    addon("addon-ai-analysis", "Advanced AI Incident Analysis", "AI & Call Intelligence",
      "Automated post-call analysis: caller sentiment, protocol adherence, and key fact extraction.",
      20_000, null, null, "fixed", "monthly", "agency/month", 210, now, ["ai"]),
    addon("addon-ai-sop", "SOP Protocol AI", "AI & Call Intelligence",
      "Real-time protocol surfacing during active calls. Flags deviations from SOPs.",
      18_000, null, null, "fixed", "monthly", "agency/month", 211, now, ["ai", "sop"]),
    addon("addon-ai-triage", "Non-Emergency AI Triage", "AI & Call Intelligence",
      "Automated classification and queue routing for non-emergency calls.",
      12_000, null, null, "fixed", "monthly", "agency/month", 212, now, ["ai", "triage"]),
    addon("addon-ai-confidence", "Field Confidence Scoring", "AI & Call Intelligence",
      "Per-field confidence scores on extracted incident data with uncertainty flags.",
      8_000, null, null, "fixed", "monthly", "agency/month", 213, now, ["ai"]),
    addon("addon-ai-predictive-staffing", "Predictive Staffing Intelligence", "AI & Call Intelligence",
      "AI-driven staffing forecasts and scheduling recommendations based on call volume patterns.",
      15_000, null, null, "fixed", "monthly", "agency/month", 214, now, ["ai", "staffing"]),

    // ADD-ONS — Transcription & Translation
    addon("addon-txn-realtime", "Real-Time Transcription", "Transcription & Translation",
      "Live speech-to-text transcription during active calls using AWS Transcribe or Azure Speech.",
      25_000, null, null, "fixed", "monthly", "agency/month", 220, now, ["transcription"]),
    addon("addon-txn-spanish", "Spanish Bilingual Transcription", "Transcription & Translation",
      "Parallel Spanish transcription and translation for bilingual dispatch centers.",
      15_000, null, null, "fixed", "monthly", "agency/month", 221, now, ["transcription", "translation"]),
    addon("addon-txn-multilingual", "Multilingual Pack (up to 5 languages)", "Transcription & Translation",
      "Extended language support beyond English and Spanish (Arabic, Chinese, Vietnamese, etc.).",
      30_000, null, null, "fixed", "monthly", "agency/month", 222, now, ["transcription", "translation"]),

    // ADD-ONS — Caller Media
    addon("addon-media-upload", "Caller Media Upload", "Caller Media",
      "Secure photo/video upload from callers via SMS link. Files stored encrypted in S3.",
      10_000, null, null, "fixed", "monthly", "agency/month", 230, now, ["media"]),
    addon("addon-media-livevideo", "Caller Live Video Assist", "Caller Media",
      "One-way live video from caller's phone to dispatcher (WebRTC, no app required).",
      20_000, null, null, "fixed", "monthly", "agency/month", 231, now, ["media", "video"]),
    addon("addon-media-silentext", "Silent Text (SMS Web Chat)", "Caller Media",
      "Two-way SMS-based silent communication for hearing-impaired callers or secure situations.",
      12_000, null, null, "fixed", "monthly", "agency/month", 232, now, ["media", "sms"]),
    addon("addon-media-pinpoint", "GPS SMS Location Links", "Caller Media",
      "Send SMS links to obtain caller GPS coordinates from smartphone.",
      8_000, null, null, "fixed", "monthly", "agency/month", 233, now, ["media", "gps"]),

    // ADD-ONS — Supervisor & QA
    addon("addon-qa-scoring", "Automated QA Scoring", "Supervisor & QA",
      "AI-powered QA scorecard generation from call transcripts with custom rubrics.",
      17_500, null, null, "fixed", "monthly", "agency/month", 240, now, ["qa"]),
    addon("addon-qa-coaching", "Dispatcher Coaching Notes", "Supervisor & QA",
      "Structured coaching note templates linked to QA scores and incident timelines.",
      8_000, null, null, "fixed", "monthly", "agency/month", 241, now, ["qa", "coaching"]),
    addon("addon-qa-wellness", "Dispatcher Wellness Flags", "Supervisor & QA",
      "Automatic trauma keyword detection and wellness flag routing to supervisor.",
      7_500, null, null, "fixed", "monthly", "agency/month", 242, now, ["wellness"]),
    addon("addon-qa-supervisor-dash", "Supervisor Performance Dashboard", "Supervisor & QA",
      "Real-time supervisor metrics: SLA tracking, backlog, and dispatcher performance KPIs.",
      10_000, null, null, "fixed", "monthly", "agency/month", 243, now, ["supervisor"]),

    // ADD-ONS — Incident Command
    addon("addon-ic-command", "Incident Command Center", "Incident Command",
      "War room, stakeholder paging, post-incident reviews, and cross-jurisdiction sharing.",
      20_000, null, null, "fixed", "monthly", "agency/month", 250, now, ["command"]),
    addon("addon-ic-share", "Cross-Jurisdiction Incident Sharing", "Incident Command",
      "Share incident data in real time with mutual aid partners and regional partners.",
      10_000, null, null, "fixed", "monthly", "agency/month", 251, now, ["command", "sharing"]),
    addon("addon-ic-timeline", "Incident Timeline Replay", "Incident Command",
      "Chronological replay of all events, transcripts, and media for post-incident review.",
      8_000, null, null, "fixed", "monthly", "agency/month", 252, now, ["command"]),

    // ADD-ONS — Reliability & Tech Ops
    addon("addon-ops-ring-connect", "RC Connect — Ring Integration", "Reliability & Tech Ops",
      "Ring camera and doorbell integration: citizen-initiated alerts and live video from Ring devices.",
      12_500, null, null, "fixed", "monthly", "agency/month", 260, now, ["connect", "ring"]),
    addon("addon-ops-deception", "Deception Shield", "Reliability & Tech Ops",
      "Real-time deceptive-call detection and flagging using behavioral AI models.",
      15_000, null, null, "fixed", "monthly", "agency/month", 261, now, ["security"]),
    addon("addon-ops-websocket", "Real-Time WebSocket Push", "Reliability & Tech Ops",
      "Live push notifications to dispatcher UI for instant incident updates (no polling).",
      6_000, null, null, "fixed", "monthly", "agency/month", 262, now, ["realtime"]),
    addon("addon-ops-analytics", "Advanced Analytics Export", "Reliability & Tech Ops",
      "Extended analytics: rolling SLA reports, call volume trends, and CSV/JSON exports.",
      8_000, null, null, "fixed", "monthly", "agency/month", 263, now, ["analytics"]),
    addon("addon-ops-desktop", "Desktop App Distribution", "Reliability & Tech Ops",
      "Signed macOS and Windows desktop app with auto-update (Rapid Cortex Desktop).",
      5_000, null, null, "fixed", "monthly", "agency/month", 264, now, ["desktop"]),

    // -------------------------------------------------------------------------
    // PROFESSIONAL SERVICES
    // -------------------------------------------------------------------------
    professional("ps-onsite-impl", "On-Site Implementation", "Implementation",
      "On-site kickoff, system configuration, CAD integration setup, and go-live support (2 days).",
      null, 300_000, 800_000, "range", "one_time", "engagement", true, 300, now,
      "Travel billed separately at cost. Includes pre-engagement scoping call."),
    professional("ps-remote-impl", "Remote Implementation", "Implementation",
      "Remote implementation and configuration via video conference (5 sessions).",
      150_000, null, null, "fixed", "one_time", "engagement", false, 301, now),
    professional("ps-onsite-training", "On-Site Dispatcher Training", "Training",
      "Full-day on-site dispatcher and supervisor training workshop (up to 20 attendees).",
      250_000, null, null, "fixed", "one_time", "day", true, 310, now,
      "Additional days billed at same rate. Travel billed separately at cost."),
    professional("ps-remote-training", "Remote Training Package", "Training",
      "4-hour remote training session for dispatchers and supervisors via video conference.",
      100_000, null, null, "fixed", "one_time", "session", false, 311, now),
    professional("ps-cad-custom", "Custom CAD Integration Engineering", "Implementation",
      "Bespoke engineering for non-standard CAD systems or custom bidirectional integrations.",
      null, 500_000, 2_000_000, "range", "one_time", "engagement", false, 320, now,
      "Scoped after technical discovery call. Fixed-fee contract issued after scoping."),
    professional("ps-data-migration", "Historical Data Migration", "Implementation",
      "Migration of historical call data and incident records into Rapid Cortex.",
      null, 200_000, 600_000, "range", "one_time", "engagement", false, 321, now),

    // -------------------------------------------------------------------------
    // SUPPORT PLANS
    // -------------------------------------------------------------------------
    support("sup-standard", "Standard Support",
      "Email support, knowledge base access, and 72-hour response SLA. Included in all plans.",
      null, "included", "included", 400, now),
    support("sup-premium", "Premium Support",
      "Priority email + phone support, 8-hour response SLA, dedicated Slack channel.",
      25_000, "fixed", "monthly", 401, now),
    support("sup-mission-critical", "Mission Critical Support",
      "24/7 phone + pager support, 1-hour response SLA, dedicated CSM, monthly health reviews.",
      50_000, "fixed", "monthly", 402, now,
      "Recommended for PSAPs serving populations >500k or with <0.1% downtime tolerance."),

    // -------------------------------------------------------------------------
    // RC LITE API
    // -------------------------------------------------------------------------
    rcLite("rclite-starter", "RC Lite Starter",
      "RC Lite API access: up to 100 active keys, 50k API calls/month, standard rate limits.",
      20_000, "fixed", "monthly", "agency/month", 500, now),
    rcLite("rclite-growth", "RC Lite Growth",
      "RC Lite API access: up to 500 active keys, 250k API calls/month, increased rate limits.",
      50_000, "fixed", "monthly", "agency/month", 501, now),
    rcLite("rclite-enterprise", "RC Lite Enterprise",
      "Unlimited RC Lite API keys, custom rate limits, dedicated support, and SLA.",
      null, "custom", "monthly", "agency/month", 502, now,
      "Contact sales for custom pricing. Volume discounts available."),
    rcLite("rclite-webhook-signing", "RC Lite Webhook Signing Add-On",
      "HMAC-SHA256 signed webhook payloads for RC Lite API event delivery.",
      3_000, "fixed", "monthly", "agency/month", 503, now),

    // -------------------------------------------------------------------------
    // VERTICAL PACKAGES
    // -------------------------------------------------------------------------
    vertical("vert-campus", "Campus Safety Package", "campus",
      "QR/NFC location intake, campus map overlays, and RC Connect for campus environments.",
      null, 100_000, 300_000, "range", "monthly", "per-campus", 600, now),
    vertical("vert-venue", "Venue Security Package", "venue",
      "Venue incident management, public report intake, and RC Connect for large event venues.",
      null, 150_000, 400_000, "range", "monthly", "per-venue", 601, now),
    vertical("vert-hospital", "Hospital Emergency Connect Package", "hospital",
      "Pre-arrival alerts, hospital routing, and capacity-aware dispatch routing for hospitals.",
      null, 200_000, 500_000, "range", "monthly", "per-hospital", 602, now),
    vertical("vert-transit", "Transit Authority Package", "transit",
      "Transit-specific incident management, GPS routing, and cross-jurisdiction coordination.",
      null, 150_000, 350_000, "range", "monthly", "per-authority", 603, now),
  ];

  // Fix Enterprise core plan — custom pricing
  const entIdx = items.findIndex((x) => x.id === "ent-custom");
  if (entIdx >= 0) {
    items[entIdx] = {
      ...items[entIdx],
      priceType: "custom",
      unitPrice: null,
      billingPeriod: "monthly",
    };
  }

  console.log(`Seeding ${items.length} catalog items to ${TABLE}...`);

  // BatchWrite in 25-item chunks
  const CHUNK = 25;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE!]: chunk.map((item) => ({
            PutRequest: {
              Item: {
                pk: PK_GLOBAL,
                sk: skForItem(item),
                item,
                updatedAt: now,
              },
            },
          })),
        },
      }),
    );
    console.log(`  wrote items ${i + 1}–${Math.min(i + CHUNK, items.length)}`);
  }

  // Write CONFIG#META + audit entry atomically
  const version = 1;
  await client.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: PK_GLOBAL,
        sk: "CONFIG#META",
        version,
        updatedAt: now,
        updatedBy: SEED_USER_EMAIL,
      },
    }),
  );

  await client.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: PK_AUDIT,
        sk: `${now}#seed`,
        action: "SEED_APPLIED",
        userId: "seed",
        userEmail: SEED_USER_EMAIL,
        reason: "Initial pricing catalog seed",
        version,
        updatedAt: now,
      },
    }),
  );

  console.log(`Done. ${items.length} items seeded, CONFIG#META version=${version}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
