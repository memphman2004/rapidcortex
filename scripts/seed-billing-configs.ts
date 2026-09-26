#!/usr/bin/env npx tsx
/**
 * Seeds billing configs for dev/staging agencies.
 * Run after deploying the billing stack.
 *
 * Usage: AGENCY_BILLING_CONFIGS_TABLE=rapid-cortex-agency-billing-configs-dev \
 *        npx tsx scripts/seed-billing-configs.ts
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { AgencyBillingConfig } from "rapid-cortex-shared";

const TABLE = process.env.AGENCY_BILLING_CONFIGS_TABLE ?? "rapid-cortex-agency-billing-configs-dev";
const REGION = process.env.AWS_REGION ?? "us-east-1";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

const now = new Date().toISOString();

const configs: AgencyBillingConfig[] = [
  {
    agencyId: "test-agency",
    agencyName: "NexCort iQ Test Agency",
    planId: "professional",
    billingCycle: "monthly",
    contractTermYears: 1,
    contractStartDate: "2026-01-01",
    contractEndDate: "2026-12-31",
    contractedDispatcherSeats: 12,
    contractedAdminSeats: 5,
    addons: [
      { key: "live-translation", label: "Live Translation", monthlyFeeCents: 200000, enabledAt: "2026-01-01T00:00:00Z" },
      { key: "caller-video", label: "Caller Video Upload", monthlyFeeCents: 350000, enabledAt: "2026-01-01T00:00:00Z" },
      { key: "qa-tools", label: "QA Review Tools", monthlyFeeCents: 250000, enabledAt: "2026-01-01T00:00:00Z" },
    ],
    discounts: [
      {
        type: "annualCommit1yr",
        basisPoints: 1000,
        label: "Annual Commitment (1-year)",
        appliesTo: "mrc",
        approvedBy: "seed-script",
      },
      {
        type: "bundleAddon3Plus",
        basisPoints: 1500,
        label: "Bundle Discount (3+ add-ons)",
        appliesTo: "addons",
        approvedBy: "seed-script",
      },
    ],
    billingContactEmail: "billing@test-agency.gov",
    billingContactName: "Test Billing Contact",
    paymentMethod: "ach",
    taxExempt: true,
    goLiveDate: "2026-01-01",
    status: "active",
    createdAt: now,
    updatedAt: now,
  },
];

async function main() {
  for (const config of configs) {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: config }));
    console.log(`Seeded billing config for ${config.agencyId} (${config.planId})`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
