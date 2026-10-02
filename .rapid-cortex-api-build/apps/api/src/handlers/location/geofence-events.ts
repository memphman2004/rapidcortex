import type { EventBridgeHandler } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";

const auditRepo = new AuditRepository();

type GeofenceDetail = {
  EventType?: string;
  GeofenceId?: string;
  DeviceId?: string;
  SampleTime?: string;
  Position?: number[];
};

/**
 * ALS fires EventBridge events when a tracked device enters or exits a geofence.
 * Agency is derived from the `{agencyId}--{zoneId}` geofence id prefix.
 */
export const handler: EventBridgeHandler<"Location Geofence Event", GeofenceDetail, void> = async (
  event,
) => {
  const detail = event.detail ?? {};
  const geofenceId = typeof detail.GeofenceId === "string" ? detail.GeofenceId : "";
  const agencyId = geofenceId.split("--")[0] || "unknown";
  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: "als-geofence",
      type: AUDIT_EVENT_TYPES.LOCATION_GEOFENCE_EVENT,
      details: {
        eventType: detail.EventType,
        geofenceId,
        deviceId: detail.DeviceId,
        sampleTime: detail.SampleTime,
        position: detail.Position,
      },
      createdAt: new Date().toISOString(),
      resourceType: "agency",
      resourceId: geofenceId || "geofence",
    });
  } catch {
    /* never throw from EventBridge — retry storms on audit table issues */
  }
};
