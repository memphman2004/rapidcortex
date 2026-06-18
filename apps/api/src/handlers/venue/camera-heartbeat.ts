import type { ScheduledHandler } from "aws-lambda";
import { runCampusCameraHeartbeat } from "../campus/cameras/campus-camera-registry-service.js";
import { runVenueCameraHeartbeat } from "./venue-camera-registry-service.js";

/** EventBridge schedule — verify KVS channel connectivity for venue + campus registry cameras. */
export const handler: ScheduledHandler = async () => {
  try {
    const results: Record<string, unknown> = {};
    if (process.env.VENUE_CAMERA_REGISTRY_TABLE?.trim()) {
      results.venue = await runVenueCameraHeartbeat();
    }
    if (process.env.CAMPUS_CAMERA_REGISTRY_TABLE?.trim()) {
      results.campus = await runCampusCameraHeartbeat();
    }
    console.log(JSON.stringify({ msg: "camera_heartbeat", ...results }));
  } catch (error) {
    console.error("[CameraHeartbeatFunction]", error);
    throw error;
  }
};
