/**
 * NexCortiQ Loadout — API Key Provisioner
 *
 * Generates a new ncq_live_* API key, hashes it, and writes the record to
 * DynamoDB. Can be called directly or imported by the CLI provisioning script.
 *
 * Usage (direct):
 *   npx ts-node apps/api/src/loadout/key-provisioner.ts \
 *     --tenantId=agency-abc \
 *     --tier=medium \
 *     --features=transcription,translation \
 *     --jurisdictions=maricopa-az
 *
 * Output: prints the plaintext key ONCE — caller must store it securely.
 * The key is NEVER stored in DynamoDB; only the sha256 hash is persisted.
 */

import {
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { createHash, randomBytes } from "crypto";

const db = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });

export interface ProvisionKeyInput {
  tenantId: string;
  tier?: "small" | "medium" | "large" | "enterprise";
  features?: string[];
  quotaPerFeature?: Record<string, number>;
  jurisdictions?: string[];
  keyName?: string;
}

export interface ProvisionKeyResult {
  /** Plaintext key — shown ONCE, never stored. Caller must save it. */
  plaintextKey: string;
  keyHash: string;
  tenantId: string;
  keyName: string;
  createdAt: string;
}

const DEFAULT_QUOTA: Record<string, number> = {
  transcription: 10_000,
  translation: 10_000,
  ai_analysis: 5_000,
  classification: 8_000,
  sentiment: 8_000,
  qa_scoring: 3_000,
  field_brief: 5_000,
};

/**
 * Generate a new ncq_live_ API key and write it to DynamoDB.
 * Returns the plaintext key — must be shown to the caller ONCE and discarded.
 */
export async function provisionKey(
  input: ProvisionKeyInput,
  tableName: string,
): Promise<ProvisionKeyResult> {
  const {
    tenantId,
    tier = "small",
    features = [],
    quotaPerFeature,
    jurisdictions = [],
    keyName = `key-${Date.now()}`,
  } = input;

  // Generate key: ncq_live_ prefix + 32 random hex bytes
  const plaintextKey = `ncq_live_${randomBytes(32).toString("hex")}`;
  const keyHash = sha256(plaintextKey);
  const createdAt = new Date().toISOString();

  // Build quota map — use provided values or fall back to defaults for known features
  const resolvedQuota: Record<string, { N: string }> = {};
  const allFeatures = features.length ? features : Object.keys(DEFAULT_QUOTA);
  for (const fid of allFeatures) {
    const q =
      quotaPerFeature?.[fid] ?? DEFAULT_QUOTA[fid] ?? 1_000;
    resolvedQuota[fid] = { N: String(q) };
  }

  await db.send(
    new PutItemCommand({
      TableName: tableName,
      Item: {
        pk: { S: `APIKEY#${keyHash}` },
        keyHash: { S: keyHash },
        tenantId: { S: tenantId },
        keyName: { S: keyName },
        status: { S: "active" },
        tier: { S: tier },
        ...(features.length
          ? { enabledFeatures: { SS: features } }
          : {}),
        quotaPerFeature: { M: resolvedQuota },
        usageThisMonth: {
          M: Object.fromEntries(
            allFeatures.map((fid) => [fid, { N: "0" }]),
          ),
        },
        ...(jurisdictions.length
          ? { allowedJurisdictions: { SS: jurisdictions } }
          : {}),
        createdAt: { S: createdAt },
      },
      // Prevent accidental overwrite of an existing key hash (collision-safe)
      ConditionExpression: "attribute_not_exists(pk)",
    }),
  );

  return { plaintextKey, keyHash, tenantId, keyName, createdAt };
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// ── CLI ENTRYPOINT ────────────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith("key-provisioner.ts")) {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .filter((a) => a.startsWith("--"))
      .map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v ?? ""];
      }),
  );

  const tableName = process.env.API_KEYS_TABLE;
  if (!tableName) {
    console.error("Error: API_KEYS_TABLE env var is required.");
    process.exit(1);
  }
  if (!args["tenantId"]) {
    console.error("Error: --tenantId is required.");
    process.exit(1);
  }

  provisionKey(
    {
      tenantId: args["tenantId"],
      tier: (args["tier"] as ProvisionKeyInput["tier"]) ?? "small",
      features: args["features"] ? args["features"].split(",") : [],
      jurisdictions: args["jurisdictions"]
        ? args["jurisdictions"].split(",")
        : [],
      keyName: args["keyName"],
    },
    tableName,
  )
    .then((result) => {
      console.log("\n====================================================");
      console.log("  ⚠  STORE THIS KEY NOW — it will not be shown again.");
      console.log("====================================================");
      console.log(`  Key:      ${result.plaintextKey}`);
      console.log(`  Hash:     ${result.keyHash}`);
      console.log(`  Tenant:   ${result.tenantId}`);
      console.log(`  Name:     ${result.keyName}`);
      console.log(`  Created:  ${result.createdAt}`);
      console.log("====================================================\n");
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error("Provisioning failed:", err);
      process.exit(1);
    });
}
