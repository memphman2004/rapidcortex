import type { ReportVertical } from "rapid-cortex-shared";
import { bindCampusCamerasToQrRcli } from "../handlers/campus/cameras/campus-camera-registry-service.js";
import { bindVenueCamerasToQrRcli } from "../handlers/venue/venue-camera-registry-service.js";

export async function bindQrLocationCameras(opts: {
  agencyId: string;
  vertical: ReportVertical;
  qrId: string;
  nextCameraIds: string[];
  previousCameraIds?: string[];
}): Promise<void> {
  if (opts.vertical === "campus") {
    await bindCampusCamerasToQrRcli({
      agencyId: opts.agencyId,
      qrId: opts.qrId,
      nextCameraIds: opts.nextCameraIds,
      previousCameraIds: opts.previousCameraIds,
    });
    return;
  }
  if (opts.vertical === "venue") {
    await bindVenueCamerasToQrRcli({
      agencyId: opts.agencyId,
      qrId: opts.qrId,
      nextCameraIds: opts.nextCameraIds,
      previousCameraIds: opts.previousCameraIds,
    });
  }
}
