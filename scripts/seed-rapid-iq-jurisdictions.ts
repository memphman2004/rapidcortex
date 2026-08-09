#!/usr/bin/env npx tsx
/**
 * Seeds jurisdiction registry + state coverage tables.
 * Run: STAGE=dev npx tsx scripts/seed-rapid-iq-jurisdictions.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ALL_JURISDICTIONS } from "../apps/api/src/lib/rapid-iq/jurisdiction-registry";

const STAGE = process.env.STAGE ?? "dev";
const PREFIX = process.env.DYNAMO_TABLE_PREFIX ?? "rapid-cortex";
const TABLE = process.env.RAPID_IQ_JURISDICTIONS_TABLE ?? `${PREFIX}-rapid-iq-jurisdictions-${STAGE}`;
const COV_TABLE =
  process.env.RAPID_IQ_STATE_COVERAGE_TABLE ?? `${PREFIX}-rapid-iq-state-coverage-${STAGE}`;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const now = new Date().toISOString();

async function main() {
  console.log(`Seeding ${ALL_JURISDICTIONS.length} jurisdictions → ${TABLE}`);
  let seeded = 0;

  for (const j of ALL_JURISDICTIONS) {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          ...j,
          lastScannedAt: "1970-01-01T00:00:00.000Z",
          lastSignalAt: null,
          totalSignalsFound: 0,
          priorityBoost: 0,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
    seeded++;
    if (seeded % 10 === 0) process.stdout.write(`  ${seeded}/${ALL_JURISDICTIONS.length}\r`);
  }

  const states = [...new Set(ALL_JURISDICTIONS.map((j) => j.stateCode))];
  for (const stateCode of states) {
    const j = ALL_JURISDICTIONS.find((x) => x.stateCode === stateCode)!;
    await ddb.send(
      new PutCommand({
        TableName: COV_TABLE,
        Item: {
          stateCode,
          stateName: j.stateName,
          lastScannedAt: null,
          lastSignalAt: null,
          totalSignals: 0,
          jurisdictionCount: ALL_JURISDICTIONS.filter((x) => x.stateCode === stateCode).length,
          updatedAt: now,
        },
      }),
    );
  }
  console.log(`\n✓ Seeded ${seeded} jurisdictions + ${states.length} state coverage records`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
