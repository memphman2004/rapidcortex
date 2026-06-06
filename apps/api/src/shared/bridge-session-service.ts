import { DescribeTasksCommand, ECSClient, RunTaskCommand, StopTaskCommand } from "@aws-sdk/client-ecs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { KvsChannelService, type ChannelPrefix } from "./kvs-channel-service.js";

const ecs = new ECSClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export type BridgeProduct = "connect" | "venue";

export interface BridgeStartOptions {
  sessionId: string;
  incidentId: string;
  rtspUrl: string;
  credentialsSecretArn?: string;
  product: BridgeProduct;
  sessionsTableName: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export class BridgeSessionService {
  constructor(private kvs: KvsChannelService) {}

  private async getActiveSession(
    cameraId: string,
    product: BridgeProduct,
  ): Promise<{ sessionId: string; kvsChannelName: string; ecsTaskArn: string; status: string } | null> {
    const sessionsTable =
      product === "connect"
        ? required("CONNECT_SESSIONS_TABLE")
        : process.env.VENUE_CAMERA_SESSIONS_TABLE?.trim() || required("CONNECT_SESSIONS_TABLE");

    const result = await ddb.send(
      new QueryCommand({
        TableName: sessionsTable,
        IndexName: "incidentId-sk-index",
        KeyConditionExpression: "incidentId = :cameraId",
        FilterExpression: "sourceId = :cid AND #s IN (:active, :starting)",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":cameraId": cameraId,
          ":cid": cameraId,
          ":active": "ACTIVE",
          ":starting": "BRIDGE_STARTING",
        },
        Limit: 1,
      }),
    );

    const item = result.Items?.[0] as
      | { sessionId?: string; kvsChannelName?: string; ecsTaskArn?: string; status?: string }
      | undefined;
    if (!item?.sessionId || !item.kvsChannelName || !item.ecsTaskArn || !item.status) return null;

    return {
      sessionId: item.sessionId,
      kvsChannelName: item.kvsChannelName,
      ecsTaskArn: item.ecsTaskArn,
      status: item.status,
    };
  }

  async startBridge(opts: BridgeStartOptions): Promise<{
    kvsChannelName: string;
    ecsTaskArn: string;
  }> {
    const existing = await this.getActiveSession(opts.sessionId, opts.product);
    if (existing && (existing.status === "ACTIVE" || existing.status === "BRIDGE_STARTING")) {
      console.log(`[bridge] Reusing active session for camera ${opts.sessionId}`);
      return {
        kvsChannelName: existing.kvsChannelName,
        ecsTaskArn: existing.ecsTaskArn,
      };
    }

    const prefix: ChannelPrefix = opts.product === "connect" ? "rc-connect" : "rc-venue";
    const kvsChannelName = await this.kvs.createSessionChannel(opts.sessionId, prefix);

    const clusterArn =
      opts.product === "connect"
        ? required("CONNECT_BRIDGE_CLUSTER_ARN")
        : required("VENUE_BRIDGE_CLUSTER_ARN");

    const taskDefinition =
      opts.product === "connect"
        ? required("CONNECT_BRIDGE_TASK_DEFINITION")
        : required("VENUE_BRIDGE_TASK_DEFINITION");

    const result = await ecs.send(
      new RunTaskCommand({
        cluster: clusterArn,
        taskDefinition,
        launchType: "FARGATE",
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: required("BRIDGE_SUBNET_IDS").split(",").map((x) => x.trim()),
            securityGroups: required("BRIDGE_SECURITY_GROUP_IDS")
              .split(",")
              .map((x) => x.trim()),
            assignPublicIp: "DISABLED",
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: `rc-${opts.product}-bridge`,
              environment: [
                { name: "RTSP_URL", value: opts.rtspUrl },
                { name: "KVS_CHANNEL_NAME", value: kvsChannelName },
                { name: "KVS_REGION", value: required("AWS_REGION") },
                { name: "SESSION_ID", value: opts.sessionId },
                { name: "INCIDENT_ID", value: opts.incidentId },
                { name: "PRODUCT", value: opts.product },
                { name: "SESSIONS_TABLE", value: opts.sessionsTableName },
                { name: "CREDENTIALS_SECRET_ARN", value: opts.credentialsSecretArn ?? "" },
              ],
            },
          ],
        },
        tags: [
          { key: "sessionId", value: opts.sessionId },
          { key: "incidentId", value: opts.incidentId },
          { key: "product", value: opts.product },
        ],
      }),
    );

    const taskArn = result.tasks?.[0]?.taskArn;
    if (!taskArn) throw new Error("ECS task failed to start");
    return { kvsChannelName, ecsTaskArn: taskArn };
  }

  async stopBridge(ecsTaskArn: string, product: BridgeProduct): Promise<void> {
    const clusterArn =
      product === "connect"
        ? required("CONNECT_BRIDGE_CLUSTER_ARN")
        : required("VENUE_BRIDGE_CLUSTER_ARN");
    try {
      await ecs.send(
        new StopTaskCommand({
          cluster: clusterArn,
          task: ecsTaskArn,
          reason: "Session closed — incident resolved or dispatcher ended stream",
        }),
      );
    } catch (err) {
      console.warn("[bridge] stopBridge error (task may already be stopped):", err);
    }
  }

  async waitForBridgeReady(
    ecsTaskArn: string,
    product: BridgeProduct,
    timeoutMs = 30_000,
  ): Promise<boolean> {
    const clusterArn =
      product === "connect"
        ? required("CONNECT_BRIDGE_CLUSTER_ARN")
        : required("VENUE_BRIDGE_CLUSTER_ARN");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await ecs.send(
        new DescribeTasksCommand({
          cluster: clusterArn,
          tasks: [ecsTaskArn],
        }),
      );
      const task = result.tasks?.[0];
      if (task?.lastStatus === "RUNNING") return true;
      if (task?.lastStatus === "STOPPED") return false;
      await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  }
}
