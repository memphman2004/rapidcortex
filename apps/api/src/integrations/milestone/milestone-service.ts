/**
 * Milestone XProtect cloud service — connect, sync cameras into campus registry,
 * geo near-incident listing, live tickets, outbound events/alarms.
 */

import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import {
  calculateDistanceMeters,
  clampMilestoneRadiusMeters,
  MILESTONE_CAMERA_ASSOCIATION_LIMIT,
  MILESTONE_GEO_DEFAULT_RADIUS_METERS,
  type MilestoneAlarmBody,
  type MilestoneConnectBody,
  type MilestoneEventBody,
  type MilestoneLiveTicket,
  type MilestoneLiveTicketBody,
  type MilestoneOutboundAck,
  type MilestoneStatus,
  type MilestoneSyncResult,
  type VenueCamera,
} from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { CampusCameraRegistryRepository } from "../../repositories/campusCameraRegistryRepository.js";
import { MilestoneBridgeClient, milestoneMockEnabled } from "./milestone-bridge-client.js";
import {
  deleteMilestoneConnection,
  getMilestoneConnection,
  putMilestoneConnection,
  type MilestoneConnection,
} from "./milestone-tables.js";

const auditRepo = new AuditRepository();
const cameraRepo = new CampusCameraRegistryRepository();

async function writeAudit(opts: {
  agencyId: string;
  type: string;
  actorId: string;
  resourceType: "integration" | "campus_camera" | "incident";
  resourceId: string;
  incidentId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: opts.agencyId,
      actorId: opts.actorId,
      type: opts.type,
      details: opts.details ?? {},
      createdAt: new Date().toISOString(),
      resourceType: opts.resourceType,
      resourceId: opts.resourceId,
      incidentId: opts.incidentId,
    });
  } catch (err) {
    console.warn("[milestone] audit write failed", err);
  }
}

function assertMilestoneEnabled(): void {
  if (!env.enableMilestoneXprotect) {
    throw Object.assign(new Error("Milestone XProtect integration is disabled"), { statusCode: 503 });
  }
}

function bridgeClientFor(conn: MilestoneConnection): MilestoneBridgeClient {
  return new MilestoneBridgeClient({
    bridgeBaseUrl: conn.bridgeBaseUrl,
    credentialsSecretArn:
      conn.credentialsSecretArn?.trim() || env.milestoneBridgeCredentialsSecretArn || undefined,
  });
}

function milestoneCameraId(xprotectId: string): string {
  const id = xprotectId.trim().replace(/^milestone#/i, "");
  return `milestone#${id}`;
}

function kvsChannelFor(agencyId: string, cameraId: string): string {
  const safeAgency = agencyId.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
  const safeCam = cameraId.replace(/^milestone#/, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
  return `rc-${safeAgency}-${safeCam}`.slice(0, 256);
}

export async function getMilestoneStatus(agencyId: string): Promise<MilestoneStatus> {
  assertMilestoneEnabled();
  const conn = await getMilestoneConnection(agencyId);
  if (!conn || !conn.enabled) {
    return { connected: false, agencyId, mock: milestoneMockEnabled() };
  }
  return {
    connected: true,
    agencyId,
    bridgeBaseUrl: conn.bridgeBaseUrl,
    siteLabel: conn.siteLabel,
    outboundEnabled: conn.outboundEnabled,
    lastSyncAt: conn.lastSyncAt,
    cameraCount: conn.lastCameraCount,
    mock: milestoneMockEnabled() || !conn.bridgeBaseUrl,
  };
}

export async function connectMilestone(
  agencyId: string,
  body: MilestoneConnectBody,
  actorUserId: string,
): Promise<MilestoneStatus> {
  assertMilestoneEnabled();
  const now = new Date().toISOString();
  const existing = await getMilestoneConnection(agencyId);
  const row: MilestoneConnection = {
    agencyId: agencyId.trim(),
    bridgeBaseUrl: body.bridgeBaseUrl.replace(/\/$/, ""),
    siteLabel: body.siteLabel?.trim(),
    outboundEnabled: body.outboundEnabled ?? true,
    credentialsSecretArn: env.milestoneBridgeCredentialsSecretArn || existing?.credentialsSecretArn,
    connectedAt: existing?.connectedAt ?? now,
    updatedAt: now,
    lastSyncAt: existing?.lastSyncAt,
    lastCameraCount: existing?.lastCameraCount,
    enabled: true,
  };
  await putMilestoneConnection(row);

  await writeAudit({
    agencyId,
    type: AUDIT_EVENT_TYPES.MILESTONE_CONNECTED,
    actorId: actorUserId,
    resourceType: "integration",
    resourceId: agencyId,
    details: { bridgeBaseUrl: row.bridgeBaseUrl, siteLabel: row.siteLabel },
  });

  return getMilestoneStatus(agencyId);
}

export async function disconnectMilestone(agencyId: string, actorUserId: string): Promise<void> {
  assertMilestoneEnabled();
  await deleteMilestoneConnection(agencyId);
  await writeAudit({
    agencyId,
    type: AUDIT_EVENT_TYPES.MILESTONE_DISCONNECTED,
    actorId: actorUserId,
    resourceType: "integration",
    resourceId: agencyId,
  });
}

export async function syncMilestoneCameras(
  agencyId: string,
  actorUserId: string,
): Promise<MilestoneSyncResult> {
  assertMilestoneEnabled();
  const conn = await getMilestoneConnection(agencyId);
  if (!conn?.enabled) {
    throw Object.assign(new Error("Milestone is not connected for this agency"), { statusCode: 400 });
  }

  const client = bridgeClientFor(conn);
  const bridgeCameras = await client.listCameras();
  const now = new Date().toISOString();
  const upserted: MilestoneSyncResult["cameras"] = [];

  for (const cam of bridgeCameras) {
    const cameraId = milestoneCameraId(cam.cameraId);
    const existing = await cameraRepo.get(agencyId, cameraId);
    const row: VenueCamera = {
      agencyId,
      cameraId,
      displayName: cam.displayName,
      vendor: "milestone",
      kvsChannelName: existing?.kvsChannelName || kvsChannelFor(agencyId, cameraId),
      rtspUrl: cam.rtspUrl ?? existing?.rtspUrl,
      sections: cam.buildingId ? [cam.buildingId] : existing?.sections?.length ? existing.sections : ["MILESTONE"],
      buildingId: cam.buildingId ?? existing?.buildingId,
      floor: cam.floor ?? existing?.floor,
      zoneCode: cam.zoneCode ?? existing?.zoneCode,
      latitude: cam.latitude ?? existing?.latitude,
      longitude: cam.longitude ?? existing?.longitude,
      priorityRank: existing?.priorityRank ?? 50,
      ptzCapable: cam.ptzCapable ?? false,
      status: cam.status ?? "unknown",
      lastHeartbeat: now,
    };
    await cameraRepo.put(row);
    upserted.push({
      cameraId,
      displayName: row.displayName,
      xprotectGuid: cam.xprotectGuid,
      latitude: row.latitude,
      longitude: row.longitude,
      buildingId: row.buildingId,
      floor: row.floor,
      zoneCode: row.zoneCode,
      status: row.status,
      ptzCapable: row.ptzCapable,
    });
  }

  await putMilestoneConnection({
    ...conn,
    lastSyncAt: now,
    lastCameraCount: upserted.length,
    updatedAt: now,
  });

  await writeAudit({
    agencyId,
    type: AUDIT_EVENT_TYPES.MILESTONE_CAMERAS_SYNCED,
    actorId: actorUserId,
    resourceType: "integration",
    resourceId: agencyId,
    details: { synced: upserted.length },
  });

  return {
    synced: upserted.length,
    cameras: upserted,
    lastSyncAt: now,
    mock: milestoneMockEnabled(),
  };
}

export async function listMilestoneCamerasNear(
  agencyId: string,
  origin: { latitude: number; longitude: number },
  radiusMeters = MILESTONE_GEO_DEFAULT_RADIUS_METERS,
  limit = MILESTONE_CAMERA_ASSOCIATION_LIMIT,
): Promise<VenueCamera[]> {
  assertMilestoneEnabled();
  const radius = clampMilestoneRadiusMeters(radiusMeters);
  const cameras = (await cameraRepo.listByAgency(agencyId)).filter((c) => c.vendor === "milestone");
  return cameras
    .map((camera) => {
      if (camera.latitude == null || camera.longitude == null) return null;
      const dist = calculateDistanceMeters(
        origin.latitude,
        origin.longitude,
        camera.latitude,
        camera.longitude,
      );
      if (dist > radius) return null;
      return { camera, dist };
    })
    .filter((row): row is { camera: VenueCamera; dist: number } => row != null)
    .sort((a, b) => a.dist - b.dist || a.camera.priorityRank - b.camera.priorityRank)
    .slice(0, Math.max(1, limit))
    .map((row) => row.camera);
}

export async function requestMilestoneLiveTicket(
  agencyId: string,
  cameraId: string,
  body: MilestoneLiveTicketBody,
  actorUserId: string,
): Promise<MilestoneLiveTicket> {
  assertMilestoneEnabled();
  const conn = await getMilestoneConnection(agencyId);
  if (!conn?.enabled) {
    throw Object.assign(new Error("Milestone is not connected for this agency"), { statusCode: 400 });
  }
  const rawId = cameraId.replace(/^milestone#/i, "");
  const client = bridgeClientFor(conn);
  const ticket = await client.requestLive(rawId, {
    format: body.format,
    incidentId: body.incidentId,
  });

  await writeAudit({
    agencyId,
    type: AUDIT_EVENT_TYPES.MILESTONE_LIVE_TICKET,
    actorId: actorUserId,
    resourceType: "campus_camera",
    resourceId: cameraId,
    incidentId: body.incidentId,
    details: { format: ticket.format, mock: ticket.mock },
  });

  return { ...ticket, cameraId: milestoneCameraId(ticket.cameraId || rawId) };
}

export async function sendMilestoneEvent(
  agencyId: string,
  body: MilestoneEventBody,
  actorUserId: string,
): Promise<MilestoneOutboundAck> {
  assertMilestoneEnabled();
  const conn = await getMilestoneConnection(agencyId);
  if (!conn?.enabled) {
    throw Object.assign(new Error("Milestone is not connected for this agency"), { statusCode: 400 });
  }
  if (!conn.outboundEnabled) {
    return { ok: false, mock: milestoneMockEnabled() };
  }
  const client = bridgeClientFor(conn);
  const ack = await client.sendEvent({ ...body, agencyId });

  await writeAudit({
    agencyId,
    type: AUDIT_EVENT_TYPES.MILESTONE_EVENT_SENT,
    actorId: actorUserId,
    resourceType: "incident",
    resourceId: body.incidentId,
    incidentId: body.incidentId,
    details: { bridgeEventId: ack.bridgeEventId, mock: ack.mock },
  });
  return ack;
}

export async function sendMilestoneAlarm(
  agencyId: string,
  body: MilestoneAlarmBody,
  actorUserId: string,
): Promise<MilestoneOutboundAck> {
  assertMilestoneEnabled();
  const conn = await getMilestoneConnection(agencyId);
  if (!conn?.enabled) {
    throw Object.assign(new Error("Milestone is not connected for this agency"), { statusCode: 400 });
  }
  if (!conn.outboundEnabled) {
    return { ok: false, mock: milestoneMockEnabled() };
  }
  const client = bridgeClientFor(conn);
  const ack = await client.sendAlarm({ ...body, agencyId });

  await writeAudit({
    agencyId,
    type: AUDIT_EVENT_TYPES.MILESTONE_ALARM_SENT,
    actorId: actorUserId,
    resourceType: "incident",
    resourceId: body.incidentId,
    incidentId: body.incidentId,
    details: { bridgeEventId: ack.bridgeEventId, mock: ack.mock },
  });
  return ack;
}

/**
 * Fire-and-forget outbound to XProtect after a campus incident state change.
 * Never throws to the caller. No-ops when the Milestone stack/table is not wired.
 */
export async function notifyMilestoneOfCampusIncident(opts: {
  agencyId: string;
  incidentId: string;
  title: string;
  description?: string;
  severity?: "low" | "medium" | "high" | "critical";
  latitude?: number;
  longitude?: number;
  cameraIds?: string[];
  raiseAlarm?: boolean;
}): Promise<void> {
  try {
    if (!env.enableMilestoneXprotect) return;
    if (!env.milestoneConnectionsTableName) return;
    const conn = await getMilestoneConnection(opts.agencyId);
    if (!conn?.enabled || !conn.outboundEnabled) return;

    await sendMilestoneEvent(
      opts.agencyId,
      {
        incidentId: opts.incidentId,
        title: opts.title,
        description: opts.description,
        severity: opts.severity ?? "medium",
        latitude: opts.latitude,
        longitude: opts.longitude,
        cameraIds: opts.cameraIds,
      },
      "system:milestone-outbound",
    );

    if (opts.raiseAlarm !== false) {
      await sendMilestoneAlarm(
        opts.agencyId,
        {
          incidentId: opts.incidentId,
          message: opts.title,
          severity: opts.severity ?? "high",
          cameraIds: opts.cameraIds,
        },
        "system:milestone-outbound",
      );
    }
  } catch (err) {
    console.warn("[milestone] outbound notify failed", {
      agencyId: opts.agencyId,
      incidentId: opts.incidentId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
