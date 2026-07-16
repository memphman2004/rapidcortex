import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { LinkedRingDevice } from "./ring-types.js";
import { RingApiClient } from "./ring-client.js";
import { RING_TABLE_NAMES } from "./ring-table-names.js";
import { docSend } from "./ring-doc-send.js";

const EARTH_RADIUS_M = 6_371_000;

function agencyUserKey(agencyId: string, userId: string): string {
  return `${agencyId}#${userId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

type DeviceRow = LinkedRingDevice & {
  agencyUserKey: string;
};

function toRow(device: LinkedRingDevice): DeviceRow {
  return {
    ...device,
    agencyUserKey: agencyUserKey(device.agencyId, device.userId),
  };
}

function fromRow(row: DeviceRow): LinkedRingDevice {
  const { agencyUserKey: _key, ...device } = row;
  return device;
}

export class RingDeviceService {
  private readonly ddb: DynamoDBDocumentClient;

  constructor(ddb?: DynamoDBDocumentClient) {
    const client = ddb ?? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.ddb = client;
  }

  async discoverAndSaveDevices(
    agencyId: string,
    userId: string,
    ringAccountId: string,
    accessToken: string,
    options?: {
      /** Force Connect eligibility (Appstore homeowner claim). */
      enableForConnect?: boolean;
      /** Used when Ring omits GPS (required for available-cameras radius). */
      fallbackLatitude?: number | null;
      fallbackLongitude?: number | null;
    },
  ): Promise<LinkedRingDevice[]> {
    const client = new RingApiClient(accessToken);
    const discovered = await client.getDevices();
    const ts = nowIso();
    const saved: LinkedRingDevice[] = [];
    const enableForConnect = options?.enableForConnect === true;
    const fallbackLat = options?.fallbackLatitude ?? null;
    const fallbackLng = options?.fallbackLongitude ?? null;

    for (const raw of discovered) {
      const existing = await this.getDeviceRecord(agencyId, userId, raw.deviceId);
      const latitude =
        raw.latitude ?? existing?.latitude ?? (typeof fallbackLat === "number" ? fallbackLat : null);
      const longitude =
        raw.longitude ??
        existing?.longitude ??
        (typeof fallbackLng === "number" ? fallbackLng : null);
      const device: LinkedRingDevice = {
        agencyId,
        userId,
        ringAccountId,
        deviceId: raw.deviceId,
        deviceName: raw.deviceName,
        deviceType: raw.deviceType,
        locationLabel: raw.locationLabel,
        latitude,
        longitude,
        isEnabledForConnect: enableForConnect
          ? true
          : (existing?.isEnabledForConnect ?? false),
        createdAt: existing?.createdAt ?? ts,
        updatedAt: ts,
      };
      await docSend(this.ddb, 
        new PutCommand({
          TableName: RING_TABLE_NAMES.DEVICES,
          Item: toRow(device),
        }),
      );
      saved.push(device);
    }

    return saved;
  }

  async setDeviceCoordinates(
    agencyId: string,
    userId: string,
    deviceId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const ts = nowIso();
    await docSend(this.ddb, 
      new UpdateCommand({
        TableName: RING_TABLE_NAMES.DEVICES,
        Key: {
          agencyUserKey: agencyUserKey(agencyId, userId),
          deviceId,
        },
        UpdateExpression: "SET latitude = :lat, longitude = :lng, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":lat": latitude,
          ":lng": longitude,
          ":updatedAt": ts,
          ":agencyId": agencyId,
        },
        ConditionExpression: "agencyId = :agencyId",
      }),
    );
  }

  async getLinkedDevices(agencyId: string, userId: string): Promise<LinkedRingDevice[]> {
    const out = await docSend<{ Items?: DeviceRow[] }>(
      this.ddb,
      new QueryCommand({
        TableName: RING_TABLE_NAMES.DEVICES,
        KeyConditionExpression: "agencyUserKey = :key",
        ExpressionAttributeValues: {
          ":key": agencyUserKey(agencyId, userId),
        },
      }),
    );
    return (out.Items ?? []).map((item) => fromRow(item));
  }

  async getDeviceByAgencyAndDeviceId(
    agencyId: string,
    deviceId: string,
  ): Promise<LinkedRingDevice | null> {
    const out = await docSend<{ Items?: DeviceRow[] }>(
      this.ddb,
      new QueryCommand({
        TableName: RING_TABLE_NAMES.DEVICES,
        IndexName: "agencyId-index",
        KeyConditionExpression: "agencyId = :agencyId AND deviceId = :deviceId",
        ExpressionAttributeValues: {
          ":agencyId": agencyId,
          ":deviceId": deviceId,
        },
        Limit: 1,
      }),
    );
    const item = out.Items?.[0];
    if (!item) return null;
    return fromRow(item);
  }

  async getDevicesNearIncident(
    agencyId: string,
    incidentLatitude: number,
    incidentLongitude: number,
    radiusMeters: number,
  ): Promise<(LinkedRingDevice & { distanceMeters: number })[]> {
    const out = await docSend<{ Items?: DeviceRow[] }>(
      this.ddb,
      new QueryCommand({
        TableName: RING_TABLE_NAMES.DEVICES,
        IndexName: "agencyId-index",
        KeyConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: {
          ":agencyId": agencyId,
        },
      }),
    );

    const matches: (LinkedRingDevice & { distanceMeters: number })[] = [];
    for (const item of out.Items ?? []) {
      const device = fromRow(item);
      if (!device.isEnabledForConnect) continue;
      if (device.latitude === null || device.longitude === null) continue;
      const distanceMeters = this.calculateDistanceMeters(
        incidentLatitude,
        incidentLongitude,
        device.latitude,
        device.longitude,
      );
      if (distanceMeters <= radiusMeters) {
        matches.push({ ...device, distanceMeters });
      }
    }

    matches.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return matches;
  }

  async setDeviceConnectEnabled(
    agencyId: string,
    userId: string,
    deviceId: string,
    enabled: boolean,
  ): Promise<void> {
    const ts = nowIso();
    await docSend(this.ddb, 
      new UpdateCommand({
        TableName: RING_TABLE_NAMES.DEVICES,
        Key: {
          agencyUserKey: agencyUserKey(agencyId, userId),
          deviceId,
        },
        UpdateExpression: "SET isEnabledForConnect = :enabled, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":enabled": enabled,
          ":updatedAt": ts,
          ":agencyId": agencyId,
        },
        ConditionExpression: "agencyId = :agencyId",
      }),
    );
  }

  /** Soft-remove a device after Ring `device_removed` (disable Connect; keep row for audit). */
  async disableDeviceForConnectByAgency(
    agencyId: string,
    deviceId: string,
  ): Promise<LinkedRingDevice | null> {
    const device = await this.getDeviceByAgencyAndDeviceId(agencyId, deviceId);
    if (!device) return null;
    await this.setDeviceConnectEnabled(agencyId, device.userId, deviceId, false);
    return { ...device, isEnabledForConnect: false, updatedAt: nowIso() };
  }

  /** Soft-remove all devices for a Ring account under an agency (`app_integration_removed`). */
  async disableDevicesForRingAccount(
    agencyId: string,
    ringAccountId: string,
  ): Promise<LinkedRingDevice[]> {
    const out = await docSend<{ Items?: DeviceRow[] }>(
      this.ddb,
      new QueryCommand({
        TableName: RING_TABLE_NAMES.DEVICES,
        IndexName: "agencyId-index",
        KeyConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: {
          ":agencyId": agencyId,
        },
      }),
    );
    const matched: LinkedRingDevice[] = [];
    for (const item of out.Items ?? []) {
      const device = fromRow(item);
      if (device.ringAccountId !== ringAccountId) continue;
      if (!device.isEnabledForConnect) {
        matched.push(device);
        continue;
      }
      await this.setDeviceConnectEnabled(agencyId, device.userId, device.deviceId, false);
      matched.push({ ...device, isEnabledForConnect: false, updatedAt: nowIso() });
    }
    return matched;
  }

  private async getDeviceRecord(
    agencyId: string,
    userId: string,
    deviceId: string,
  ): Promise<LinkedRingDevice | null> {
    const out = await docSend<{ Item?: DeviceRow }>(
      this.ddb,
      new GetCommand({
        TableName: RING_TABLE_NAMES.DEVICES,
        Key: {
          agencyUserKey: agencyUserKey(agencyId, userId),
          deviceId,
        },
      }),
    );
    if (!out.Item) return null;
    return fromRow(out.Item);
  }

  private calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const sΔφ = Math.sin(Δφ / 2);
    const sΔλ = Math.sin(Δλ / 2);
    const a = sΔφ * sΔφ + Math.cos(φ1) * Math.cos(φ2) * sΔλ * sΔλ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_M * c;
  }
}
