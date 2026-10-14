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
  CampusAlertBroadcastClassification,
  CampusAlertsBillingMode,
  CampusAlertSubscriptionStatus,
} from "rapid-cortex-shared";
import { CAMPUS_ALERTS_KEYS } from "./campus-alerts-keys.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export type CampusAlertSubscriptionItem = {
  pk: string;
  sk: string;
  entityType: "CASUB";
  subscriptionId: string;
  agencyId: string;
  siteCodes?: string[];
  phoneE164Encrypted: string;
  phoneLookupDigest: string;
  maskedPhone: string;
  status: CampusAlertSubscriptionStatus;
  registrationCreatedAt: string;
  lastVerifiedAt?: string;
  lastRenewedAt?: string;
  renewalDueAt?: string;
  subscriptionExpiresAt?: string;
  consentGrantedAt?: string;
  consentVersion?: string;
  consentSource?: string;
  sourceSafetyPointId?: string;
  optedOutAt?: string;
  suppressionReason?: string;
  createdAt: string;
  updatedAt: string;
  ttl?: number;
};

export type CampusAlertPhoneIndexItem = {
  pk: string;
  sk: string;
  entityType: "CASUB_PHONE";
  agencyId: string;
  subscriptionId: string;
  phoneLookupDigest: string;
  status: CampusAlertSubscriptionStatus;
  updatedAt: string;
};

export type CampusAlertPreviewItem = {
  pk: string;
  sk: string;
  entityType: "CASUB_PREVIEW";
  previewId: string;
  agencyId: string;
  classification: CampusAlertBroadcastClassification;
  messageBody: string;
  affectedAreasLabel: string;
  recipientCount: number;
  estimatedSegments: number;
  segmentsPerMessage: number;
  encoding: "gsm7" | "ucs2";
  estimatedRatePerSegmentUsd: number;
  estimatedTotalCostUsd: number;
  initiatedBy: string;
  createdAt: string;
  expiresAt: string;
  ttl: number;
};

export type CampusAlertCampaignItem = {
  pk: string;
  sk: string;
  entityType: "CASUB_CAMPAIGN";
  campaignId: string;
  agencyId: string;
  emergencyClassification: CampusAlertBroadcastClassification;
  initiatedBy: string;
  approvedBy?: string;
  recipientCount: number;
  estimatedSegments: number;
  submittedSegments: number;
  estimatedCostUsd: number;
  reconciledCostUsd?: number;
  billingPeriod: string;
  contractualBillingMode: CampusAlertsBillingMode;
  status: "queued" | "submitted" | "partial" | "failed" | "canceled";
  messageBody: string;
  previewId: string;
  providerMessageIds?: string[];
  createdAt: string;
  confirmedAt?: string;
  ttl?: number;
};

export type CampusAlertChallengeItem = {
  pk: string;
  sk: string;
  entityType: "CASUB_CHALLENGE";
  challengeId: string;
  agencyId: string;
  universityName: string;
  qrId: string;
  medium: string;
  phoneE164Encrypted: string;
  phoneLookupDigest: string;
  maskedPhone: string;
  otpHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: string;
  verifiedAt?: string;
  consumedAt?: string;
  smsConsentAt: string;
  consentVersion: string;
  resendAvailableAt: string;
  createdAt: string;
  ttl: number;
};

function tableName(): string {
  const t = process.env.CAMPUS_INCIDENTS_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_INCIDENTS_TABLE not set");
  return t;
}

export class CampusAlertsRepository {
  async putChallenge(item: CampusAlertChallengeItem): Promise<void> {
    await ddb.send(new PutCommand({ TableName: tableName(), Item: item }));
  }

  async getChallenge(challengeId: string): Promise<CampusAlertChallengeItem | null> {
    const r = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: {
          pk: CAMPUS_ALERTS_KEYS.challengePk(challengeId),
          sk: CAMPUS_ALERTS_KEYS.challengeSk(),
        },
      }),
    );
    return (r.Item as CampusAlertChallengeItem | undefined) ?? null;
  }

  async updateChallenge(
    challengeId: string,
    updates: Partial<CampusAlertChallengeItem>,
  ): Promise<CampusAlertChallengeItem> {
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const sets: string[] = [];
    let i = 0;
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || k === "pk" || k === "sk") continue;
      const nk = `#k${i}`;
      const nv = `:v${i}`;
      names[nk] = k;
      values[nv] = v;
      sets.push(`${nk} = ${nv}`);
      i += 1;
    }
    const r = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: {
          pk: CAMPUS_ALERTS_KEYS.challengePk(challengeId),
          sk: CAMPUS_ALERTS_KEYS.challengeSk(),
        },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(pk)",
        ReturnValues: "ALL_NEW",
      }),
    );
    return r.Attributes as CampusAlertChallengeItem;
  }

  async getByPhoneDigest(
    agencyId: string,
    phoneLookupDigest: string,
  ): Promise<CampusAlertPhoneIndexItem | null> {
    const r = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: {
          pk: CAMPUS_ALERTS_KEYS.agencyPk(agencyId),
          sk: CAMPUS_ALERTS_KEYS.phoneIndexSk(phoneLookupDigest),
        },
      }),
    );
    return (r.Item as CampusAlertPhoneIndexItem | undefined) ?? null;
  }

  async getSubscription(
    agencyId: string,
    subscriptionId: string,
  ): Promise<CampusAlertSubscriptionItem | null> {
    const r = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: {
          pk: CAMPUS_ALERTS_KEYS.agencyPk(agencyId),
          sk: CAMPUS_ALERTS_KEYS.subscriptionSk(subscriptionId),
        },
      }),
    );
    return (r.Item as CampusAlertSubscriptionItem | undefined) ?? null;
  }

  async listSubscriptions(agencyId: string, limit = 200): Promise<CampusAlertSubscriptionItem[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": CAMPUS_ALERTS_KEYS.agencyPk(agencyId),
          ":sk": "CASUB#",
        },
        Limit: Math.min(limit, 500),
      }),
    );
    return ((r.Items as CampusAlertSubscriptionItem[]) ?? []).filter(
      (i) => i.entityType === "CASUB",
    );
  }

  /** Conditional create — fails if phone index already exists. */
  async createSubscriptionAtomic(
    subscription: CampusAlertSubscriptionItem,
    phoneIndex: CampusAlertPhoneIndexItem,
  ): Promise<"created" | "duplicate"> {
    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: tableName(),
                Item: phoneIndex,
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Put: {
                TableName: tableName(),
                Item: subscription,
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
          ],
        }),
      );
      return "created";
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "TransactionCanceledException" || name === "ConditionalCheckFailedException") {
        return "duplicate";
      }
      throw e;
    }
  }

  async updateSubscription(
    agencyId: string,
    subscriptionId: string,
    updates: Partial<CampusAlertSubscriptionItem>,
  ): Promise<CampusAlertSubscriptionItem> {
    const names: Record<string, string> = { "#updatedAt": "updatedAt" };
    const values: Record<string, unknown> = { ":updatedAt": new Date().toISOString() };
    const sets: string[] = ["#updatedAt = :updatedAt"];
    let i = 0;
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || k === "pk" || k === "sk" || k === "updatedAt") continue;
      const nk = `#k${i}`;
      const nv = `:v${i}`;
      names[nk] = k;
      values[nv] = v;
      sets.push(`${nk} = ${nv}`);
      i += 1;
    }
    const r = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: {
          pk: CAMPUS_ALERTS_KEYS.agencyPk(agencyId),
          sk: CAMPUS_ALERTS_KEYS.subscriptionSk(subscriptionId),
        },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(pk)",
        ReturnValues: "ALL_NEW",
      }),
    );
    return r.Attributes as CampusAlertSubscriptionItem;
  }

  async putPhoneIndex(item: CampusAlertPhoneIndexItem): Promise<void> {
    await ddb.send(new PutCommand({ TableName: tableName(), Item: item }));
  }

  async putPreview(item: CampusAlertPreviewItem): Promise<void> {
    await ddb.send(new PutCommand({ TableName: tableName(), Item: item }));
  }

  async getPreview(agencyId: string, previewId: string): Promise<CampusAlertPreviewItem | null> {
    const r = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: {
          pk: CAMPUS_ALERTS_KEYS.agencyPk(agencyId),
          sk: CAMPUS_ALERTS_KEYS.previewSk(previewId),
        },
      }),
    );
    return (r.Item as CampusAlertPreviewItem | undefined) ?? null;
  }

  async putCampaign(item: CampusAlertCampaignItem): Promise<boolean> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: tableName(),
          Item: item,
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
      return true;
    } catch (e) {
      if ((e as { name?: string }).name === "ConditionalCheckFailedException") return false;
      throw e;
    }
  }

  /** Unconditional overwrite for campaign status reconciliation (same campaignId). */
  async saveCampaign(item: CampusAlertCampaignItem): Promise<void> {
    await ddb.send(new PutCommand({ TableName: tableName(), Item: item }));
  }

  async listCampaigns(agencyId: string, limit = 50): Promise<CampusAlertCampaignItem[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": CAMPUS_ALERTS_KEYS.agencyPk(agencyId),
          ":sk": "CASUB_CAMPAIGN#",
        },
        ScanIndexForward: false,
        Limit: Math.min(limit, 100),
      }),
    );
    return ((r.Items as CampusAlertCampaignItem[]) ?? []).filter(
      (i) => i.entityType === "CASUB_CAMPAIGN",
    );
  }

  async putDeliveryOnce(item: {
    pk: string;
    sk: string;
    entityType: "CASUB_DELIVERY";
    agencyId: string;
    broadcastId: string;
    subscriptionId: string;
    channel: string;
    status: string;
    createdAt: string;
    ttl: number;
  }): Promise<boolean> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: tableName(),
          Item: item,
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
      return true;
    } catch (e) {
      if ((e as { name?: string }).name === "ConditionalCheckFailedException") return false;
      throw e;
    }
  }
}
