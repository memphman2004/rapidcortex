/**
 * Seed tenantEntitlements on billing profiles for every agency missing them (dev).
 *
 *   AGENCIES_TABLE=rapid-cortex-agencies-dev \
 *   BILLING_PROFILES_TABLE=rapid-cortex-billing-profiles-dev \
 *   npx tsx scripts/seed-tenant-entitlements-dev.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ADDON_KEYS, type AddonKey, type AgencyBillingProfile, type TenantAddonState, type TenantEntitlements } from "rapid-cortex-shared";

const REGION = process.env.AWS_REGION?.trim() || "us-east-1";
const AGENCIES_TABLE = process.env.AGENCIES_TABLE?.trim() || "rapid-cortex-agencies-dev";
const BILLING_PROFILES_TABLE =
  process.env.BILLING_PROFILES_TABLE?.trim() || "rapid-cortex-billing-profiles-dev";
const ACTOR = process.env.SEED_ACTOR?.trim() || "seed-tenant-entitlements-dev";

function nowIso(): string {
  return new Date().toISOString();
}

function seedAddonStates(): Record<AddonKey, TenantAddonState> {
  const addons = {} as Record<AddonKey, TenantAddonState>;
  for (const key of ADDON_KEYS) {
    addons[key] = { key, enabled: false };
  }
  return addons;
}

function defaultProfileShell(agencyId: string, plan: string): AgencyBillingProfile {
  const t = nowIso();
  return {
    agencyId,
    schemaVersion: 1,
    billingAccount: {
      billingAccountId: `ba_${agencyId}`,
      agencyId,
      status: "current",
      preferredPaymentRail: "ach",
      createdAt: t,
      updatedAt: t,
    },
    contacts: {
      billingContactName: "Billing",
      billingContactEmail: "billing@example.com",
    },
    paymentMode: "invoice_only",
    selfServeCheckoutEnabled: false,
    assignedPlanId: plan === "essential" ? "essential" : undefined,
    invoices: [],
    paymentMethods: [],
    delinquency: { tier: "none", asOf: t },
    createdAt: t,
    updatedAt: t,
  };
}

function buildEntitlements(agencyId: string, plan: string): TenantEntitlements {
  return {
    tenantId: agencyId,
    plan,
    addons: seedAddonStates(),
    lastModifiedAt: nowIso(),
    lastModifiedBy: ACTOR,
    schemaVersion: 1,
  };
}

async function main() {
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const agencies = await ddb.send(
    new ScanCommand({
      TableName: AGENCIES_TABLE,
      ProjectionExpression: "agencyId, planId, monetizationPlanId",
    }),
  );

  const rows = agencies.Items ?? [];
  if (rows.length === 0) {
    console.log(`[seed-tenant-entitlements-dev] No agencies in ${AGENCIES_TABLE}`);
    return;
  }

  let seeded = 0;
  let skipped = 0;

  for (const row of rows) {
    const agencyId = String(row.agencyId ?? "").trim();
    if (!agencyId) continue;
    const plan = String(row.monetizationPlanId ?? row.planId ?? "command").trim() || "command";

    const existing = await ddb.send(
      new GetCommand({
        TableName: BILLING_PROFILES_TABLE,
        Key: { agencyId },
      }),
    );
    const profile = existing.Item as AgencyBillingProfile | undefined;
    if (profile?.tenantEntitlements) {
      skipped += 1;
      continue;
    }

    const entitlements = buildEntitlements(agencyId, plan);
    const base = profile ?? defaultProfileShell(agencyId, plan);
    await ddb.send(
      new PutCommand({
        TableName: BILLING_PROFILES_TABLE,
        Item: {
          ...base,
          tenantEntitlements: entitlements,
          updatedAt: nowIso(),
        },
      }),
    );
    seeded += 1;
    console.log(`[seed-tenant-entitlements-dev] Seeded ${agencyId} (plan=${plan})`);
  }

  console.log(
    `[seed-tenant-entitlements-dev] Done: ${seeded} seeded, ${skipped} already had entitlements (${rows.length} agencies scanned)`,
  );
}

main().catch((error) => {
  console.error("[seed-tenant-entitlements-dev] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
