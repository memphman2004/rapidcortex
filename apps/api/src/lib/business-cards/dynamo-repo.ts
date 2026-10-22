import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  BusinessCardAuditLog,
  BusinessCardEvent,
  BusinessCardProfile,
  NFCCard,
  TenantBizCardConfig,
} from "./types.js";
import type { BizCardRepo, ProfilePage } from "./repo.js";

function client(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export class DynamoBizCardRepo implements BizCardRepo {
  private readonly doc = client();
  constructor(private readonly tableName: string) {}

  async getConfig(tenantId: string): Promise<TenantBizCardConfig | null> {
    const res = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: `TENANT#${tenantId}`, sk: "CONFIG" } }),
    );
    return (res.Item as TenantBizCardConfig | undefined) ?? null;
  }

  async putConfig(config: TenantBizCardConfig): Promise<void> {
    await this.doc.send(new PutCommand({ TableName: this.tableName, Item: config }));
  }

  async getProfile(profileId: string): Promise<BusinessCardProfile | null> {
    const res = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `PROFILE#${profileId}`, sk: `PROFILE#${profileId}` },
      }),
    );
    return (res.Item as BusinessCardProfile | undefined) ?? null;
  }

  async getProfileByUser(tenantId: string, cognitoUserId: string): Promise<BusinessCardProfile | null> {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "gsi3",
        KeyConditionExpression: "gsi3pk = :pk AND gsi3sk = :sk",
        ExpressionAttributeValues: { ":pk": `USER#${cognitoUserId}`, ":sk": "PROFILE" },
      }),
    );
    const item = (res.Items ?? []).find((row) => row.tenantId === tenantId) as BusinessCardProfile | undefined;
    return item ?? null;
  }

  async getProfileBySlug(slug: string): Promise<BusinessCardProfile | null> {
    const pointer = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: `SLUG#${slug}`, sk: "POINTER" } }),
    );
    const profileId = pointer.Item?.profileId;
    if (typeof profileId !== "string") return null;
    return this.getProfile(profileId);
  }

  async getProfileByPublicId(publicProfileId: string): Promise<BusinessCardProfile | null> {
    const pointer = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `PUBLIC#${publicProfileId}`, sk: "POINTER" },
      }),
    );
    const profileId = pointer.Item?.profileId;
    if (typeof profileId !== "string") return null;
    return this.getProfile(profileId);
  }

  async saveProfile(
    profile: BusinessCardProfile,
    expectedVersion: number | null,
  ): Promise<"ok" | "conflict" | "slug_taken"> {
    const existing = expectedVersion === null ? null : await this.getProfile(profile.profileId);
    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: profile,
                ConditionExpression:
                  expectedVersion === null ? "attribute_not_exists(pk)" : "version = :version",
                ExpressionAttributeValues:
                  expectedVersion === null ? undefined : { ":version": expectedVersion },
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  pk: `SLUG#${profile.slug}`,
                  sk: "POINTER",
                  profileId: profile.profileId,
                  tenantId: profile.tenantId,
                },
                ConditionExpression: "attribute_not_exists(pk) OR profileId = :profileId",
                ExpressionAttributeValues: { ":profileId": profile.profileId },
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  pk: `PUBLIC#${profile.publicProfileId}`,
                  sk: "POINTER",
                  profileId: profile.profileId,
                  tenantId: profile.tenantId,
                },
              },
            },
            ...(existing && existing.slug !== profile.slug
              ? [
                  {
                    Delete: {
                      TableName: this.tableName,
                      Key: { pk: `SLUG#${existing.slug}`, sk: "POINTER" },
                      ConditionExpression: "profileId = :profileId",
                      ExpressionAttributeValues: { ":profileId": profile.profileId },
                    },
                  },
                ]
              : []),
          ],
        }),
      );
      return "ok";
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "TransactionCanceledException" || name === "ConditionalCheckFailedException") {
        const reasons = (error as { CancellationReasons?: Array<{ Code?: string }> }).CancellationReasons ?? [];
        if (reasons[1]?.Code === "ConditionalCheckFailed") return "slug_taken";
        return "conflict";
      }
      throw error;
    }
  }

  async listProfiles(tenantId: string, limit: number, cursor?: string): Promise<ProfilePage> {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :pk AND begins_with(gsi1sk, :prefix)",
        ExpressionAttributeValues: { ":pk": `TENANT#${tenantId}`, ":prefix": "PROFILE#" },
        Limit: limit,
        ExclusiveStartKey: cursor ? (JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>) : undefined,
        ScanIndexForward: false,
      }),
    );
    return {
      items: (res.Items ?? []) as BusinessCardProfile[],
      cursor: res.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(res.LastEvaluatedKey), "utf8").toString("base64url")
        : undefined,
    };
  }

  async incrementCounter(
    profileId: string,
    field: "totalViews" | "totalVcfDownloads" | "totalCallClicks" | "totalEmailClicks" | "totalWebClicks",
    touchLastViewed: boolean,
    now: number,
  ): Promise<void> {
    await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `PROFILE#${profileId}`, sk: `PROFILE#${profileId}` },
        UpdateExpression: touchLastViewed
          ? `ADD ${field} :one SET lastViewedAt = :now`
          : `ADD ${field} :one`,
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeValues: touchLastViewed ? { ":one": 1, ":now": now } : { ":one": 1 },
      }),
    );
  }

  async getCard(cardId: string): Promise<NFCCard | null> {
    const res = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: `NFC#${cardId}`, sk: `NFC#${cardId}` } }),
    );
    return (res.Item as NFCCard | undefined) ?? null;
  }

  async saveCard(card: NFCCard, expectedVersion: number | null): Promise<"ok" | "conflict"> {
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: card,
          ConditionExpression: expectedVersion === null ? "attribute_not_exists(pk)" : "version = :version AND tenantId = :tenantId",
          ExpressionAttributeValues:
            expectedVersion === null
              ? undefined
              : { ":version": expectedVersion, ":tenantId": card.tenantId },
        }),
      );
      return "ok";
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") return "conflict";
      throw error;
    }
  }

  async listCards(tenantId: string): Promise<NFCCard[]> {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :pk AND begins_with(gsi1sk, :prefix)",
        ExpressionAttributeValues: { ":pk": `TENANT#${tenantId}`, ":prefix": "NFC#" },
      }),
    );
    return (res.Items ?? []) as NFCCard[];
  }

  async putEvent(event: BusinessCardEvent): Promise<void> {
    await this.doc.send(new PutCommand({ TableName: this.tableName, Item: event }));
  }

  async putAudit(entry: BusinessCardAuditLog): Promise<void> {
    await this.doc.send(new PutCommand({ TableName: this.tableName, Item: entry }));
  }

  async listAudit(tenantId: string, profileId?: string): Promise<BusinessCardAuditLog[]> {
    if (profileId) {
      const owned = await this.getProfile(profileId);
      if (!owned || owned.tenantId !== tenantId) return [];
      const res = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "gsi1",
          KeyConditionExpression: "gsi1pk = :pk AND begins_with(gsi1sk, :prefix)",
          ExpressionAttributeValues: { ":pk": `AUDITPROFILE#${profileId}`, ":prefix": "AUDIT#" },
        }),
      );
      return ((res.Items ?? []) as BusinessCardAuditLog[]).filter((entry) => entry.tenantId === tenantId);
    }
    const month = new Date().toISOString().slice(0, 7);
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":pk": `AUDIT#${tenantId}#${month}`, ":prefix": "AUDIT#" },
      }),
    );
    return (res.Items ?? []) as BusinessCardAuditLog[];
  }
}
