import type { TransitCameraPlace } from "../transit/place-cameras.js";

/** Map a QR/NFC location record onto transit camera ranking fields. */
export function transitPlaceFromQrRecord(record: {
  vehicleId?: string | null;
  stationId?: string | null;
  routeId?: string | null;
  buildingId?: string | null;
  zoneId?: string | null;
  qrId?: string | null;
}): TransitCameraPlace {
  const vehicleId = trimToUndef(record.vehicleId);
  const stationId = trimToUndef(record.stationId);
  const routeId = trimToUndef(record.routeId);
  if (vehicleId || stationId || routeId) {
    return { vehicleId, stationId, routeId, qrRcli: trimToUndef(record.qrId) };
  }
  return {
    vehicleId: trimToUndef(record.buildingId),
    stationId: trimToUndef(record.zoneId),
    qrRcli: trimToUndef(record.qrId),
  };
}

function trimToUndef(value: string | null | undefined): string | undefined {
  const trimmed = (value ?? "").trim();
  return trimmed || undefined;
}
