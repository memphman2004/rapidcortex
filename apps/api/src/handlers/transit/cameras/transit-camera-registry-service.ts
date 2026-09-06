import type { VenueCamera, VenueCameraUpsertBody, VenueIncidentCameraSummary } from "rapid-cortex-shared";
import {
  isRtspProducerVendor,
  selectCamerasForTransitPlace,
  toTransitCameraSummary,
  venueKvsChannelName,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../../lib/ids.js";
import { AuditRepository } from "../../../repositories/auditRepository.js";
import { TransitCameraRegistryRepository } from "../../../repositories/transitCameraRegistryRepository.js";
import { KvsChannelService } from "../../../shared/kvs-channel-service.js";
import { discoverVenueOnvifCamera } from "../../venue/venue-camera-onvif-discovery.js";
import { isCameraProducerOnline } from "../../venue/venue-camera-registry-service.js";

const repo = new TransitCameraRegistryRepository();
const auditRepo = new AuditRepository();
const kvsChannels = new KvsChannelService();

function locationSections(body: VenueCameraUpsertBody): string[] {
  const fromBody = body.sections.map((s) => s.trim()).filter(Boolean);
  if (fromBody.length) return fromBody;
  const fallback = body.vehicleId?.trim() || body.stationId?.trim() || body.routeId?.trim();
  return fallback ? [fallback] : [];
}

export async function getCamerasForTransitPlace(
  agencyId: string,
  place: {
    vehicleId?: string | null;
    stationId?: string | null;
    routeId?: string | null;
    assignedCameraIds?: string[] | null;
  },
  limit = 2,
): Promise<VenueIncidentCameraSummary[]> {
  const cameras = await repo.listByAgency(agencyId);
  const selected = selectCamerasForTransitPlace(cameras, {
    assignedCameraIds: place.assignedCameraIds,
    place: {
      vehicleId: place.vehicleId,
      stationId: place.stationId,
      routeId: place.routeId,
    },
    limit,
    isEligibleFallback: (camera) => isCameraProducerOnline(camera),
  });
  return selected.map(toTransitCameraSummary);
}

export async function listTransitCameras(agencyId: string): Promise<VenueCamera[]> {
  const cameras = await repo.listByAgency(agencyId);
  return cameras.sort((a, b) => a.priorityRank - b.priorityRank);
}

async function provisionRegistryCamera(agencyId: string, kvsChannelName: string): Promise<void> {
  try {
    await kvsChannels.ensureRegistryChannel(kvsChannelName, agencyId);
  } catch (err) {
    console.warn("[transit-camera] KVS channel provision failed", kvsChannelName, err);
  }
}

export async function createTransitCamera(
  agencyId: string,
  actorId: string,
  body: VenueCameraUpsertBody,
): Promise<VenueCamera> {
  const now = new Date().toISOString();
  const cameraId = body.cameraId?.trim() || makeId("cam");
  const kvsChannelName = body.kvsChannelName?.trim() || venueKvsChannelName(agencyId, cameraId);
  const sections = locationSections(body);
  if (sections.length === 0) {
    throw Object.assign(new Error("Vehicle, station, or section is required"), { statusCode: 400 });
  }

  await provisionRegistryCamera(agencyId, kvsChannelName);

  const camera: VenueCamera = {
    agencyId: agencyId.trim(),
    cameraId,
    displayName: body.displayName.trim(),
    vendor: body.vendor,
    kvsChannelName,
    rtspUrl: body.rtspUrl?.trim(),
    cameraIp: body.cameraIp?.trim(),
    sections,
    vehicleId: body.vehicleId?.trim() || sections[0],
    stationId: body.stationId?.trim(),
    routeId: body.routeId?.trim(),
    latitude: body.latitude,
    longitude: body.longitude,
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
    type: AUDIT_EVENT_TYPES.TRANSIT_CAMERA_REGISTRY_UPDATED,
    details: { action: "create", cameraId, kvsChannelName, vertical: "transit" },
    createdAt: now,
    resourceType: "transit_camera",
    resourceId: cameraId,
  });
  return camera;
}

export async function updateTransitCamera(
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
  const sections = locationSections(body);
  if (sections.length === 0) {
    throw Object.assign(new Error("Vehicle, station, or section is required"), { statusCode: 400 });
  }

  await provisionRegistryCamera(agencyId, kvsChannelName);

  const camera: VenueCamera = {
    ...existing,
    displayName: body.displayName.trim(),
    vendor: body.vendor,
    kvsChannelName,
    rtspUrl: body.rtspUrl?.trim(),
    cameraIp: body.cameraIp?.trim(),
    sections,
    vehicleId: body.vehicleId?.trim() || sections[0],
    stationId: body.stationId?.trim(),
    routeId: body.routeId?.trim(),
    latitude: body.latitude,
    longitude: body.longitude,
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
    type: AUDIT_EVENT_TYPES.TRANSIT_CAMERA_REGISTRY_UPDATED,
    details: { action: "update", cameraId, vertical: "transit" },
    createdAt: now,
    resourceType: "transit_camera",
    resourceId: cameraId,
  });
  return camera;
}

export async function deleteTransitCamera(agencyId: string, cameraId: string, actorId: string): Promise<void> {
  const existing = await repo.get(agencyId, cameraId);
  if (!existing) throw Object.assign(new Error("Camera not found"), { statusCode: 404 });
  await repo.delete(agencyId, cameraId);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.TRANSIT_CAMERA_REGISTRY_UPDATED,
    details: { action: "delete", cameraId, vertical: "transit" },
    createdAt: new Date().toISOString(),
    resourceType: "transit_camera",
    resourceId: cameraId,
  });
}

export async function discoverTransitCamera(input: {
  ip: string;
  username?: string;
  password?: string;
  port?: number;
}) {
  return discoverVenueOnvifCamera(input);
}

export async function recordTransitProducerAgentHeartbeat(
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
    process.env.TRANSIT_CAMERA_PRODUCER_API_BASE?.trim() ||
    process.env.APP_PUBLIC_API_BASE?.trim() ||
    ""
  );
}

export function buildTransitProducerConfigYaml(agencyId: string, cameras: VenueCamera[]): string {
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  const producerRoleArn = process.env.VENUE_KVS_PRODUCER_ROLE_ARN?.trim() || "";
  const apiBase = producerApiBaseUrl();
  const rtspCameras = cameras.filter((c) => isRtspProducerVendor(c.vendor) && c.rtspUrl?.trim());

  const lines: string[] = [
    `# Rapid Cortex KVS Producer Agent configuration (transit)`,
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
          `    heartbeat_url: ${apiBase.replace(/\/$/, "")}/api/transit/${encodeURIComponent(agencyId)}/cameras/${encodeURIComponent(cam.cameraId)}/heartbeat`,
        );
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}

export { repo as transitCameraRegistryRepo };
