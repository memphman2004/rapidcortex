import {
  BatchUpdateDevicePositionCommand,
  ListDevicePositionsCommand,
} from "@aws-sdk/client-location";
import { alsAgencyPrefix, alsScopedId, type AlsDevicePosition } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { alsLocationMockEnabled, getLocationClient } from "./client.js";

export async function updateDevicePosition(
  agencyId: string,
  userId: string,
  longitude: number,
  latitude: number,
): Promise<{ deviceId: string; mocked: boolean }> {
  const deviceId = alsScopedId(agencyId, userId);
  if (alsLocationMockEnabled() || !env.alsTrackerName) {
    return { deviceId, mocked: true };
  }
  await getLocationClient().send(
    new BatchUpdateDevicePositionCommand({
      TrackerName: env.alsTrackerName,
      Updates: [
        {
          DeviceId: deviceId,
          Position: [longitude, latitude],
          SampleTime: new Date(),
        },
      ],
    }),
  );
  return { deviceId, mocked: false };
}

export async function getAgencyDevicePositions(agencyId: string): Promise<AlsDevicePosition[]> {
  const prefix = alsAgencyPrefix(agencyId);
  if (alsLocationMockEnabled() || !env.alsTrackerName) {
    return [];
  }
  const resp = await getLocationClient().send(
    new ListDevicePositionsCommand({
      TrackerName: env.alsTrackerName,
    }),
  );
  return (resp.Entries ?? [])
    .filter((e) => e.DeviceId?.startsWith(prefix))
    .map((e) => ({
      userId: (e.DeviceId ?? "").slice(prefix.length),
      latitude: e.Position?.[1] ?? 0,
      longitude: e.Position?.[0] ?? 0,
      lastUpdatedAt: e.SampleTime?.toISOString() ?? new Date().toISOString(),
    }));
}
