import type { ConnectSource } from "../connect/connect-types.js";
import type { VenueCamera, VenueFacility } from "./venue-types.js";

/** Map a facility camera row to the Connect stream resolver shape (no plaintext RTSP in responses). */
export function venueCameraToConnectSource(
  camera: VenueCamera,
  facility: VenueFacility,
): ConnectSource {
  const status =
    camera.status === "DISABLED"
      ? "SUSPENDED"
      : camera.status === "OFFLINE"
        ? "OFFLINE"
        : camera.status === "DEGRADED"
          ? "DEGRADED"
          : "ACTIVE";

  return {
    pk: camera.pk,
    sk: "PROFILE",
    sourceId: camera.cameraId,
    agencyId: camera.agencyId,
    sourceType: "IP_CAMERA",
    protocol: camera.protocol,
    label: camera.label,
    address: facility.address,
    addressHash: facility.addressHash,
    lat: facility.lat,
    lng: facility.lng,
    rtspUrl: camera.rtspUrl,
    onvifHost: camera.onvifHost,
    credentialsSecretArn: camera.credentialsSecretArn,
    accessModel: camera.accessModel,
    approvalTimeoutSeconds: 300,
    timeoutFallback: "DENY",
    status,
    enrolledBy: camera.addedBy,
    createdAt: camera.createdAt,
    updatedAt: camera.updatedAt,
  };
}
