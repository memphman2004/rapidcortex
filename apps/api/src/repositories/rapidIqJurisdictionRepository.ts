/**
 * Rapid IQ jurisdiction + state coverage — RC-global platform tables (no agencyId).
 * Access is RBAC-gated at HTTP handlers (rcsuperadmin | rcadmin only).
 */
import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { Jurisdiction, StateCoverage } from "../lib/rapid-iq/jurisdiction-registry.js";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

function jurisdictionsTable(): string {
  const t = env.rapidIqJurisdictionsTable;
  if (!t) throw new Error("RAPID_IQ_JURISDICTIONS_TABLE_NOT_CONFIGURED");
  return t;
}

function coverageTable(): string {
  const t = env.rapidIqStateCoverageTable;
  if (!t) throw new Error("RAPID_IQ_STATE_COVERAGE_TABLE_NOT_CONFIGURED");
  return t;
}

export class RapidIqJurisdictionRepository {
  async listAll(): Promise<Jurisdiction[]> {
    const items: Jurisdiction[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await ddb.send(
        new ScanCommand({
          TableName: jurisdictionsTable(),
          ExclusiveStartKey,
        }),
      );
      for (const item of r.Items ?? []) {
        items.push(item as Jurisdiction);
      }
      ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);
    return items;
  }

  async updateLastScanned(jurisdictionId: string, scannedAt: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: jurisdictionsTable(),
        Key: { jurisdictionId },
        UpdateExpression: "SET lastScannedAt = :t, updatedAt = :t, priorityBoost = :z",
        ExpressionAttributeValues: { ":t": scannedAt, ":z": 0 },
      }),
    );
  }

  async getAllStateCoverage(): Promise<StateCoverage[]> {
    const items: StateCoverage[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await ddb.send(
        new ScanCommand({
          TableName: coverageTable(),
          ExclusiveStartKey,
        }),
      );
      for (const item of r.Items ?? []) {
        items.push(item as StateCoverage);
      }
      ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);
    return items;
  }

  async updateStateCoverage(stateCode: string, scannedAt: string, signalsDelta = 0): Promise<void> {
    const existing = await ddb.send(
      new GetCommand({ TableName: coverageTable(), Key: { stateCode } }),
    );
    const prev = (existing.Item as StateCoverage | undefined) ?? null;
    await ddb.send(
      new PutCommand({
        TableName: coverageTable(),
        Item: {
          stateCode,
          stateName: prev?.stateName ?? stateCode,
          lastScannedAt: scannedAt,
          lastSignalAt: signalsDelta > 0 ? scannedAt : (prev?.lastSignalAt ?? null),
          totalSignals: (prev?.totalSignals ?? 0) + signalsDelta,
          jurisdictionCount: prev?.jurisdictionCount ?? 0,
          updatedAt: scannedAt,
        },
      }),
    );
  }

  async putJurisdiction(j: Jurisdiction & { createdAt?: string; updatedAt?: string }): Promise<void> {
    await ddb.send(new PutCommand({ TableName: jurisdictionsTable(), Item: j }));
  }
}
