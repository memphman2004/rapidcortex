/**
 * AI Gate Repository — DynamoDB wrapper.
 * Table: AgencyAiGateTable (pk = AGENCY#<id>, sk = CONFIG#AI_GATE | AI_GATE_AUDIT#<ISO>)
 */

import { GetCommand, PutCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { AIGateAuditRecord, AIGateConfig } from "rapid-cortex-shared";
import { defaultAIGateConfig } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

function table(): string {
  const t = env.agencyAiGateTable?.trim();
  if (!t) throw new Error("AGENCY_AI_GATE_TABLE is not configured");
  return t;
}

export class AIGateRepository {
  async getConfig(agencyId: string): Promise<AIGateConfig> {
    const res = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { pk: `AGENCY#${agencyId}`, sk: "CONFIG#AI_GATE" },
      }),
    );
    if (!res.Item) return defaultAIGateConfig(agencyId);
    const raw = res.Item;
    return {
      agencyId,
      aiEnabled: Boolean(raw.aiEnabled),
      features: raw.features as AIGateConfig["features"],
      toggledAt: String(raw.toggledAt ?? ""),
      toggledBy: String(raw.toggledBy ?? "system"),
      toggleReason: (raw.toggleReason as string | null | undefined) ?? null,
    };
  }

  async putConfigWithAudit(config: AIGateConfig, audit: AIGateAuditRecord): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 60 * 60;

    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: table(),
              Item: {
                pk: `AGENCY#${config.agencyId}`,
                sk: "CONFIG#AI_GATE",
                agencyId: config.agencyId,
                aiEnabled: config.aiEnabled,
                features: config.features,
                toggledAt: config.toggledAt,
                toggledBy: config.toggledBy,
                toggleReason: config.toggleReason,
                updatedAt: new Date().toISOString(),
              },
            },
          },
          {
            Put: {
              TableName: table(),
              Item: {
                pk: `AGENCY#${config.agencyId}`,
                sk: `AI_GATE_AUDIT#${audit.auditedAt}`,
                ...audit,
                ttl,
              },
            },
          },
        ],
      }),
    );
  }

  async listAuditHistory(agencyId: string, limit = 50): Promise<AIGateAuditRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `AGENCY#${agencyId}`,
          ":prefix": "AI_GATE_AUDIT#",
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items ?? []) as AIGateAuditRecord[];
  }
}

/** Convenience Put when only seeding — not used by toggle path. */
export async function putAIGateConfigOnly(config: AIGateConfig): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        pk: `AGENCY#${config.agencyId}`,
        sk: "CONFIG#AI_GATE",
        ...config,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
}
