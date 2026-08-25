import type { ScheduledHandler } from "aws-lambda";
import { runCampusCameraHeartbeat } from "../campus/cameras/campus-camera-registry-service.js";
import { runVenueCameraHeartbeat } from "./venue-camera-registry-service.js";

/** DynamoDB table missing (ResourceNotFound) — config drift, not a KVS/heartbeat failure. */
export function isDynamoTableMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name: unknown }).name) : "";
  const type = "__type" in error ? String((error as { __type: unknown }).__type) : "";
  return name === "ResourceNotFoundException" || type.includes("ResourceNotFoundException");
}

async function runRegistryHeartbeat(
  label: "venue" | "campus",
  fn: () => Promise<unknown>,
): Promise<unknown> {
  try {
    return await fn();
  } catch (error) {
    if (isDynamoTableMissing(error)) {
      console.warn(
        `[CameraHeartbeatFunction] ${label} skipped: DynamoDB table not found`,
        error,
      );
      return { skipped: true, reason: "table_not_found" };
    }
    throw error;
  }
}

/** EventBridge schedule — verify KVS channel connectivity for venue + campus registry cameras. */
export const handler: ScheduledHandler = async () => {
  try {
    const results: Record<string, unknown> = {};
    if (process.env.VENUE_CAMERA_REGISTRY_TABLE?.trim()) {
      results.venue = await runRegistryHeartbeat("venue", runVenueCameraHeartbeat);
    }
    if (process.env.CAMPUS_CAMERA_REGISTRY_TABLE?.trim()) {
      results.campus = await runRegistryHeartbeat("campus", runCampusCameraHeartbeat);
    }
    console.log(JSON.stringify({ msg: "camera_heartbeat", ...results }));
  } catch (error) {
    console.error("[CameraHeartbeatFunction]", error);
    throw error;
  }
};
