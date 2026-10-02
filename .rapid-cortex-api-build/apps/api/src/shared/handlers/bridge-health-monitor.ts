import type { ScheduledHandler } from "aws-lambda";
import { DescribeTasksCommand, ECSClient } from "@aws-sdk/client-ecs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { KvsChannelService } from "../kvs-channel-service.js";

const ecs = new ECSClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const kvs = new KvsChannelService();

interface SessionRecord {
  pk: string;
  sk: string;
  sessionId: string;
  incidentId: string;
  agencyId: string;
  status: string;
  ecsTaskArn?: string;
  kvsChannelName?: string;
}

export const handler: ScheduledHandler = async () => {
  const now = new Date().toISOString();
  const tables = [
    {
      table: process.env.CONNECT_SESSIONS_TABLE!,
      cluster: process.env.CONNECT_BRIDGE_CLUSTER_ARN!,
      product: "connect",
    },
  ];

  for (const { table, cluster, product } of tables) {
    if (!table || !cluster) continue;

    let lastKey: Record<string, unknown> | undefined;
    do {
      const scanResult = await ddb.send(
        new ScanCommand({
          TableName: table,
          FilterExpression: "#s IN (:active, :starting) AND attribute_exists(ecsTaskArn)",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":active": "ACTIVE",
            ":starting": "BRIDGE_STARTING",
          },
          ExclusiveStartKey: lastKey,
          Limit: 50,
        }),
      );

      const sessions = (scanResult.Items ?? []) as SessionRecord[];
      if (sessions.length === 0) break;

      const taskArns = sessions.filter((s) => !!s.ecsTaskArn).map((s) => s.ecsTaskArn!);
      if (taskArns.length === 0) {
        lastKey = scanResult.LastEvaluatedKey as Record<string, unknown> | undefined;
        continue;
      }

      const described = await ecs.send(
        new DescribeTasksCommand({
          cluster,
          tasks: taskArns,
        }),
      );

      const taskStatusMap = new Map<string, string>();
      for (const task of described.tasks ?? []) {
        if (task.taskArn) taskStatusMap.set(task.taskArn, task.lastStatus ?? "UNKNOWN");
      }

      await Promise.allSettled(
        sessions.map(async (session) => {
          if (!session.ecsTaskArn) return;
          const ecsStatus = taskStatusMap.get(session.ecsTaskArn);
          if (ecsStatus === "RUNNING") {
            await ddb.send(
              new UpdateCommand({
                TableName: table,
                Key: { pk: session.pk, sk: session.sk },
                UpdateExpression: "SET bridgeHealthAt = :t",
                ExpressionAttributeValues: { ":t": now },
              }),
            );
          } else if (ecsStatus === "STOPPED" || ecsStatus === "DEPROVISIONING") {
            console.log(`[health-monitor] Bridge stopped for session ${session.sessionId} (${product})`);
            await ddb.send(
              new UpdateCommand({
                TableName: table,
                Key: { pk: session.pk, sk: session.sk },
                UpdateExpression: "SET #s = :closed, streamEndedAt = :t, closedReason = :reason",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: {
                  ":closed": "CLOSED",
                  ":t": now,
                  ":reason": "BRIDGE_STOPPED",
                },
              }),
            );
            if (session.kvsChannelName) {
              await kvs.deleteSessionChannel(session.kvsChannelName).catch((err) => {
                console.warn(
                  `[health-monitor] Failed to delete KVS channel ${session.kvsChannelName}:`,
                  err,
                );
              });
            }
          } else if (!ecsStatus) {
            console.warn(`[health-monitor] Task not found for session ${session.sessionId}`);
            await ddb.send(
              new UpdateCommand({
                TableName: table,
                Key: { pk: session.pk, sk: session.sk },
                UpdateExpression: "SET #s = :closed, streamEndedAt = :t, closedReason = :reason",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: {
                  ":closed": "CLOSED",
                  ":t": now,
                  ":reason": "BRIDGE_NOT_FOUND",
                },
              }),
            );
          }
        }),
      );

      lastKey = scanResult.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastKey);
  }
};
