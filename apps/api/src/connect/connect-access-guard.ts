import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { ConnectAccessEvent, ConnectSource } from "./connect-types.js";

export class AccessDeniedError extends Error {
  statusCode = 403;
  constructor(msg: string) {
    super(msg);
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(msg: string) {
    super(msg);
  }
}

export class IncidentClosedError extends Error {
  statusCode = 409;
  constructor(msg: string) {
    super(msg);
  }
}

export class ConnectAccessGuard {
  constructor(private ddb: DynamoDBDocumentClient) {}

  async assertActiveIncident(incidentId: string, agencyId: string): Promise<void> {
    if (!incidentId?.trim()) {
      throw new AccessDeniedError(
        "incidentId is required — media access must be tied to an active incident",
      );
    }
    const result = await this.ddb.send(
      new GetCommand({
        TableName: process.env.INCIDENTS_TABLE!,
        Key: { incidentId },
      }),
    );
    if (!result.Item) throw new NotFoundError("Incident not found");
    if (result.Item.agencyId !== agencyId) {
      throw new AccessDeniedError("Incident belongs to a different agency");
    }
    const closed = ["completed", "archived"];
    if (closed.includes(String(result.Item.status))) {
      throw new IncidentClosedError(
        `Incident is ${String(result.Item.status)} — media access not permitted on closed incidents`,
      );
    }
  }

  async assertConsentValid(sourceId: string, agencyId: string): Promise<ConnectSource> {
    const result = await this.ddb.send(
      new GetCommand({
        TableName: process.env.CONNECT_REGISTRY_TABLE!,
        Key: { pk: `SOURCE#${sourceId}`, sk: "PROFILE" },
      }),
    );
    if (!result.Item) throw new NotFoundError("Source not found in registry");
    const source = result.Item as ConnectSource;
    if (source.agencyId !== agencyId) {
      throw new AccessDeniedError("Source not authorized for this agency");
    }
    if (source.status === "SUSPENDED") {
      throw new AccessDeniedError("Source access is currently suspended");
    }
    if (!source.consentSignedAt && source.accessModel !== "EMERGENCY_OVERRIDE") {
      throw new AccessDeniedError("Consent agreement has not been signed for this source");
    }
    return source;
  }

  async writeAccessLog(event: ConnectAccessEvent): Promise<void> {
    await this.ddb.send(
      new PutCommand({
        TableName: process.env.CONNECT_ACCESS_LOG_TABLE!,
        Item: event,
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
  }

  async closeAllSessionsForIncident(incidentId: string, closedAt: string): Promise<void> {
    const sessions = await this.ddb.send(
      new QueryCommand({
        TableName: process.env.CONNECT_SESSIONS_TABLE!,
        IndexName: "incidentId-sk-index",
        KeyConditionExpression: "incidentId = :iid",
        FilterExpression: "#s IN (:req, :pend, :appr, :active, :starting)",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":iid": incidentId,
          ":req": "REQUESTED",
          ":pend": "PENDING_APPROVAL",
          ":appr": "APPROVED",
          ":active": "ACTIVE",
          ":starting": "BRIDGE_STARTING",
        },
      }),
    );
    const items = sessions.Items ?? [];

    await Promise.allSettled(
      items.map((session) =>
        this.ddb.send(
          new UpdateCommand({
            TableName: process.env.CONNECT_SESSIONS_TABLE!,
            Key: { pk: session.pk, sk: session.sk },
            UpdateExpression: "SET #s = :closed, streamEndedAt = :t",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: { ":closed": "CLOSED", ":t": closedAt },
          }),
        ),
      ),
    );

    const { ECSClient, StopTaskCommand } = await import("@aws-sdk/client-ecs");
    const { KvsChannelService } = await import("../shared/kvs-channel-service.js");
    const ecs = new ECSClient({});
    const kvs = new KvsChannelService();
    const clusterArn = process.env.CONNECT_BRIDGE_CLUSTER_ARN;

    await Promise.allSettled(
      items
        .filter((s) => s.ecsTaskArn || s.kvsChannelName)
        .map(async (session) => {
          if (session.ecsTaskArn && clusterArn) {
            await ecs
              .send(
                new StopTaskCommand({
                  cluster: clusterArn,
                  task: session.ecsTaskArn,
                  reason: `Incident ${incidentId} closed`,
                }),
              )
              .catch((err: unknown) => console.warn("[guard] ECS stop failed:", err));
          }
          if (session.kvsChannelName) {
            await kvs
              .deleteSessionChannel(String(session.kvsChannelName))
              .catch((err: unknown) => console.warn("[guard] KVS delete failed:", err));
          }
        }),
    );
  }
}
