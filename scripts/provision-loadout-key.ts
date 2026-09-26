#!/usr/bin/env ts-node
/**
 * NexCortiQ Loadout — API Key Provisioning CLI
 *
 * Wraps the core provisionKey() logic from apps/api/src/loadout/key-provisioner.ts.
 *
 * Usage:
 *   npx ts-node scripts/provision-loadout-key.ts \
 *     --tenantId=agency-abc \
 *     --tier=medium \
 *     --features=transcription,translation,ai_analysis \
 *     --jurisdictions=maricopa-az \
 *     --keyName="Maricopa Primary Key"
 *
 * Required env:
 *   API_KEYS_TABLE  — DynamoDB table name (e.g. rapid-cortex-loadout-api-keys-dev)
 *   AWS_REGION      — defaults to us-east-1
 *
 * ⚠  The generated key is shown ONCE and never stored in plaintext.
 *    Copy it to your secrets manager immediately.
 *    Live keys carry the prefix ncq_live_ — test/dev seeds use ncq_test_.
 */

import { provisionKey } from "../apps/api/src/loadout/key-provisioner.js";

// ── CLI ARG PARSING ───────────────────────────────────────────────────────────

const argMap = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const eq = a.indexOf("=");
      const key = a.slice(2, eq === -1 ? undefined : eq);
      const val = eq === -1 ? "true" : a.slice(eq + 1);
      return [key, val];
    }),
);

const tableName = process.env.API_KEYS_TABLE;

if (!tableName) {
  console.error("\nError: API_KEYS_TABLE environment variable is required.");
  console.error("  export API_KEYS_TABLE=rapid-cortex-loadout-api-keys-dev\n");
  process.exit(1);
}

if (!argMap["tenantId"]) {
  console.error("\nError: --tenantId is required.\n");
  process.exit(1);
}

// ── RUN ───────────────────────────────────────────────────────────────────────

provisionKey(
  {
    tenantId: argMap["tenantId"],
    tier: (argMap["tier"] as "small" | "medium" | "large" | "enterprise" | undefined) ?? "small",
    features: argMap["features"] ? argMap["features"].split(",") : [],
    jurisdictions: argMap["jurisdictions"]
      ? argMap["jurisdictions"].split(",")
      : [],
    keyName: argMap["keyName"],
  },
  tableName,
)
  .then((result) => {
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║  ⚠  STORE THIS KEY NOW — it will not be shown again.  ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log("");
    console.log(`  Key:      ${result.plaintextKey}`);
    console.log(`  Hash:     ${result.keyHash}`);
    console.log(`  Tenant:   ${result.tenantId}`);
    console.log(`  Name:     ${result.keyName}`);
    console.log(`  Created:  ${result.createdAt}`);
    console.log("");
    console.log("  Store in: AWS Secrets Manager or your vault of choice.");
    console.log("  Path suggestion: rapid-cortex/loadout/api-keys/<tenantId>\n");
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("\nProvisioning failed:", err, "\n");
    process.exit(1);
  });
