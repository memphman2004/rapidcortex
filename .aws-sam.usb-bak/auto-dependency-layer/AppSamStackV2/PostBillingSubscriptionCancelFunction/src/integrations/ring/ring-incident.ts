import type { Incident, UserContext } from "rapid-cortex-shared";
import { getIncidentForUser } from "../../lib/authz.js";
import { IncidentRepository } from "../../repositories/incidentRepository.js";

const incidentRepo = new IncidentRepository();

const ACTIVE_STATUSES = new Set<Incident["status"]>(["active", "in_progress"]);

export type RingIncidentResult =
  | { ok: true; incident: Incident }
  | { ok: false; statusCode: 404 | 400; message: string };

export async function requireActiveRingIncident(
  incidentId: string,
  user: UserContext,
): Promise<RingIncidentResult> {
  const incident = await getIncidentForUser(incidentRepo, incidentId, user);
  if (!incident) {
    return { ok: false, statusCode: 404, message: "Incident not found." };
  }
  if (!ACTIVE_STATUSES.has(incident.status)) {
    return { ok: false, statusCode: 400, message: "Incident is not active." };
  }
  if (incident.callerLocationLat == null || incident.callerLocationLng == null) {
    return {
      ok: false,
      statusCode: 400,
      message: "Incident location is required for Ring camera discovery.",
    };
  }
  return { ok: true, incident };
}

export function incidentCoordinates(incident: Incident): { latitude: number; longitude: number } {
  return {
    latitude: incident.callerLocationLat as number,
    longitude: incident.callerLocationLng as number,
  };
}
