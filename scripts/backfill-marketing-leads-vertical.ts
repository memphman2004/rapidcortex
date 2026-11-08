/**
 * Backfill marketing-leads PROFILE.vertical + createdAt from email-list membership.
 * Usage: npx tsx scripts/backfill-marketing-leads-vertical.ts [stage]
 *
 * Requires AWS credentials (profile rapid-cortex) and table names for the stage.
 */
import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const STAGE = process.argv[2] ?? "dev";
const REGION = process.env.AWS_REGION ?? "us-east-1";
const MARKETING =
  process.env.MARKETING_LEADS_TABLE ?? `rapid-cortex-marketing-leads-${STAGE}`;
const PIPELINE =
  process.env.RAPID_IQ_PIPELINE_SIGNALS_TABLE ??
  `rapid-cortex-rapid-iq-pipeline-signals-${STAGE}`;

const VERTICALS = [
  "PSAP",
  "LAW_ENFORCEMENT",
  "FIRE_EMS",
  "CAMPUS",
  "VENUE",
  "HOSPITAL",
  "TRANSIT",
] as const;

const LEAD_VERTICAL: Record<(typeof VERTICALS)[number], string> = {
  PSAP: "rc911",
  LAW_ENFORCEMENT: "law_enforcement",
  FIRE_EMS: "fire_ems",
  CAMPUS: "campus",
  VENUE: "venue",
  HOSPITAL: "hospital",
  TRANSIT: "transit",
};

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

async function listEmailsForVertical(vertical: (typeof VERTICALS)[number]): Promise<
  Array<{ email: string; createdAt?: string }>
> {
  const out: Array<{ email: string; createdAt?: string }> = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: PIPELINE,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": `EMAILLIST#${vertical}`,
          ":sk": "EMAIL#",
        },
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) {
      const email =
        typeof item.email === "string"
          ? item.email.trim().toLowerCase()
          : String(item.sk ?? "")
              .replace(/^EMAIL#/i, "")
              .toLowerCase();
      if (!email) continue;
      out.push({
        email,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined,
      });
    }
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return out;
}

async function main() {
  let patched = 0;
  let skipped = 0;
  for (const vertical of VERTICALS) {
    const rows = await listEmailsForVertical(vertical);
    console.log(`${vertical}: ${rows.length} email-list rows`);
    for (const row of rows) {
      try {
        await ddb.send(
          new UpdateCommand({
            TableName: MARKETING,
            Key: { pk: `LEAD#${row.email}`, sk: "PROFILE" },
            UpdateExpression:
              "SET #vertical = if_not_exists(#vertical, :vertical), createdAt = if_not_exists(createdAt, :createdAt), updatedAt = :now",
            ConditionExpression: "attribute_exists(pk)",
            ExpressionAttributeNames: { "#vertical": "vertical" },
            ExpressionAttributeValues: {
              ":vertical": LEAD_VERTICAL[vertical],
              ":createdAt": row.createdAt ?? new Date().toISOString(),
              ":now": new Date().toISOString(),
            },
          }),
        );
        patched += 1;
      } catch (err: unknown) {
        const name = (err as { name?: string })?.name;
        if (name === "ConditionalCheckFailedException") {
          skipped += 1;
          continue;
        }
        throw err;
      }
    }
  }

  // Ensure every PROFILE has createdAt so GSI range key is populated.
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: MARKETING,
        FilterExpression: "sk = :sk AND attribute_not_exists(createdAt)",
        ExpressionAttributeValues: { ":sk": "PROFILE" },
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) {
      const pk = typeof item.pk === "string" ? item.pk : "";
      if (!pk) continue;
      await ddb.send(
        new UpdateCommand({
          TableName: MARKETING,
          Key: { pk, sk: "PROFILE" },
          UpdateExpression: "SET createdAt = :c, updatedAt = :c",
          ExpressionAttributeValues: { ":c": new Date().toISOString() },
        }),
      );
      patched += 1;
    }
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  console.log(JSON.stringify({ ok: true, patched, skipped, marketing: MARKETING, pipeline: PIPELINE }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
