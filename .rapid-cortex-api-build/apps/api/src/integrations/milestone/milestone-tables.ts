/**
 * Milestone XProtect connection metadata — DynamoDB access.
 * PK: agencyId (tenant-scoped Get/Put only; never Scan).
 */

import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../../lib/env.js";

export type MilestoneConnection = {
  agencyId: string;
  bridgeBaseUrl: string;
  siteLabel?: string;
  outboundEnabled: boolean;
  /** Secrets Manager ARN holding bridge HMAC secret (or shared with stack param). */
  credentialsSecretArn?: string;
  connectedAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  lastCameraCount?: number;
  enabled: boolean;
};

function connectionsTable(): string {
  const n = env.milestoneConnectionsTableName;
  if (!n) throw new Error("MILESTONE_CONNECTIONS_TABLE not configured");
  return n;
}

export async function getMilestoneConnection(agencyId: string): Promise<MilestoneConnection | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: connectionsTable(),
      Key: { agencyId: agencyId.trim() },
    }),
  );
  return (result.Item as MilestoneConnection | undefined) ?? null;
}

export async function putMilestoneConnection(row: MilestoneConnection): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: connectionsTable(),
      Item: {
        ...row,
        agencyId: row.agencyId.trim(),
      },
    }),
  );
}

export async function deleteMilestoneConnection(agencyId: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: connectionsTable(),
      Key: { agencyId: agencyId.trim() },
    }),
  );
}
