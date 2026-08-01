/**
 * Nest camera provider service — tokens, agency SDM devices, citizen registry, consent requests.
 */
import { randomBytes, randomUUID } from "node:crypto";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../repositories/baseRepository.js";
import { getNestClientSecret, RCError, type NestTokenRecord } from "./nest-oauth.js";
import { nestSdmClient, type NestDevice } from "./nest-sdm.js";
import { sendSilentTextSms } from "../../lib/silentTextSms.js";

export type NestConsentStatus =
  | "AVAILABLE"
  | "DRAFT"
  | "SENT"
  | "APPROVED"
  | "DECLINED"
  | "EXPIRED"
  | "REVOKED";

export type NestCitizenCamera = {
  deviceId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  ownerPhone?: string;
  distanceMeters: number;
  ownerStatus: NestConsentStatus;
  requestId?: string;
};

export type NestAgencyCamera = {
  deviceId: string;
  displayName: string;
  type: string;
  status: NestDevice["status"];
  traits: Record<string, unknown>;
};

function tokensTable(): string {
  const n = process.env.DYNAMODB_TABLE_TOKENS?.trim();
  if (!n) throw new RCError("DYNAMODB_TABLE_TOKENS not configured", 500);
  return n;
}

function camerasTable(): string {
  const n = process.env.CAMERAS_TABLE?.trim();
  if (!n) throw new RCError("CAMERAS_TABLE not configured", 500);
  return n;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function loadNestToken(agencyId: string): Promise<NestTokenRecord | null> {
  const out = await ddb.send(
    new GetCommand({
      TableName: tokensTable(),
      Key: { pk: `${agencyId}#nest` },
    }),
  );
  return (out.Item as NestTokenRecord | undefined) ?? null;
}

async function persistAccessToken(
  agencyId: string,
  accessToken: string,
  expiresAt: number,
  refreshToken?: string,
): Promise<void> {
  const names: Record<string, string> = {
    "#accessToken": "accessToken",
    "#expiresAt": "expiresAt",
    "#updatedAt": "updatedAt",
  };
  const values: Record<string, unknown> = {
    ":accessToken": accessToken,
    ":expiresAt": expiresAt,
    ":updatedAt": new Date().toISOString(),
  };
  let update = "SET #accessToken = :accessToken, #expiresAt = :expiresAt, #updatedAt = :updatedAt";
  if (refreshToken) {
    names["#refreshToken"] = "refreshToken";
    values[":refreshToken"] = refreshToken;
    update += ", #refreshToken = :refreshToken";
  }
  await ddb.send(
    new UpdateCommand({
      TableName: tokensTable(),
      Key: { pk: `${agencyId}#nest` },
      UpdateExpression: update,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

/** Ensure a valid access token; refresh + persist when expired (60s skew). */
export async function getValidNestAccess(agencyId: string): Promise<{
  token: NestTokenRecord;
  accessToken: string;
}> {
  const token = await loadNestToken(agencyId);
  if (!token?.accessToken || !token.projectId || !token.clientId) {
    throw new RCError("Nest account is not connected for this agency", 404);
  }
  const skewMs = 60_000;
  if (token.expiresAt > Date.now() + skewMs) {
    return { token, accessToken: token.accessToken };
  }
  if (!token.refreshToken) {
    throw new RCError("Nest access token expired and no refresh token is available", 401);
  }
  const clientSecret = await getNestClientSecret();
  const refreshed = await nestSdmClient.refreshAccessToken(
    token.refreshToken,
    token.clientId,
    clientSecret,
  );
  const expiresAt = Date.now() + refreshed.expiresIn * 1000;
  await persistAccessToken(agencyId, refreshed.accessToken, expiresAt, refreshed.refreshToken);
  return {
    token: { ...token, accessToken: refreshed.accessToken, expiresAt },
    accessToken: refreshed.accessToken,
  };
}

export async function listAgencyNestCameras(agencyId: string): Promise<NestAgencyCamera[]> {
  const { token, accessToken } = await getValidNestAccess(agencyId);
  const devices = await nestSdmClient.listDevices(token.projectId, accessToken);
  return devices
    .filter((d) => d.hasLiveStream)
    .map((d) => ({
      deviceId: d.deviceId,
      displayName: d.displayName,
      type: d.type,
      status: d.status,
      traits: d.traits,
    }));
}

type NestRequestRecord = {
  pk: string;
  itemType: "nest_request";
  requestId: string;
  agencyId: string;
  incidentId: string;
  deviceId: string;
  deviceName: string;
  requestStatus: NestConsentStatus;
  requestedDurationMinutes: number;
  ownerPhone?: string;
  createdAt: string;
  expiresAt: string;
  plainToken?: string;
};

function requestPk(agencyId: string, incidentId: string, deviceId: string): string {
  return `NESTREQ#${agencyId}#${incidentId}#${deviceId}`;
}

export async function putNestRequest(record: NestRequestRecord): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: tokensTable(),
      Item: record,
    }),
  );
}

export async function loadNestRequest(
  agencyId: string,
  incidentId: string,
  deviceId: string,
): Promise<NestRequestRecord | null> {
  const out = await ddb.send(
    new GetCommand({
      TableName: tokensTable(),
      Key: { pk: requestPk(agencyId, incidentId, deviceId) },
    }),
  );
  return (out.Item as NestRequestRecord | undefined) ?? null;
}

export async function listNestRequestsForIncident(
  agencyId: string,
  incidentId: string,
): Promise<NestRequestRecord[]> {
  // Tokens table is pk-only; scan with agency filter is avoided — query citizen cams then Get each request.
  // Lightweight approach: Query is unavailable without GSI; use begins_with via Scan limited by agency in FilterExpression.
  const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
  const prefix = `NESTREQ#${agencyId}#${incidentId}#`;
  const out = await ddb.send(
    new ScanCommand({
      TableName: tokensTable(),
      FilterExpression: "begins_with(pk, :prefix)",
      ExpressionAttributeValues: { ":prefix": prefix },
    }),
  );
  return (out.Items as NestRequestRecord[] | undefined) ?? [];
}

export async function listCitizenNestNearIncident(
  agencyId: string,
  latitude: number,
  longitude: number,
  radiusMeters: number,
  incidentId: string,
): Promise<NestCitizenCamera[]> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: camerasTable(),
      KeyConditionExpression: "agencyId = :agencyId",
      ExpressionAttributeValues: { ":agencyId": agencyId },
    }),
  );
  const items = (out.Items ?? []) as Array<{
    cameraId?: string;
    displayName?: string;
    provider?: string;
    ownership?: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    ownerPhone?: string;
    active?: boolean;
    status?: string;
  }>;

  const requests = await listNestRequestsForIncident(agencyId, incidentId);
  const latestByDevice = new Map<string, NestRequestRecord>();
  for (const r of requests) {
    const prev = latestByDevice.get(r.deviceId);
    if (!prev || r.createdAt > prev.createdAt) latestByDevice.set(r.deviceId, r);
  }

  const cameras: NestCitizenCamera[] = [];
  for (const item of items) {
    if (item.provider !== "nest" || item.ownership !== "citizen") continue;
    if (item.active === false || item.status === "inactive") continue;
    const lat = Number(item.latitude ?? item.lat);
    const lng = Number(item.longitude ?? item.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const distanceMeters = haversineMeters(latitude, longitude, lat, lng);
    if (distanceMeters > radiusMeters) continue;
    const deviceId = item.cameraId ?? "";
    if (!deviceId) continue;
    const latest = latestByDevice.get(deviceId);
    cameras.push({
      deviceId,
      displayName: item.displayName ?? deviceId,
      latitude: lat,
      longitude: lng,
      ownerPhone: item.ownerPhone,
      distanceMeters: Math.floor(distanceMeters / 10) * 10,
      ownerStatus: (latest?.requestStatus as NestConsentStatus | undefined) ?? "AVAILABLE",
      requestId: latest?.requestId,
    });
  }
  cameras.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return cameras;
}

export async function createNestConsentRequest(params: {
  agencyId: string;
  incidentId: string;
  deviceId: string;
  requestedDurationMinutes: number;
  agencyName: string;
}): Promise<{ requestId: string; status: "SENT" | "DRAFT" }> {
  const cams = await ddb.send(
    new GetCommand({
      TableName: camerasTable(),
      Key: { agencyId: params.agencyId, cameraId: params.deviceId },
    }),
  );
  const cam = cams.Item as
    | {
        displayName?: string;
        ownerPhone?: string;
        provider?: string;
        ownership?: string;
      }
    | undefined;
  if (!cam || cam.provider !== "nest" || cam.ownership !== "citizen") {
    throw new RCError("Nest citizen camera not found", 404);
  }

  const existing = await loadNestRequest(params.agencyId, params.incidentId, params.deviceId);
  if (existing && (existing.requestStatus === "SENT" || existing.requestStatus === "APPROVED")) {
    throw new RCError("An active request already exists for this camera", 409);
  }

  const requestId = randomUUID();
  // 128 bits in 22 characters — hex would add 26 characters to a length-critical consent SMS.
  const plainToken = randomBytes(16).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + (params.requestedDurationMinutes + 30) * 60 * 1000,
  ).toISOString();

  const record: NestRequestRecord = {
    pk: requestPk(params.agencyId, params.incidentId, params.deviceId),
    itemType: "nest_request",
    requestId,
    agencyId: params.agencyId,
    incidentId: params.incidentId,
    deviceId: params.deviceId,
    deviceName: cam.displayName ?? params.deviceId,
    requestStatus: "DRAFT",
    requestedDurationMinutes: params.requestedDurationMinutes,
    ownerPhone: cam.ownerPhone,
    createdAt: now.toISOString(),
    expiresAt,
    plainToken,
  };
  await putNestRequest(record);

  const phone = cam.ownerPhone?.trim();
  if (!phone) {
    return { requestId, status: "DRAFT" };
  }

  const base =
    process.env.NEST_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    process.env.RING_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    "https://api.rapidcortex.us";
  // One short link, ASCII only: multi-segment texts carrying several long links are dropped by
  // US carriers after Twilio has already accepted them.
  const consentUrl = `${base}/api/cameras/providers/nest/c/${plainToken}`;

  const body = [
    `Rapid Cortex: ${params.agencyName} requests ${params.requestedDurationMinutes}-min live camera view for an active emergency near you.`,
    `Approve or decline: ${consentUrl}`,
    "Reply STOP to opt out.",
  ].join("\n");
  try {
    const sms = await sendSilentTextSms({
      phoneE164: phone,
      message: body,
      agencyId: params.agencyId,
      incidentId: params.incidentId,
    });
    if (!sms.ok) {
      console.error("[nest/request] sms failed", sms.errorMessage ?? sms.errorCode);
      return { requestId, status: "DRAFT" };
    }
    await putNestRequest({ ...record, requestStatus: "SENT" });
    return { requestId, status: "SENT" };
  } catch (err) {
    console.error("[nest/request] sms failed", err);
    return { requestId, status: "DRAFT" };
  }
}

async function findNestRequestByToken(plainToken: string): Promise<NestRequestRecord | null> {
  const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
  const out = await ddb.send(
    new ScanCommand({
      TableName: tokensTable(),
      FilterExpression: "itemType = :t AND plainToken = :tok",
      ExpressionAttributeValues: { ":t": "nest_request", ":tok": plainToken },
    }),
  );
  return (out.Items?.[0] as NestRequestRecord | undefined) ?? null;
}

/** Read-only lookup for the consent landing page; does not consume the token. */
export async function peekNestConsentRequest(plainToken: string): Promise<{
  deviceName: string;
  requestedDurationMinutes: number;
  requestStatus: string;
  expiresAt: string;
} | null> {
  const row = await findNestRequestByToken(plainToken);
  if (!row) return null;
  return {
    deviceName: row.deviceName ?? "camera",
    requestedDurationMinutes: row.requestedDurationMinutes,
    requestStatus: row.requestStatus,
    expiresAt: row.expiresAt,
  };
}

export async function resolveNestConsentToken(
  plainToken: string,
  decision: "APPROVED" | "DECLINED",
): Promise<{ agencyId: string; incidentId: string } | null> {
  const row = await findNestRequestByToken(plainToken);
  if (!row) return null;
  await putNestRequest({ ...row, requestStatus: decision, plainToken: undefined });
  return { agencyId: row.agencyId, incidentId: row.incidentId };
}

export async function deleteNestRequest(
  agencyId: string,
  incidentId: string,
  deviceId: string,
): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: tokensTable(),
      Key: { pk: requestPk(agencyId, incidentId, deviceId) },
    }),
  );
}
