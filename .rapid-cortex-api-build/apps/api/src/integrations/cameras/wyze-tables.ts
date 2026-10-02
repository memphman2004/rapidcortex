/**
 * Wyze DynamoDB access.
 *
 * Cameras live on the existing CamerasRegistryTable (PK agencyId / SK cameraId)
 * so proximity queries are tenant-scoped. Encrypted homeowner credentials and
 * consent rows use dedicated Wyze tables.
 *
 * @module integrations/cameras/wyze-tables
 */

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../../lib/env.js";

export const WYZE_CAMERA_ID_PREFIX = "wyze#";

export type WyzeRegistration = {
  ownerId: string;
  agencyId: string;
  email: string;
  phone: string;
  encryptedKeyId: string;
  encryptedApiKey: string;
  encryptionKeyArn: string;
  address: string;
  lat: number;
  lng: number;
  active: boolean;
  registeredAt: string;
  lastVerifiedAt?: string;
};

export type WyzeCameraRecord = {
  agencyId: string;
  cameraId: string;
  mac: string;
  ownerId: string;
  provider: "wyze";
  ownership: "citizen";
  displayName: string;
  model: string;
  latitude: number;
  longitude: number;
  address: string;
  ownerPhone: string;
  active: boolean;
  addedAt: string;
};

export type WyzeConsentRequest = {
  requestPk: string;
  requestId: string;
  tokenHash: string;
  ownerId: string;
  agencyId: string;
  incidentId: string;
  mac: string;
  deviceName: string;
  requestStatus: "SENT" | "APPROVED" | "DECLINED" | "EXPIRED" | "DRAFT" | "NO_PHONE";
  requestedDurationMinutes: 10 | 30 | 60 | 120;
  expiresAt: string;
  createdAt: string;
  resolvedAt?: string;
  ttl?: number;
};

export function wyzeCameraId(mac: string): string {
  return `${WYZE_CAMERA_ID_PREFIX}${mac.trim()}`;
}

export function wyzeConsentPk(agencyId: string, incidentId: string, mac: string): string {
  return `${agencyId}#${incidentId}#${mac}`;
}

function registrationsTable(): string {
  const n = env.wyzeRegistrationsTableName;
  if (!n) throw new Error("WYZE_REGISTRATIONS_TABLE not configured");
  return n;
}

function consentTable(): string {
  const n = env.wyzeConsentTableName;
  if (!n) throw new Error("WYZE_CONSENT_TABLE not configured");
  return n;
}

function camerasTable(): string {
  const n = process.env.CAMERAS_TABLE?.trim();
  if (!n) throw new Error("CAMERAS_TABLE not configured");
  return n;
}

export async function putRegistration(r: WyzeRegistration): Promise<void> {
  await ddb.send(new PutCommand({ TableName: registrationsTable(), Item: r }));
}

export async function getRegistration(ownerId: string): Promise<WyzeRegistration | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: registrationsTable(),
      Key: { ownerId },
    }),
  );
  return (res.Item as WyzeRegistration | undefined) ?? null;
}

export async function getRegistrationByPhone(
  phone: string,
  agencyId: string,
): Promise<WyzeRegistration | null> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: registrationsTable(),
      IndexName: "phone-agency-index",
      KeyConditionExpression: "phone = :ph AND agencyId = :ag",
      ExpressionAttributeValues: { ":ph": phone, ":ag": agencyId },
      Limit: 1,
    }),
  );
  return (res.Items?.[0] as WyzeRegistration | undefined) ?? null;
}

export async function putWyzeCamera(c: WyzeCameraRecord): Promise<void> {
  await ddb.send(new PutCommand({ TableName: camerasTable(), Item: c }));
}

export async function getWyzeCamera(
  agencyId: string,
  mac: string,
): Promise<WyzeCameraRecord | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: camerasTable(),
      Key: { agencyId, cameraId: wyzeCameraId(mac) },
    }),
  );
  const item = res.Item as WyzeCameraRecord | undefined;
  if (!item || item.provider !== "wyze" || item.agencyId !== agencyId) return null;
  return item;
}

export async function listWyzeCamerasForAgency(agencyId: string): Promise<WyzeCameraRecord[]> {
  const items: WyzeCameraRecord[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: camerasTable(),
        KeyConditionExpression: "agencyId = :agencyId AND begins_with(cameraId, :pfx)",
        ExpressionAttributeValues: {
          ":agencyId": agencyId,
          ":pfx": WYZE_CAMERA_ID_PREFIX,
        },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    items.push(...((res.Items ?? []) as WyzeCameraRecord[]));
    exclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);
  return items.filter(
    (c) => c.provider === "wyze" && c.ownership === "citizen" && c.active !== false,
  );
}

export async function putConsentRequest(r: WyzeConsentRequest): Promise<void> {
  await ddb.send(new PutCommand({ TableName: consentTable(), Item: r }));
}

export async function getConsentRequest(requestPk: string): Promise<WyzeConsentRequest | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: consentTable(),
      Key: { requestPk },
    }),
  );
  return (res.Item as WyzeConsentRequest | undefined) ?? null;
}

export async function getConsentByTokenHash(
  tokenHash: string,
): Promise<WyzeConsentRequest | null> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: consentTable(),
      IndexName: "token-hash-index",
      KeyConditionExpression: "tokenHash = :th",
      ExpressionAttributeValues: { ":th": tokenHash },
      Limit: 1,
    }),
  );
  return (res.Items?.[0] as WyzeConsentRequest | undefined) ?? null;
}

export async function updateConsentStatus(
  requestPk: string,
  status: WyzeConsentRequest["requestStatus"],
  resolvedAt: string,
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: consentTable(),
      Key: { requestPk },
      UpdateExpression: "SET requestStatus = :s, resolvedAt = :r",
      ExpressionAttributeValues: { ":s": status, ":r": resolvedAt },
    }),
  );
}
