import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { nanoid } from "nanoid";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { IncomingCall, CallCluster, ClusterAssignment, ClusterAction, UniqueDetail, ClusteredCall } from "../types/surge-types.js";
import { keywordsForCall } from "../utils/surge-call-keywords.js";
import { SurgeClusteringEngine } from "./surge-clustering.js";
import { UniqueDetailExtractor } from "./unique-detail-extractor.js";
import { ClusterSummaryGenerator } from "./cluster-summary-generator.js";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.SURGE_TABLE_NAME || "rapid-cortex-surge";

export class SurgeDetectionService {
  private clusteringEngine: SurgeClusteringEngine;
  private detailExtractor: UniqueDetailExtractor;
  private summaryGenerator: ClusterSummaryGenerator;

  constructor() {
    this.clusteringEngine = new SurgeClusteringEngine();
    this.detailExtractor = new UniqueDetailExtractor();
    this.summaryGenerator = new ClusterSummaryGenerator();
  }

  summarizeClusterForCad(cluster: CallCluster): string {
    const details = this.detailExtractor.extractUniqueDetails(cluster);
    return this.summaryGenerator.generateCADNote(cluster, details);
  }

  async analyzeCall(call: IncomingCall): Promise<ClusterAssignment | null> {
    const activeClusters = await this.getActiveClusters(call.agencyId);

    const assignment = await this.clusteringEngine.findMatchingCluster(call, activeClusters);

    if (assignment) {
      await this.addCallToCluster(assignment.clusterId, call);
    } else {
      await this.checkForNewCluster(call, activeClusters);
    }

    await this.logAudit(AUDIT_EVENT_TYPES.SURGE_CALL_ANALYZED, {
      callId: call.callId,
      agencyId: call.agencyId,
      clusterId: assignment?.clusterId,
      confidence: assignment?.confidence,
    });

    return assignment;
  }

  async getActiveClusters(agencyId: string): Promise<CallCluster[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        FilterExpression: "#status = :active",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":pk": `AGENCY#${agencyId}`,
          ":active": "active",
        },
      }),
    );

    if (!result.Items || result.Items.length === 0) return [];

    const clusters: CallCluster[] = [];
    for (const item of result.Items) {
      const clusterId = String(item.clusterId);
      const cluster = await this.getClusterDetail(clusterId);
      if (cluster) clusters.push(cluster);
    }

    return clusters;
  }

  async getClusterDetail(clusterId: string): Promise<CallCluster | null> {
    const metaResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CLUSTER#${clusterId}`,
          SK: "METADATA",
        },
      }),
    );

    if (!metaResult.Item) return null;

    const callsResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `CLUSTER#${clusterId}`,
          ":sk": "CALL#",
        },
      }),
    );

    const calls: ClusteredCall[] = (callsResult.Items || []).map((item) => ({
      callId: String(item.callId),
      incidentId: String(item.incidentId),
      timestamp: String(item.timestamp),
      caller: String(item.caller),
      transcript: String(item.transcript),
      uniqueInfo: (item.uniqueInfo as string[]) || [],
      hasMedia: Boolean(item.hasMedia),
      location: item.location as ClusteredCall["location"],
    }));

    return {
      clusterId: String(metaResult.Item.clusterId),
      agencyId: String(metaResult.Item.agencyId),
      incidentType: String(metaResult.Item.incidentType),
      location: metaResult.Item.location as CallCluster["location"],
      calls,
      firstCallAt: String(metaResult.Item.firstCallAt),
      lastCallAt: String(metaResult.Item.lastCallAt),
      callCount: Number(metaResult.Item.callCount),
      confidence: Number(metaResult.Item.confidence),
      status: metaResult.Item.status as CallCluster["status"],
      uniqueDetails: (metaResult.Item.uniqueDetails as string[]) || [],
      suggestedPriority: metaResult.Item.suggestedPriority as CallCluster["suggestedPriority"],
      keywords: (metaResult.Item.keywords as string[]) || [],
    };
  }

  async extractUniqueDetails(clusterId: string): Promise<UniqueDetail[]> {
    const cluster = await this.getClusterDetail(clusterId);
    if (!cluster) return [];

    return this.detailExtractor.extractUniqueDetails(cluster);
  }

  async manageCluster(clusterId: string, action: ClusterAction, userId: string): Promise<void> {
    switch (action.type) {
      case "confirm":
        await this.confirmCluster(clusterId, userId, action.note);
        break;
      case "split":
        await this.splitCluster(clusterId, action.callIds, userId);
        break;
      case "dismiss":
        await this.dismissCluster(clusterId, userId, action.reason);
        break;
    }
  }

  private async addCallToCluster(clusterId: string, call: IncomingCall): Promise<void> {
    const keywords = keywordsForCall(call.transcript, call.callType);

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `CLUSTER#${clusterId}`,
          SK: `CALL#${call.callId}`,
          callId: call.callId,
          incidentId: call.incidentId,
          timestamp: call.timestamp,
          caller: this.maskPhoneNumber(call.caller.phoneNumber),
          transcript: call.transcript,
          location: call.location,
          keywords,
          hasMedia: false,
          ttl: Math.floor(Date.now() / 1000) + 86400 * 7,
        },
      }),
    );

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CLUSTER#${clusterId}`,
          SK: "METADATA",
        },
        UpdateExpression:
          "SET lastCallAt = :time, callCount = callCount + :one, keywords = list_append(if_not_exists(keywords, :empty), :newKeywords)",
        ExpressionAttributeValues: {
          ":time": call.timestamp,
          ":one": 1,
          ":empty": [],
          ":newKeywords": keywords,
        },
      }),
    );
  }

  private async checkForNewCluster(call: IncomingCall, _existingClusters: CallCluster[]): Promise<void> {
    console.info("[surge Phase2 scaffold] new cluster evaluation", { callId: call.callId, trace: nanoid(8) });
  }

  private async confirmCluster(clusterId: string, userId: string, note?: string): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CLUSTER#${clusterId}`,
          SK: "METADATA",
        },
        UpdateExpression:
          "SET #status = :confirmed, confirmedBy = :user, confirmedAt = :time, confirmNote = :note",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":confirmed": "confirmed",
          ":user": userId,
          ":time": new Date().toISOString(),
          ":note": note || "",
        },
      }),
    );

    await this.logAudit(AUDIT_EVENT_TYPES.SURGE_CLUSTER_CONFIRMED, {
      clusterId,
      userId,
      note,
    });
  }

  private async splitCluster(clusterId: string, callIds: string[], userId: string): Promise<void> {
    await this.logAudit(AUDIT_EVENT_TYPES.SURGE_CLUSTER_SPLIT, {
      clusterId,
      userId,
      splitCallIds: callIds,
    });
  }

  private async dismissCluster(clusterId: string, userId: string, reason: string): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CLUSTER#${clusterId}`,
          SK: "METADATA",
        },
        UpdateExpression:
          "SET #status = :dismissed, dismissedBy = :user, dismissedAt = :time, dismissReason = :reason",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":dismissed": "dismissed",
          ":user": userId,
          ":time": new Date().toISOString(),
          ":reason": reason,
        },
      }),
    );

    await this.logAudit(AUDIT_EVENT_TYPES.SURGE_CLUSTER_DISMISSED, {
      clusterId,
      userId,
      reason,
    });
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) return phone;
    return phone.slice(0, -4).replace(/\d/g, "*") + phone.slice(-4);
  }

  private async logAudit(type: string, metadata: Record<string, unknown>): Promise<void> {
    console.info("[AUDIT]", type, metadata);
  }
}
