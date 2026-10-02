import type { SystemHealthDeviceInput } from "rapid-cortex-shared";
import {
  buildSystemHealthReport,
  isOpenIncidentStatus,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { CampusCameraRegistryRepository } from "../repositories/campusCameraRegistryRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { TransitCameraRegistryRepository } from "../repositories/transitCameraRegistryRepository.js";
import { VenueCameraRegistryRepository } from "../repositories/venueCameraRegistryRepository.js";

const incidents = new IncidentRepository();
const auditRepo = new AuditRepository();

async function loadAgencyDevices(agencyId: string): Promise<SystemHealthDeviceInput[]> {
  const devices: SystemHealthDeviceInput[] = [];
  const loaders: Array<() => Promise<{ cameraId: string; displayName: string; lastHeartbeat?: string; status?: string }[]>> =
    [];

  if (process.env.VENUE_CAMERA_REGISTRY_TABLE?.trim()) {
    const repo = new VenueCameraRegistryRepository();
    loaders.push(() => repo.listByAgency(agencyId));
  }
  if (process.env.CAMPUS_CAMERA_REGISTRY_TABLE?.trim()) {
    const repo = new CampusCameraRegistryRepository();
    loaders.push(() => repo.listByAgency(agencyId));
  }
  if (process.env.TRANSIT_CAMERA_REGISTRY_TABLE?.trim()) {
    const repo = new TransitCameraRegistryRepository();
    loaders.push(() => repo.listByAgency(agencyId));
  }

  for (const load of loaders) {
    try {
      const cams = await load();
      for (const cam of cams) {
        devices.push({
          id: cam.cameraId,
          label: cam.displayName,
          lastHeartbeat: cam.lastHeartbeat,
          status: cam.status,
        });
      }
    } catch {
      /* table missing or IAM not on this Lambda — skip fleet rows */
    }
  }
  return devices;
}

export async function generateSystemHealthPayload(
  agencyId: string,
  dateRange: { start: string; end: string },
): Promise<{ rows: Record<string, unknown>[]; summary: Record<string, number> }> {
  const created = await incidents.listByAgencySince(agencyId, dateRange.start, 500);
  const inRange = created.filter((i) => {
    const t = new Date(i.createdAt).getTime();
    return t >= new Date(dateRange.start).getTime() && t <= new Date(dateRange.end).getTime();
  });
  const snapshot = await incidents.listByAgencyWithLimit(agencyId, 200);
  const openIncidents = snapshot.filter((i) => isOpenIncidentStatus(i.status));

  let auditEvents: Array<{ type: string; createdAt: string; actorId?: string; resourceId?: string }> = [];
  if (env.auditTable) {
    try {
      const events = await auditRepo.listByAgencyBetween(agencyId, dateRange.start, dateRange.end, 2000);
      auditEvents = events.map((e) => ({
        type: String(e.type),
        createdAt: e.createdAt,
        actorId: e.actorId,
        resourceId: e.resourceId ?? e.incidentId,
      }));
    } catch {
      auditEvents = [];
    }
  }

  const devices = await loadAgencyDevices(agencyId);

  return buildSystemHealthReport({
    periodStart: dateRange.start,
    periodEnd: dateRange.end,
    incidentsCreatedInRange: inRange.map((i) => ({
      incidentId: i.incidentId,
      status: i.status,
      category: i.category,
      createdAt: i.createdAt,
      urgency: i.urgency,
    })),
    openIncidents: openIncidents.map((i) => ({
      incidentId: i.incidentId,
      status: i.status,
      category: i.category,
      createdAt: i.createdAt,
      urgency: i.urgency,
    })),
    auditEvents,
    devices,
  });
}
