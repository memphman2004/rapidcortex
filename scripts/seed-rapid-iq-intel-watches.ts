/**
 * Seed WATCH# rows for transit + PSAP/campus/venue.
 * Does not overwrite existing watches (manual URL edits stay).
 *
 *   STAGE=staging npx tsx scripts/seed-rapid-iq-intel-watches.ts
 *   RAPID_IQ_PIPELINE_SIGNALS_TABLE=rapid-cortex-rapid-iq-pipeline-signals-dev npx tsx scripts/seed-rapid-iq-intel-watches.ts
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { allIntelWatchRecords } from "rapid-cortex-shared";

const stage = process.env.STAGE ?? process.env.DEPLOYMENT_STAGE ?? "dev";
const tableName =
  process.env.RAPID_IQ_PIPELINE_SIGNALS_TABLE?.trim() ||
  `rapid-cortex-rapid-iq-pipeline-signals-${stage}`;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" }), {
  marshallOptions: { removeUndefinedValues: true },
});

async function main(): Promise<void> {
  const now = new Date().toISOString();
  const watches = allIntelWatchRecords(now);
  console.log(`Seeding ${watches.length} intel watches → ${tableName}`);
  let ok = 0;
  let skip = 0;

  for (const watch of watches) {
    const existing = await ddb.send(
      new GetCommand({ TableName: tableName, Key: { pk: `WATCH#${watch.id}`, sk: "META" } }),
    );
    if (existing.Item) {
      console.log(`  ~ ${watch.id} (exists)`);
      skip += 1;
      continue;
    }
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          ...watch,
          pk: `WATCH#${watch.id}`,
          sk: "META",
          entityType: "watch",
          gsi1pk: `WATCH_MARKET#${watch.market}`,
          gsi1sk: watch.updatedAt,
          gsi2pk: "WATCH#ALL",
          gsi2sk: watch.updatedAt,
        },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
    ok += 1;
    console.log(`  ✓ ${watch.id}`);
  }

  console.log(`Done. Seeded: ${ok}  Skipped: ${skip}  Total: ${watches.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
