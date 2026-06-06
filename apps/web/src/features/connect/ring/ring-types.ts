import type { RingCameraListItem, RingRequestStatus } from "rapid-cortex-integrations/ring";
import type { RapidCortexRole } from "rapid-cortex-shared";

export type RingOwnerStatus = RingRequestStatus | "AVAILABLE";

export type RingDeviceListItem = {
  deviceId: string;
  deviceName: string;
  deviceType: "CAMERA" | "DOORBELL" | "UNKNOWN";
  locationLabel: string | null;
  isEnabledForConnect: boolean;
};

export type RingDevicesResponse = {
  success: boolean;
  data?: { devices: RingDeviceListItem[] };
  error?: string;
};

export type RingAvailableCamerasResponse = {
  success: boolean;
  data?: { incidentId: string; radiusMeters: number; cameras: RingCameraListItem[] };
  error?: string;
};

export type RingRole = RapidCortexRole | "command" | "admin" | "emergency_manager" | "rc_admin";
