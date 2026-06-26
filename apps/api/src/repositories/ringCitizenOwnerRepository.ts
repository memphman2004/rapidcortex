import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { RingCitizenOwnerRecord } from "rapid-cortex-integrations/ring";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export function ringCitizenOwnerPk(ringAccountId: string): string {
  return `RINGOWNER#${ringAccountId}`;
}

function ownersTable(): string {
  const t = env.ringCitizenOwnersTable?.trim();
  if (!t) throw new Error("RING_TABLE_CITIZEN_OWNERS_NOT_CONFIGURED");
  return t;
}

export class RingCitizenOwnerRepository {
  async getByRingAccountId(ringAccountId: string): Promise<RingCitizenOwnerRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: ownersTable(),
        Key: { pk: ringCitizenOwnerPk(ringAccountId) },
      }),
    );
    if (!out.Item) return null;
    return out.Item as RingCitizenOwnerRecord;
  }

  async upsert(owner: RingCitizenOwnerRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: ownersTable(),
        Item: owner,
      }),
    );
  }
}
