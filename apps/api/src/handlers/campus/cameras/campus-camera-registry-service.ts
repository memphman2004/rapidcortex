import type {
  VenueCamera,
  VenueCameraUpsertBody,
  VenueIncidentCameraSummary,
} from "rapid-cortex-shared";
import { isRtspProducerVendor, venueKvsChannelName } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../../lib/ids.js";
import { AuditRepository } from "../../../repositories/auditRepository.js";
import { CampusCameraRegistryRepository } from "../../../repositories/campusCameraRegistryRepository.js";
import { broadcastToAgency } from "../../../lib/websocket/send-message.js";
import { KvsChannelService } from "../../../shared/kvs-channel-service.js";
import { discoverVenueOnvifCamera } from "../../venue/venue-camera-onvif-discovery.js";
import {
  isCameraProducerOnline,
  PRODUCER_HEARTBEAT_STALE_MS,
  checkKvsChannelOnline,
} from "../../venue/venue-camera-registry-service.js";

const repo = new CampusCameraRegistryRepository();
const auditRepo = new AuditRepository();
const kvsChannels = new KvsChannelService();

function toSummary(camera: VenueCamera): VenueIncidentCameraSummary {
  return {
    cameraId: camera.cameraId,
    displayName: camera.displayName,
    kvsChannelName: camera.kvsChannelName,
    vendor: camera.vendor,
    ptzCapable: camera.ptzCapable,
  };
}

function cameraBuildingId(camera: VenueCamera): string {
  return (camera.buildingId?.trim() || camera.sections[0]?.trim() || "").toUpperCase();
}

function cameraFloor(camera: VenueCamera): string {
  return (camera.floor?.trim() || "").toUpperCase();
}

export async function getCamerasForBuildingFloor(
  agencyId: string,
  buildingId: string,
  floor: string | null | undefined,
  limit = 2,
): Promise<VenueIncidentCameraSummary[]> {
  const building = buildingId.trim().toUpperCase();
  const floorNorm = floor?.trim().toUpperCase() ?? "";
  const cameras = await repo.listByAgency(agencyId);
  return cameras
    .filter((c) => {
      if (!isCameraProducerOnline(c)) return false;
      if (cameraBuildingId(c) !== building) return false;
      if (floorNorm) {
        const camFloor = cameraFloor(c);
        if (camFloor && camFloor !== floorNorm) return false;
      }
      return true;
    })
    .sort((a, b) => a.priorityRank - b.priorityRank)
    .slice(0, limit)
    .map(toSummary);
}

export async function listCampusCameras(
  agencyId: string,
  buildingId?: string,
  floor?: string,
): Promise<VenueCamera[]> {
  const cameras = await repo.listByAgency(agencyId);
  let filtered = cameras;
  if (buildingId?.trim()) {
    const building = buildingId.trim().toUpperCase();
    const floorNorm = floor?.trim().toUpperCase() ?? "";
    filtered = cameras.filter((c) => {
      if (cameraBuildingId(c) !== building) return false;
      if (floorNorm) {
        const camFloor = cameraFloor(c);
        if (camFloor && camFloor !== floorNorm) return false;
      }
      return true;
    });
  }
  return filtered.sort((a, b) => a.priorityRank - b.priorityRank);
}

async function provisionRegistryCamera(
  agencyId: string,
  cameraId: string,
  kvsChannelName: string,
): Promise<void> {
  try {
    await kvsChannels.ensureRegistryChannel(kvsChannelName, agencyId);
  } catch (err) {
    console.warn("[campus-camera] KVS channel provision failed", kvsChannelName, err);
  }
}

export async function createCampusCamera(
  agencyId: string,
  actorId: string,
  body: VenueCameraUpsertBody,
): Promise<VenueCamera> {
  const now = new Date().toISOString();
  const cameraId = body.cameraId?.trim() || makeId("cam");
  const kvsChannelName =
    body.kvsChannelName?.trim() || venueKvsChannelName(agencyId, cameraId);

  await provisionRegistryCamera(agencyId, cameraId, kvsChannelName);

  const camera: VenueCamera = {
    agencyId: agencyId.trim(),
    cameraId,
    displayName: body.displayName.trim(),
    vendor: body.vendor,
    kvsChannelName,
    rtspUrl: body.rtspUrl?.trim(),
    cameraIp: body.cameraIp?.trim(),
    sections: body.sections.map((s) => s.trim()),
    buildingId: body.buildingId?.trim() || body.sections[0]?.trim(),
    floor: body.floor?.trim(),
    priorityRank: body.priorityRank,
    ptzCapable: body.ptzCapable,
    status: body.status ?? "unknown",
    lastHeartbeat: undefined,
  };
  await repo.put(camera);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.VENUE_CAMERA_REGISTRY_UPDATED,
    details: { action: "create", cameraId, kvsChannelName, vertical: "campus" },
    createdAt: now,
    resourceType: "campus_camera",
    resourceId: cameraId,
  });
  return camera;
}

export async function updateCampusCamera(
  agencyId: string,
  cameraId: string,
  actorId: string,
  body: VenueCameraUpsertBody,
): Promise<VenueCamera> {
  const existing = await repo.get(agencyId, cameraId);
  if (!existing) throw Object.assign(new Error("Camera not found"), { statusCode: 404 });

  const now = new Date().toISOString();
  const kvsChannelName =
    body.kvsChannelName?.trim() || existing.kvsChannelName || venueKvsChannelName(agencyId, cameraId);

  await provisionRegistryCamera(agencyId, cameraId, kvsChannelName);

  const camera: VenueCamera = {
    ...existing,
    displayName: body.displayName.trim(),
    vendor: body.vendor,
    kvsChannelName,
    rtspUrl: body.rtspUrl?.trim(),
    cameraIp: body.cameraIp?.trim(),
    sections: body.sections.map((s) => s.trim()),
    buildingId: body.buildingId?.trim() || body.sections[0]?.trim(),
    floor: body.floor?.trim(),
    priorityRank: body.priorityRank,
    ptzCapable: body.ptzCapable,
    status: body.status ?? existing.status,
    lastHeartbeat: existing.lastHeartbeat,
  };
  await repo.put(camera);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.VENUE_CAMERA_REGISTRY_UPDATED,
    details: { action: "update", cameraId, vertical: "campus" },
    createdAt: now,
    resourceType: "campus_camera",
    resourceId: cameraId,
  });
  return camera;
}

export async function deleteCampusCamera(
  agencyId: string,
  cameraId: string,
  actorId: string,
): Promise<void> {
  const existing = await repo.get(agencyId, cameraId);
  if (!existing) throw Object.assign(new Error("Camera not found"), { statusCode: 404 });
  await repo.delete(agencyId, cameraId);
  const now = new Date().toISOString();
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.VENUE_CAMERA_REGISTRY_UPDATED,
    details: { action: "delete", cameraId, vertical: "campus" },
    createdAt: now,
    resourceType: "campus_camera",
    resourceId: cameraId,
  });
}

export async function discoverCampusCamera(input: {
  ip: string;
  username?: string;
  password?: string;
  port?: number;
}) {
  return discoverVenueOnvifCamera(input);
}

export async function recordCampusProducerAgentHeartbeat(
  agencyId: string,
  cameraId: string,
): Promise<VenueCamera> {
  const existing = await repo.get(agencyId, cameraId);
  if (!existing) throw Object.assign(new Error("Camera not found"), { statusCode: 404 });

  const now = new Date().toISOString();
  await repo.updateStatus(agencyId, cameraId, "online", now);
  return { ...existing, status: "online", lastHeartbeat: now };
}

function producerApiBaseUrl(): string {
  return (
    process.env.CAMPUS_CAMERA_PRODUCER_API_BASE?.trim() ||
    process.env.APP_PUBLIC_API_BASE?.trim() ||
    ""
  );
}

export function buildCampusProducerConfigYaml(agencyId: string, cameras: VenueCamera[]): string {
  const region = process.env.AWS_REGION?.trim() || "us-east-2";
  const producerRoleArn = process.env.VENUE_KVS_PRODUCER_ROLE_ARN?.trim() || "";
  const apiBase = producerApiBaseUrl();
  const rtspCameras = cameras.filter(
    (c) => isRtspProducerVendor(c.vendor) && c.rtspUrl?.trim(),
  );

  const lines: string[] = [
    `# Rapid Cortex KVS Producer Agent configuration (campus)`,
    `# Agency: ${agencyId}`,
    `# Generated: ${new Date().toISOString()}`,
    ``,
    `aws_region: ${region}`,
  ];

  if (producerRoleArn) lines.push(`producer_role_arn: ${producerRoleArn}`);
  if (apiBase) lines.push(`heartbeat_api_base: ${apiBase.replace(/\/$/, "")}`);

  lines.push("", "cameras:");
  if (rtspCameras.length === 0) {
    lines.push("  # Add cameras with RTSP URLs in the registry, then re-download this file.");
  } else {
    for (const cam of rtspCameras) {
      lines.push(`  - id: ${cam.cameraId}`);
      lines.push(`    name: "${cam.displayName.replace(/"/g, '\\"')}"`);
      lines.push(`    rtsp: ${cam.rtspUrl!.trim()}`);
      lines.push(`    kvs_channel: ${cam.kvsChannelName}`);
      lines.push(`    aws_region: ${region}`);
      if (apiBase) {
        lines.push(
          `    heartbeat_url: ${apiBase.replace(/\/$/, "")}/api/campus/${encodeURIComponent(agencyId)}/cameras/${encodeURIComponent(cam.cameraId)}/heartbeat`,
        );
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}

export async function runCampusCameraHeartbeat(): Promise<{ checked: number; offline: number }> {
  const cameras = await repo.listAll();
  const now = new Date().toISOString();
  const nowMs = Date.now();
  let offline = 0;

  for (const camera of cameras) {
    const stale =
      camera.lastHeartbeat &&
      nowMs - new Date(camera.lastHeartbeat).getTime() > PRODUCER_HEARTBEAT_STALE_MS;

    let nextStatus: VenueCamera["status"] = camera.status;
    if (stale) {
      nextStatus = "offline";
    } else if (isCameraProducerOnline(camera, nowMs)) {
      nextStatus = "online";
    } else if (!camera.lastHeartbeat) {
      const kvsOk = await checkKvsChannelOnline(camera.kvsChannelName);
      nextStatus = kvsOk ? "unknown" : "offline";
    } else {
      nextStatus = "offline";
    }

    if (nextStatus !== camera.status) {
      await repo.updateStatus(camera.agencyId, camera.cameraId, nextStatus, now);
      if (nextStatus === "offline") {
        offline += 1;
        await broadcastToAgency({
          agencyId: camera.agencyId,
          message: {
            type: "camera:offline",
            data: {
              cameraId: camera.cameraId,
              agencyId: camera.agencyId,
              kvsChannelName: camera.kvsChannelName,
              buildingId: camera.buildingId,
              floor: camera.floor,
            },
          },
        });
      }
    } else if (nextStatus === "online" && camera.lastHeartbeat) {
      await repo.updateStatus(camera.agencyId, camera.cameraId, "online", camera.lastHeartbeat);
    }
  }

  return { checked: cameras.length, offline };
}
