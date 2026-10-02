import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../repositories/baseRepository.js";
import type { EidoEnvelope } from "../eido/types.js";
import type { HubIncidentLink } from "./types.js";

export class IncidentTracker {
  private links = new Map<string, HubIncidentLink>();

  constructor(private readonly tableName = "") {}

  private key(hubIncidentId: string, agencyId: string): string {
    return `${hubIncidentId}#${agencyId}`;
  }

  async link(hubIncidentId: string, agencyId: string, nativeIncidentId: string, eido: EidoEnvelope): Promise<void> {
    const record: HubIncidentLink = {
      hubIncidentId,
      agencyId,
      nativeIncidentId,
      status: eido.incident.Status,
      eido,
    };
    this.links.set(this.key(hubIncidentId, agencyId), record);
    if (!this.tableName) return;
    await ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          hubIncidentId,
          agencyId,
          nativeIncidentId,
          status: record.status,
          eido,
          updatedAt: new Date().toISOString(),
        },
      }),
    );
  }

  async listByHub(hubIncidentId: string): Promise<HubIncidentLink[]> {
    if (this.tableName) {
      const result = await ddb.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "hubIncidentId = :h",
          ExpressionAttributeValues: { ":h": hubIncidentId },
        }),
      );
      return (result.Items ?? []) as HubIncidentLink[];
    }
    return [...this.links.values()].filter((l) => l.hubIncidentId === hubIncidentId);
  }

  async listActive(agencyId?: string): Promise<HubIncidentLink[]> {
    if (this.tableName && agencyId) {
      const result = await ddb.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "agencyId-index",
          KeyConditionExpression: "agencyId = :a",
          ExpressionAttributeValues: { ":a": agencyId },
        }),
      );
      return ((result.Items ?? []) as HubIncidentLink[]).filter((l) => !["CLEARED", "CANCELLED"].includes(l.status));
    }
    return [...this.links.values()].filter((l) => {
      if (agencyId && l.agencyId !== agencyId) return false;
      return !["CLEARED", "CANCELLED"].includes(l.status);
    });
  }

  async getByNative(agencyId: string, nativeIncidentId: string): Promise<HubIncidentLink | null> {
    if (this.tableName) {
      const result = await ddb.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "agencyId-index",
          KeyConditionExpression: "agencyId = :a",
          ExpressionAttributeValues: { ":a": agencyId },
        }),
      );
      return ((result.Items ?? []) as HubIncidentLink[]).find((l) => l.nativeIncidentId === nativeIncidentId) ?? null;
    }
    return (
      [...this.links.values()].find((l) => l.agencyId === agencyId && l.nativeIncidentId === nativeIncidentId) ?? null
    );
  }

  async get(hubIncidentId: string, agencyId: string): Promise<HubIncidentLink | null> {
    if (this.tableName) {
      const result = await ddb.send(
        new GetCommand({ TableName: this.tableName, Key: { hubIncidentId, agencyId } }),
      );
      return (result.Item as HubIncidentLink | undefined) ?? null;
    }
    return this.links.get(this.key(hubIncidentId, agencyId)) ?? null;
  }
}
