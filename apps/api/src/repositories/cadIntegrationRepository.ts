import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type {
  CadConnectionType,
  CadIntegrationStatus,
  CadVendor,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export type CadPollHistoryPoint = {
  ts: string;
  ok: boolean;
  incidentCount: number;
  latencyMs: number;
};

export type CadCircuitBreakerRecord = {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failureCount: number;
  openedAt?: string;
  cooldownUntil?: string;
};

export type CadIntegrationRecord = {
  id: string;
  agencyId: string;
  name: string;
  vendor: CadVendor;
  status: CadIntegrationStatus;
  connectionType: CadConnectionType;
  config: Record<string, unknown>;
  webhookSecretHash?: string;
  lastPingAt?: string;
  lastIncidentAt?: string;
  lastSuccessfulPollAt?: string;
  circuitBreaker?: CadCircuitBreakerRecord;
  pollHistory?: CadPollHistoryPoint[];
  incidentCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export class CadIntegrationRepository {
  private table(): string {
    const t = env.cadIntegrationsTable;
    if (!t) throw new Error("CAD_INTEGRATIONS_UNAVAILABLE");
    return t;
  }

  async create(record: CadIntegrationRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: record,
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
  }

  async getById(agencyId: string, id: string): Promise<CadIntegrationRecord | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { id },
      }),
    );
    const it = res.Item as CadIntegrationRecord | undefined;
    if (!it || it.agencyId !== agencyId) return null;
    return it;
  }

  async listByAgency(agencyId: string, limit = 100): Promise<CadIntegrationRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items ?? []) as CadIntegrationRecord[];
  }

  /** Scan for active API-poll integrations (scheduled poller). Scoped filter; limit caps scan cost per tick. */
  async listActiveApiPollIntegrations(limit = 50): Promise<CadIntegrationRecord[]> {
    return this.listApiPollIntegrations(limit);
  }

  /** API-poll integrations eligible for scheduled polling (active, testing, or auth_error for metrics). */
  async listApiPollIntegrations(limit = 80): Promise<CadIntegrationRecord[]> {
    const res = await ddb.send(
      new ScanCommand({
        TableName: this.table(),
        FilterExpression:
          "connectionType = :ct AND (#st = :active OR #st = :testing OR #st = :auth)",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: {
          ":ct": "api_poll",
          ":active": "active",
          ":testing": "testing",
          ":auth": "auth_error",
        },
        Limit: limit,
      }),
    );
    return (res.Items ?? []) as CadIntegrationRecord[];
  }

  async update(
    agencyId: string,
    id: string,
    updates: Partial<
      Pick<
        CadIntegrationRecord,
        | "status"
        | "name"
        | "config"
        | "errorMessage"
        | "lastPingAt"
        | "lastIncidentAt"
        | "lastSuccessfulPollAt"
        | "webhookSecretHash"
        | "circuitBreaker"
        | "pollHistory"
      >
    > & { incrementIncidentCount?: number },
  ): Promise<CadIntegrationRecord | null> {
    const existing = await this.getById(agencyId, id);
    if (!existing) return null;
    const { incrementIncidentCount, config, ...rest } = updates;
    const next: CadIntegrationRecord = {
      ...existing,
      ...rest,
      config: config ? { ...existing.config, ...config } : existing.config,
      incidentCount: existing.incidentCount + (incrementIncidentCount ?? 0),
      updatedAt: new Date().toISOString(),
    };
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: next,
      }),
    );
    return next;
  }

  async delete(agencyId: string, id: string): Promise<boolean> {
    try {
      await ddb.send(
        new DeleteCommand({
          TableName: this.table(),
          Key: { id },
          ConditionExpression: "agencyId = :a",
          ExpressionAttributeValues: { ":a": agencyId },
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
