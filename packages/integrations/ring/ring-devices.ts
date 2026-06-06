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
  ): Promise<LinkedRingDevice[]> {
    const client = new RingApiClient(accessToken);
    const discovered = await client.getDevices();
    const ts = nowIso();
    const saved: LinkedRingDevice[] = [];

    for (const raw of discovered) {
      const existing = await this.getDeviceRecord(agencyId, userId, raw.deviceId);
      const device: LinkedRingDevice = {
        agencyId,
        userId,
        ringAccountId,
        deviceId: raw.deviceId,
        deviceName: raw.deviceName,
        deviceType: raw.deviceType,
        locationLabel: raw.locationLabel,
        latitude: raw.latitude,
        longitude: raw.longitude,
        isEnabledForConnect: existing?.isEnabledForConnect ?? false,
        createdAt: existing?.createdAt ?? ts,
        updatedAt: ts,
      };
      await this.ddb.send(
        new PutCommand({
          TableName: RING_TABLE_NAMES.DEVICES,
          Item: toRow(device),
        }),
      );
      saved.push(device);
    }

    return saved;
  }

  async getLinkedDevices(agencyId: string, userId: string): Promise<LinkedRingDevice[]> {
    const out = await this.ddb.send(
      new QueryCommand({
        TableName: RING_TABLE_NAMES.DEVICES,
        KeyConditionExpression: "agencyUserKey = :key",
        ExpressionAttributeValues: {
          ":key": agencyUserKey(agencyId, userId),
        },
      }),
    );
    return (out.Items ?? []).map((item) => fromRow(item as DeviceRow));
  }

  async getDeviceByAgencyAndDeviceId(
    agencyId: string,
    deviceId: string,
  ): Promise<LinkedRingDevice | null> {
    const out = await this.ddb.send(
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
    return fromRow(item as DeviceRow);
  }

  async getDevicesNearIncident(
    agencyId: string,
    incidentLatitude: number,
    incidentLongitude: number,
    radiusMeters: number,
  ): Promise<(LinkedRingDevice & { distanceMeters: number })[]> {
    const out = await this.ddb.send(
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
      const device = fromRow(item as DeviceRow);
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
    await this.ddb.send(
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

  private async getDeviceRecord(
    agencyId: string,
    userId: string,
    deviceId: string,
  ): Promise<LinkedRingDevice | null> {
    const out = await this.ddb.send(
      new GetCommand({
        TableName: RING_TABLE_NAMES.DEVICES,
        Key: {
          agencyUserKey: agencyUserKey(agencyId, userId),
          deviceId,
        },
      }),
    );
    if (!out.Item) return null;
    return fromRow(out.Item as DeviceRow);
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
