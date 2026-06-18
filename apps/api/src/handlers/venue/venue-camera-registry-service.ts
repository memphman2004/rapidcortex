import {
  DescribeSignalingChannelCommand,
  KinesisVideoClient,
} from "@aws-sdk/client-kinesis-video";
import type {
  VenueCamera,
  VenueCameraUpsertBody,
  VenueIncidentCameraSummary,
} from "rapid-cortex-shared";
import {
  isRtspProducerVendor,
  venueKvsChannelName,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { VenueCameraRegistryRepository } from "../../repositories/venueCameraRegistryRepository.js";
import { broadcastToAgency } from "../../lib/websocket/send-message.js";
import { KvsChannelService } from "../../shared/kvs-channel-service.js";
import { discoverVenueOnvifCamera } from "./venue-camera-onvif-discovery.js";

const repo = new VenueCameraRegistryRepository();
const auditRepo = new AuditRepository();
const kvsClient = new KinesisVideoClient({ region: process.env.AWS_REGION });
const kvsChannels = new KvsChannelService();

/** Agent must ping within this window or camera is treated offline. */
export const PRODUCER_HEARTBEAT_STALE_MS = 5 * 60 * 1000;

function toSummary(camera: VenueCamera): VenueIncidentCameraSummary {
  return {
    cameraId: camera.cameraId,
    displayName: camera.displayName,
    kvsChannelName: camera.kvsChannelName,
    vendor: camera.vendor,
    ptzCapable: camera.ptzCapable,
  };
}

export function isCameraProducerOnline(camera: VenueCamera, nowMs = Date.now()): boolean {
  if (camera.status === "offline") return false;
  if (!camera.lastHeartbeat) return camera.status === "online";
  const age = nowMs - new Date(camera.lastHeartbeat).getTime();
  return age <= PRODUCER_HEARTBEAT_STALE_MS;
}

export async function getCamerasForSection(
  agencyId: string,
  sectionId: string,
  limit = 2,
): Promise<VenueIncidentCameraSummary[]> {
  const section = sectionId.trim();
  const cameras = await repo.listByAgency(agencyId);
  return cameras
    .filter(
      (c) =>
        isCameraProducerOnline(c) &&
        c.sections.some((s) => s.trim() === section || s.trim() === section.replace(/^section\s*/i, "")),
    )
    .sort((a, b) => a.priorityRank - b.priorityRank)
    .slice(0, limit)
    .map(toSummary);
}

export async function listVenueCameras(agencyId: string, sectionId?: string): Promise<VenueCamera[]> {
  const cameras = await repo.listByAgency(agencyId);
  if (!sectionId?.trim()) return cameras.sort((a, b) => a.priorityRank - b.priorityRank);
  const section = sectionId.trim();
  return cameras
    .filter((c) =>
      c.sections.some((s) => s.trim() === section || s.trim() === section.replace(/^section\s*/i, "")),
    )
    .sort((a, b) => a.priorityRank - b.priorityRank);
}

async function provisionRegistryCamera(
  agencyId: string,
  cameraId: string,
  kvsChannelName: string,
): Promise<void> {
  try {
    await kvsChannels.ensureRegistryChannel(kvsChannelName, agencyId);
  } catch (err) {
    console.warn("[venue-camera] KVS channel provision failed", kvsChannelName, err);
  }
}

export async function createVenueCamera(
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
    buildingId: body.buildingId?.trim(),
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
    details: { action: "create", cameraId, kvsChannelName },
    createdAt: now,
    resourceType: "venue_camera",
    resourceId: cameraId,
  });
  return camera;
}

export async function updateVenueCamera(
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
    buildingId: body.buildingId?.trim(),
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
    details: { action: "update", cameraId },
    createdAt: now,
    resourceType: "venue_camera",
    resourceId: cameraId,
  });
  return camera;
}

export async function deleteVenueCamera(
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
    details: { action: "delete", cameraId },
    createdAt: now,
    resourceType: "venue_camera",
    resourceId: cameraId,
  });
}

export async function discoverVenueCamera(input: {
  ip: string;
  username?: string;
  password?: string;
  port?: number;
}) {
  return discoverVenueOnvifCamera(input);
}

export async function recordProducerAgentHeartbeat(
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
    process.env.VENUE_CAMERA_PRODUCER_API_BASE?.trim() ||
    process.env.APP_PUBLIC_API_BASE?.trim() ||
    ""
  );
}

export function buildProducerConfigYaml(agencyId: string, cameras: VenueCamera[]): string {
  const region = process.env.AWS_REGION?.trim() || "us-east-2";
  const producerRoleArn = process.env.VENUE_KVS_PRODUCER_ROLE_ARN?.trim() || "";
  const apiBase = producerApiBaseUrl();
  const rtspCameras = cameras.filter(
    (c) => isRtspProducerVendor(c.vendor) && c.rtspUrl?.trim(),
  );

  const lines: string[] = [
    `# Rapid Cortex KVS Producer Agent configuration`,
    `# Agency: ${agencyId}`,
    `# Generated: ${new Date().toISOString()}`,
    `# Run the KVS Producer SDK on-site — one process per camera or a multi-camera agent.`,
    ``,
    `aws_region: ${region}`,
  ];

  if (producerRoleArn) {
    lines.push(`producer_role_arn: ${producerRoleArn}`);
  } else {
    lines.push(`# producer_role_arn: arn:aws:iam::ACCOUNT:role/rc-venue-producer-${agencyId}`);
  }

  if (apiBase) {
    lines.push(`heartbeat_api_base: ${apiBase.replace(/\/$/, "")}`);
  }

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
          `    heartbeat_url: ${apiBase.replace(/\/$/, "")}/api/venue/${encodeURIComponent(agencyId)}/cameras/${encodeURIComponent(cam.cameraId)}/heartbeat`,
        );
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}

export async function checkKvsChannelOnline(kvsChannelName: string): Promise<boolean> {
  try {
    const out = await kvsClient.send(
      new DescribeSignalingChannelCommand({ ChannelName: kvsChannelName.trim() }),
    );
    return Boolean(out.ChannelInfo?.ChannelARN);
  } catch {
    return false;
  }
}

export async function runVenueCameraHeartbeat(): Promise<{ checked: number; offline: number }> {
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
              sections: camera.sections,
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
