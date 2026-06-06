import { createHash, randomBytes } from "node:crypto";
import { randomUUID } from "node:crypto";
import type {
  RcLiteKeyEnv,
  RcLiteKeyTier,
  RcLiteProgrammaticApiKey,
  RcLiteProgrammaticScope,
} from "rapid-cortex-shared";
import { RcLiteApiKeyRepository } from "../repositories/rcLiteApiKeyRepository.js";
import { RC_LITE_TIER_LIMITS } from "../v1/config/tierLimits.js";

const PREFIX = {
  live: "rclite_live_",
  test: "rclite_test_",
} as const;

function rawKeySecret(env: RcLiteKeyEnv): string {
  const body = randomBytes(16).toString("hex");
  return `${PREFIX[env]}${body}`;
}

function hashRawKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

const repo = new RcLiteApiKeyRepository();

export class RcLiteApiKeyService {
  async createApiKey(params: {
    agencyId: string;
    customerId: string;
    name: string;
    tier: RcLiteKeyTier;
    env: RcLiteKeyEnv;
    scopes: RcLiteProgrammaticScope[];
    createdBy: string;
  }): Promise<{ key: RcLiteProgrammaticApiKey; rawKey: string }> {
    const limits = RC_LITE_TIER_LIMITS[params.tier];
    const rawKey = rawKeySecret(params.env);
    const row: RcLiteProgrammaticApiKey = {
      keyId: `key_${randomUUID()}`,
      agencyId: params.agencyId,
      customerId: params.customerId,
      name: params.name,
      keyHash: hashRawKey(rawKey),
      prefix: PREFIX[params.env],
      env: params.env,
      tier: params.tier,
      scopes: params.scopes,
      status: "active",
      monthlyCallLimit: limits.monthlyCallLimit,
      rateLimitPerMinute: limits.rateLimitPerMinute,
      createdAt: new Date().toISOString(),
      notes: `createdBy:${params.createdBy}`,
    };
    await repo.put(row);
    return { key: row, rawKey };
  }

  async lookupByHash(rawKey: string): Promise<RcLiteProgrammaticApiKey | null> {
    const trimmed = rawKey.trim();
    if (!trimmed.startsWith("rclite_")) return null;
    const h = hashRawKey(trimmed);
    const row = await repo.lookupByHash(h);
    if (!row || row.status !== "active") return null;
    return row;
  }

  async revokeKey(keyId: string, revokedBy: string): Promise<void> {
    await repo.revoke(keyId, revokedBy, new Date().toISOString());
  }

  async listKeysByAgency(agencyId: string): Promise<RcLiteProgrammaticApiKey[]> {
    return repo.listByAgency(agencyId);
  }

  async rotateKey(
    oldKeyId: string,
    rotatedBy: string,
  ): Promise<{ key: RcLiteProgrammaticApiKey; rawKey: string }> {
    const oldRow = await repo.getByKeyId(oldKeyId);
    if (!oldRow || oldRow.status !== "active") throw new Error("NOT_FOUND_OR_INACTIVE");
    await this.revokeKey(oldKeyId, rotatedBy);
    return this.createApiKey({
      agencyId: oldRow.agencyId,
      customerId: oldRow.customerId,
      name: `${oldRow.name} (rotated)`,
      tier: oldRow.tier,
      env: oldRow.env,
      scopes: oldRow.scopes,
      createdBy: rotatedBy,
    });
  }

  /** Fire-and-forget; never throw to caller pipeline. */
  touchLastUsed(keyId: string): void {
    void repo.updateLastUsed(keyId, new Date().toISOString()).catch(() => {});
  }
}
