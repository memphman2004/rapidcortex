/**
 * Enable F3 non-emergency triage + queue for all active PSAP agencies on the live stack.
 * Safe to re-run — merges triage flags into existing agency config.
 *
 * Usage:
 *   source scripts/env-api-dev.sh
 *   npx tsx scripts/enable-agency-triage-live.ts
 *   npx tsx scripts/enable-agency-triage-live.ts --agency-id=test-agency
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.AGENCIES_TABLE?.trim() || "rapid-cortex-agencies-dev";
const REGION = process.env.AWS_REGION?.trim() || "us-east-1";

function parseAgencyFilter(): string | null {
  const idx = process.argv.indexOf("--agency-id");
  if (idx === -1) return null;
  const value = process.argv[idx + 1]?.trim();
  if (!value) throw new Error("--agency-id requires a value");
  return value;
}

async function main() {
  const agencyFilter = parseAgencyFilter();
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const now = new Date().toISOString();
  let updated = 0;
  let lastKey: Record<string, unknown> | undefined;

  do {
    const page = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        ExclusiveStartKey: lastKey,
        ProjectionExpression: "agencyId, #status, #config",
        ExpressionAttributeNames: { "#status": "status", "#config": "config" },
      }),
    );

    for (const row of page.Items ?? []) {
      const agencyId = String(row.agencyId ?? "");
      if (!agencyId) continue;
      if (agencyFilter && agencyId !== agencyFilter) continue;
      const status = String(row.status ?? "active");
      if (status !== "active" && status !== "pilot") continue;

      const config =
        row.config && typeof row.config === "object"
          ? (row.config as Record<string, unknown>)
          : {};

      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { agencyId },
          UpdateExpression:
            "SET #config = :config, updatedAt = :updatedAt",
          ExpressionAttributeNames: { "#config": "config" },
          ExpressionAttributeValues: {
            ":config": {
              ...config,
              triage: {
                enabled: true,
                nonEmergencyQueueEnabled: true,
              },
            },
            ":updatedAt": now,
          },
        }),
      );
      updated += 1;
      console.log(`[enable-agency-triage-live] ${agencyId} → triage enabled`);
    }

    lastKey = page.LastEvaluatedKey;
  } while (lastKey);

  console.log(`[enable-agency-triage-live] Done. Updated ${updated} agency(ies) in ${TABLE}.`);
}

main().catch((error) => {
  console.error(
    "[enable-agency-triage-live] failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
