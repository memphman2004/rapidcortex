import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../repositories/baseRepository.js";
import type { APCOUnitStatusCode } from "../eido/types.js";
import type { UnitLocation } from "./types.js";

export class AVLStore {
  private positions = new Map<string, UnitLocation>();

  constructor(private readonly tableName = "") {}

  key(agencyId: string, unitId: string): string {
    return `${agencyId}#${unitId}`;
  }

  async upsert(position: UnitLocation): Promise<void> {
    this.positions.set(this.key(position.agencyId, position.unitId), position);
    if (!this.tableName) return;
    const ttl = Math.floor(Date.now() / 1000) + 3600;
    await ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: this.key(position.agencyId, position.unitId),
          ...position,
          ttl,
        },
      }),
    );
  }

  async get(agencyId: string, unitId: string): Promise<UnitLocation | null> {
    if (this.tableName) {
      const result = await ddb.send(
        new GetCommand({ TableName: this.tableName, Key: { pk: this.key(agencyId, unitId) } }),
      );
      return (result.Item as UnitLocation | undefined) ?? null;
    }
    return this.positions.get(this.key(agencyId, unitId)) ?? null;
  }

  async list(agencyIds: string[], statuses?: APCOUnitStatusCode[]): Promise<UnitLocation[]> {
    if (this.tableName) {
      const rows: UnitLocation[] = [];
      for (const agencyId of agencyIds) {
        const result = await ddb.send(
          new QueryCommand({
            TableName: this.tableName,
            IndexName: "agencyId-index",
            KeyConditionExpression: "agencyId = :a",
            ExpressionAttributeValues: { ":a": agencyId },
          }),
        );
        rows.push(...((result.Items ?? []) as UnitLocation[]));
      }
      return rows.filter((p) => !statuses?.length || statuses.includes(p.status));
    }
    return [...this.positions.values()].filter((p) => {
      if (!agencyIds.includes(p.agencyId)) return false;
      if (statuses?.length && !statuses.includes(p.status)) return false;
      return true;
    });
  }
}
