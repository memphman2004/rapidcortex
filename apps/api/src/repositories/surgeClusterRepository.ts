import { BatchWriteCommand, DeleteCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { SurgeClusterDetail, SurgeClusterStatus } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

const ENTITY_CLUSTER = "cluster";
const ENTITY_MEMBERSHIP = "membership";

export type SurgeClusterDdbItem = {
  entityType: typeof ENTITY_CLUSTER;
  pk: string;
  sk: string;
  agencyId: string;
  clusterId: string;
  incidentIds: string[];
  status: SurgeClusterStatus;
  confidence: number;
  headlineKeywords: string[];
  perIncidentKeywords: Record<string, string[]>;
  summary: string;
  uniqueDetails: string[];
  createdAt: string;
  updatedAt: string;
  ttl: number;
};

export type SurgeMembershipDdbItem = {
  entityType: typeof ENTITY_MEMBERSHIP;
  pk: string;
  sk: string;
  agencyId: string;
  incidentId: string;
  clusterId: string;
  status: SurgeClusterStatus;
  updatedAt: string;
  ttl: number;
};

function clusterPk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}

function clusterSk(clusterId: string): string {
  return `CLUSTER#${clusterId}`;
}

function membershipPk(agencyId: string, incidentId: string): string {
  return `INCIDENT#${agencyId}#${incidentId}`;
}

export class SurgeClusterRepository {
  private table(): string {
    const t = env.surgeClustersTable;
    if (!t) throw new Error("SURGE_CLUSTERS_TABLE_NOT_CONFIGURED");
    return t;
  }

  async putClusterWithMemberships(cluster: SurgeClusterDdbItem, memberships: SurgeMembershipDdbItem[]): Promise<void> {
    const writes = [
      { PutRequest: { Item: cluster } },
      ...memberships.map((m) => ({ PutRequest: { Item: m } })),
    ];
    for (let i = 0; i < writes.length; i += 25) {
      const chunk = writes.slice(i, i + 25);
      await ddb.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.table()]: chunk,
          },
        }),
      );
    }
  }

  async getCluster(agencyId: string, clusterId: string): Promise<SurgeClusterDdbItem | null> {
    const r = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { pk: clusterPk(agencyId), sk: clusterSk(clusterId) },
      }),
    );
    const item = r.Item as SurgeClusterDdbItem | undefined;
    if (!item || item.entityType !== ENTITY_CLUSTER) return null;
    if (item.agencyId !== agencyId) return null;
    return item;
  }

  async listMembershipsForIncident(agencyId: string, incidentId: string): Promise<SurgeMembershipDdbItem[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :cp)",
        ExpressionAttributeValues: {
          ":pk": membershipPk(agencyId, incidentId),
          ":cp": "CLUSTER#",
        },
      }),
    );
    return ((r.Items as SurgeMembershipDdbItem[]) ?? []).filter(
      (x) => x.entityType === ENTITY_MEMBERSHIP && x.agencyId === agencyId,
    );
  }

  async deleteMemberships(
    agencyId: string,
    pairs: { incidentId: string; clusterId: string }[],
  ): Promise<void> {
    for (const p of pairs) {
      await ddb.send(
        new DeleteCommand({
          TableName: this.table(),
          Key: { pk: membershipPk(agencyId, p.incidentId), sk: clusterSk(p.clusterId) },
        }),
      );
    }
  }

  async deleteClusterRow(agencyId: string, clusterId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: this.table(),
        Key: { pk: clusterPk(agencyId), sk: clusterSk(clusterId) },
      }),
    );
  }

  toDetail(row: SurgeClusterDdbItem): SurgeClusterDetail {
    return {
      clusterId: row.clusterId,
      agencyId: row.agencyId,
      status: row.status,
      incidentCount: row.incidentIds.length,
      confidence: row.confidence,
      headlineKeywords: row.headlineKeywords,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
      incidentIds: row.incidentIds,
      perIncidentKeywords: row.perIncidentKeywords,
      summary: row.summary,
      uniqueDetails: row.uniqueDetails,
    };
  }
}
