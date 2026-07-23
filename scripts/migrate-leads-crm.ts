/**
 * Idempotent SalesLeads CRM backfill.
 *
 *   STAGE=dev AWS_PROFILE=rapid-cortex npx tsx scripts/migrate-leads-crm.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { legacyStatusToStage } from "rapid-cortex-shared";

const stage = process.env.STAGE ?? process.env.DeploymentStage ?? "dev";
const table = process.env.SALES_LEADS_TABLE ?? `rapid-cortex-sales-leads-${stage}`;
const region = process.env.AWS_REGION ?? "us-east-1";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

async function main() {
  console.log(`Migrating SalesLeads CRM fields on ${table} (${region})`);
  let scanned = 0;
  let stageUpdated = 0;
  let notesUpdated = 0;
  let activitiesUpdated = 0;
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const page = await ddb.send(
      new ScanCommand({
        TableName: table,
        ExclusiveStartKey: exclusiveStartKey,
        Limit: 50,
      }),
    );
    for (const item of page.Items ?? []) {
      scanned += 1;
      const leadId = String(item.leadId ?? "");
      if (!leadId) continue;
      const createdAt = String(item.createdAt ?? new Date().toISOString());

      if (item.pipelineStage === undefined || item.pipelineStage === null) {
        const pipelineStage = legacyStatusToStage(
          typeof item.status === "string" ? item.status : "new",
        );
        try {
          await ddb.send(
            new UpdateCommand({
              TableName: table,
              Key: { leadId },
              UpdateExpression: "SET pipelineStage = :pipelineStage",
              ExpressionAttributeValues: { ":pipelineStage": pipelineStage },
              ConditionExpression: "attribute_not_exists(pipelineStage)",
            }),
          );
          stageUpdated += 1;
        } catch (err) {
          if ((err as { name?: string }).name !== "ConditionalCheckFailedException") throw err;
        }
      }

      if (typeof item.notes === "string" && item.notes.trim()) {
        const notes = [
          {
            noteId: "legacy-note",
            text: item.notes.trim(),
            authorId: "system",
            authorName: "Imported",
            createdAt,
            pinned: false,
          },
        ];
        try {
          await ddb.send(
            new UpdateCommand({
              TableName: table,
              Key: { leadId },
              UpdateExpression: "SET notes = :notes",
              ConditionExpression: "attribute_type(notes, :stype)",
              ExpressionAttributeValues: { ":notes": notes, ":stype": "S" },
            }),
          );
          notesUpdated += 1;
        } catch (err) {
          if ((err as { name?: string }).name !== "ConditionalCheckFailedException") {
            console.warn(`notes migrate skip ${leadId}`, err);
          }
        }
      }

      if (!Array.isArray(item.activities)) {
        const activities = [
          {
            activityId: "created-event",
            type: "created",
            description: `Lead created · Source: ${item.source ?? "unknown"}`,
            createdAt,
          },
        ];
        try {
          await ddb.send(
            new UpdateCommand({
              TableName: table,
              Key: { leadId },
              UpdateExpression: "SET activities = :activities",
              ExpressionAttributeValues: { ":activities": activities },
              ConditionExpression: "attribute_not_exists(activities)",
            }),
          );
          activitiesUpdated += 1;
        } catch (err) {
          if ((err as { name?: string }).name !== "ConditionalCheckFailedException") throw err;
        }
      }
    }
    exclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  console.log(JSON.stringify({ scanned, stageUpdated, notesUpdated, activitiesUpdated, table }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
