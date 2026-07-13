import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { RingOAuthTokens } from "./ring-types.js";
import { RING_TABLE_NAMES } from "./ring-table-names.js";
import { RingTokenStore } from "./ring-token-store.js";
import { computeRingLinkNonce, constantTimeEqual } from "./ring-nonce.js";
import { getRingCredentials } from "./ring-credentials.js";

export type UnclaimedRingTokenRecord = {
  accountId: string;
  secretKey: string;
  status: "unclaimed" | "claimed";
  createdAt: string;
  claimedByUserId?: string;
  claimedAt?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Dynamo index of Appstore unclaimed OAuth tokens (tokens live in Secrets Manager).
 * Used to match Ring `nonce` + `time` to the correct Ring Account ID.
 */
export class RingUnclaimedTokenService {
  private readonly ddb: DynamoDBDocumentClient;
  private readonly tokenStore: RingTokenStore;

  constructor(ddb?: DynamoDBDocumentClient, tokenStore?: RingTokenStore) {
    this.ddb =
      ddb ??
      DynamoDBDocumentClient.from(new DynamoDBClient({}), {
        marshallOptions: { removeUndefinedValues: true },
      });
    this.tokenStore = tokenStore ?? new RingTokenStore();
  }

  async storeUnclaimed(accountId: string, tokens: RingOAuthTokens): Promise<UnclaimedRingTokenRecord> {
    const id = accountId.trim();
    if (!id) throw new Error("Ring accountId is required");
    const secretKey = await this.tokenStore.storeUnclaimedTokens(id, tokens);
    const record: UnclaimedRingTokenRecord = {
      accountId: id,
      secretKey,
      status: "unclaimed",
      createdAt: nowIso(),
    };
    await this.ddb.send(
      new PutCommand({
        TableName: RING_TABLE_NAMES.UNCLAIMED_TOKENS,
        Item: record,
      }),
    );
    return record;
  }

  async listUnclaimed(): Promise<UnclaimedRingTokenRecord[]> {
    const out = await this.ddb.send(
      new ScanCommand({
        TableName: RING_TABLE_NAMES.UNCLAIMED_TOKENS,
        FilterExpression: "#s = :unclaimed",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":unclaimed": "unclaimed" },
      }),
    );
    return (out.Items ?? []) as UnclaimedRingTokenRecord[];
  }

  /**
   * Match Ring redirect nonce to an unclaimed token by recomputing HMAC for each Account ID.
   */
  async matchNonce(
    nonce: string,
    timeMs: string,
  ): Promise<{ record: UnclaimedRingTokenRecord; tokens: RingOAuthTokens } | null> {
    const { hmacKey } = await getRingCredentials();
    const unclaimed = await this.listUnclaimed();
    for (const record of unclaimed) {
      const computed = computeRingLinkNonce(timeMs, record.accountId, hmacKey);
      if (!constantTimeEqual(computed, nonce)) continue;
      const tokens = await this.tokenStore.getTokens(record.secretKey);
      return { record, tokens };
    }
    return null;
  }

  async claim(accountId: string, userId: string): Promise<void> {
    const ts = nowIso();
    await this.ddb.send(
      new UpdateCommand({
        TableName: RING_TABLE_NAMES.UNCLAIMED_TOKENS,
        Key: { accountId },
        UpdateExpression: "SET #s = :claimed, claimedByUserId = :userId, claimedAt = :claimedAt",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":claimed": "claimed",
          ":userId": userId,
          ":claimedAt": ts,
        },
      }),
    );
  }

  async delete(accountId: string): Promise<void> {
    await this.ddb.send(
      new DeleteCommand({
        TableName: RING_TABLE_NAMES.UNCLAIMED_TOKENS,
        Key: { accountId },
      }),
    );
  }
}
