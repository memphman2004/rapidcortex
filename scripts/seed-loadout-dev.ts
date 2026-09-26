#!/usr/bin/env ts-node
/**
 * NexCortiQ Loadout — Dev Seed Script
 *
 * Seeds a test-agency subscription, API key record, and usage entries for
 * transcription, ai_analysis, and qa_scoring into the Loadout DynamoDB tables.
 *
 * Usage:
 *   LOADOUT_SUBSCRIPTIONS_TABLE=rapid-cortex-loadout-subscriptions-dev \
 *   LOADOUT_API_KEYS_TABLE=rapid-cortex-loadout-api-keys-dev \
 *   LOADOUT_USAGE_TABLE=rapid-cortex-loadout-usage-dev \
 *   AWS_REGION=us-east-1 \
 *   npx tsx scripts/seed-loadout-dev.ts
 *
 * Optional:
 *   TENANT_ID=agency-test-001   (default: dev-seed-agency)
 *   FORCE_RESEED=true           (overwrite existing records)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { createHash } from "crypto";

// ── Config ────────────────────────────────────────────────────────────────────

const SUBSCRIPTIONS_TABLE = process.env.LOADOUT_SUBSCRIPTIONS_TABLE;
const API_KEYS_TABLE = process.env.LOADOUT_API_KEYS_TABLE;
const USAGE_TABLE = process.env.LOADOUT_USAGE_TABLE;
const TENANT_ID = process.env.TENANT_ID ?? "dev-seed-agency";
const FORCE_RESEED = process.env.FORCE_RESEED === "true";

for (const [name, val] of [
  ["LOADOUT_SUBSCRIPTIONS_TABLE", SUBSCRIPTIONS_TABLE],
  ["LOADOUT_API_KEYS_TABLE", API_KEYS_TABLE],
  ["LOADOUT_USAGE_TABLE", USAGE_TABLE],
] as const) {
  if (!val) {
    console.error(`ERROR: ${name} env var is required`);
    process.exit(1);
  }
}

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" }), {
  marshallOptions: { removeUndefinedValues: true },
});

const SEED_FEATURES = ["transcription", "ai_analysis", "qa_scoring"];
const NOW = new Date().toISOString();
const PERIOD = NOW.slice(0, 7); // YYYY-MM
const TTL = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 60; // 60 days

// ── Helpers ───────────────────────────────────────────────────────────────────

async function exists(table: string, pk: string, sk?: string): Promise<boolean> {
  const key: Record<string, string> = { pk };
  if (sk) key.sk = sk;
  const res = await db.send(new GetCommand({ TableName: table, Key: key }));
  return Boolean(res.Item);
}

// ── Subscription ──────────────────────────────────────────────────────────────

async function seedSubscription() {
  const pk = `SUB#${TENANT_ID}`;
  const sk = "SUBSCRIPTION";

  if (!FORCE_RESEED && (await exists(SUBSCRIPTIONS_TABLE!, pk, sk))) {
    console.log(`  ↩  Subscription already exists for ${TENANT_ID} — skip (use FORCE_RESEED=true to overwrite)`);
    return;
  }

  await db.send(
    new PutCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      Item: {
        pk,
        sk,
        tenantId: TENANT_ID,
        orgName: "Dev Test Agency",
        activeFeatures: SEED_FEATURES,
        billingEmail: "billing@dev-test-agency.internal",
        technicalEmail: "tech@dev-test-agency.internal",
        billingCycleDay: 1,
        tier: "small",
        status: "active",
        version: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
    }),
  );
  console.log(`  ✓  Subscription seeded for tenant ${TENANT_ID} (features: ${SEED_FEATURES.join(", ")})`);
}

// ── API Key ───────────────────────────────────────────────────────────────────

async function seedApiKey() {
  // Use a deterministic hash for dev seeds so re-runs are idempotent.
  // Authorizer requires raw key length >= 32.
  const devKeyPlaintext = `ncq_test_seed_${TENANT_ID}_loadout_dev_key`;
  const keyHash = createHash("sha256").update(devKeyPlaintext).digest("hex");
  const pk = `APIKEY#${keyHash}`;

  if (!FORCE_RESEED && (await exists(API_KEYS_TABLE!, pk))) {
    console.log(`  ↩  API key record already exists — skip`);
    return;
  }

  await db.send(
    new PutCommand({
      TableName: API_KEYS_TABLE,
      Item: {
        pk,
        keyHash,
        tenantId: TENANT_ID,
        keyName: "Dev Seed Key",
        status: "active",
        tier: "small",
        enabledFeatures: SEED_FEATURES,
        quotaPerFeature: {
          transcription: 10_000,
          ai_analysis: 5_000,
          qa_scoring: 3_000,
        },
        usageThisMonth: {
          transcription: 0,
          ai_analysis: 0,
          qa_scoring: 0,
        },
        allowedJurisdictions: [],
        createdAt: NOW,
      },
    }),
  );
  console.log(`  ✓  API key record seeded (hash prefix: ${keyHash.slice(0, 8)}…)`);
  console.log(`     ⚠  Dev plaintext key (not for production): ${devKeyPlaintext}`);
}

// ── Usage Records ─────────────────────────────────────────────────────────────

async function seedUsage() {
  const usageData: Record<string, { callCount: number; quotaLimit: number }> = {
    transcription: { callCount: 4_230, quotaLimit: 10_000 },
    ai_analysis: { callCount: 1_820, quotaLimit: 5_000 },
    qa_scoring: { callCount: 780, quotaLimit: 3_000 },
  };

  for (const [featureId, usage] of Object.entries(usageData)) {
    const pk = `USAGE#${TENANT_ID}#${PERIOD}`;
    const sk = `FEATURE#${featureId}`;

    if (!FORCE_RESEED && (await exists(USAGE_TABLE!, pk, sk))) {
      console.log(`  ↩  Usage record for ${featureId} already exists — skip`);
      continue;
    }

    await db.send(
      new PutCommand({
        TableName: USAGE_TABLE,
        Item: {
          pk,
          sk,
          tenantId: TENANT_ID,
          featureId,
          period: PERIOD,
          callCount: usage.callCount,
          quotaLimit: usage.quotaLimit,
          ttl: TTL,
        },
      }),
    );
    console.log(`  ✓  Usage seeded: ${featureId} = ${usage.callCount.toLocaleString()} / ${usage.quotaLimit.toLocaleString()} calls`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌱  Seeding Loadout dev data for tenant: ${TENANT_ID}`);
  console.log(`    Period: ${PERIOD}\n`);

  await seedSubscription();
  await seedApiKey();
  await seedUsage();

  console.log("\n✅  Loadout seed complete.\n");
}

main().catch((err: unknown) => {
  console.error("\nSeed failed:", err, "\n");
  process.exit(1);
});
