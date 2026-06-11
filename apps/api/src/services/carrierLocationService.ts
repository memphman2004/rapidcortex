import type { LocationCoordinates } from "rapid-cortex-shared";
import { env } from "../lib/env.js";

export type CarrierLocationResult = {
  coordinates: LocationCoordinates;
  accuracyMeters: number;
} | null;

/**
 * Best-effort carrier / network location from inbound SMS metadata.
 * Twilio may attach Latitude/Longitude on some carrier routes; AWS inbound SNS may include geo attributes.
 * Falls back to mock coordinates in dev when CARRIER_LOCATION_MOCK=true.
 */
export async function requestCarrierLocation(params: {
  callerPhone: string;
  inboundParams: Record<string, string>;
}): Promise<CarrierLocationResult> {
  if (env.carrierLocationMock) {
    return mockCarrierEstimate(params.callerPhone);
  }

  const lat =
    params.inboundParams.Latitude ??
    params.inboundParams.latitude ??
    params.inboundParams.FromLat ??
    "";
  const lng =
    params.inboundParams.Longitude ??
    params.inboundParams.longitude ??
    params.inboundParams.FromLng ??
    "";
  const accuracyRaw =
    params.inboundParams.Accuracy ?? params.inboundParams.accuracy ?? params.inboundParams.FromAccuracy ?? "";

  const latitude = Number.parseFloat(lat);
  const longitude = Number.parseFloat(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const accuracy = Number.parseFloat(accuracyRaw);
  return {
    coordinates: {
      latitude,
      longitude,
      accuracy: Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 150,
    },
    accuracyMeters: Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 150,
  };
}

function mockCarrierEstimate(phone: string): CarrierLocationResult {
  const seed = phone.replace(/\D/g, "").slice(-4);
  const n = Number.parseInt(seed || "1000", 10);
  const latitude = 33.948 + (n % 100) * 0.0001;
  const longitude = -83.377 - (n % 97) * 0.0001;
  return {
    coordinates: { latitude, longitude, accuracy: 150 },
    accuracyMeters: 150,
  };
}
