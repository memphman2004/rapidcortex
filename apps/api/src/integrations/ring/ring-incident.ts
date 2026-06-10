import type { Incident, UserContext } from "rapid-cortex-shared";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getIncidentForUser } from "../../lib/authz.js";
import { IncidentRepository } from "../../repositories/incidentRepository.js";
import { extractVenueCodeFromAgencyId } from "./ring-venue.js";

const incidentRepo = new IncidentRepository();
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const ACTIVE_CORE_STATUSES = new Set<Incident["status"]>(["active", "in_progress"]);
const ACTIVE_VENUE_STATUSES = new Set(["open", "assigned", "responding"]);

export type RingIncidentContext = {
  incidentId: string;
  agencyId: string;
  callerLocationLat: number;
  callerLocationLng: number;
  source: "core" | "venue";
  /** Human-readable incident type for Ring owner notifications (optional for venue incidents). */
  category?: string;
};

export type RingIncidentResult =
  | { ok: true; incident: RingIncidentContext }
  | { ok: false; statusCode: 404 | 400; message: string };

function venueConfigTable(): string | undefined {
  return process.env.VENUE_CONFIG_TABLE?.trim() || undefined;
}

async function getVenueIncidentForRing(
  incidentId: string,
  user: UserContext,
): Promise<RingIncidentContext | null> {
  const table = venueConfigTable();
  if (!table) return null;

  const venueCode = extractVenueCodeFromAgencyId(user.agencyId);
  if (!venueCode) return null;

  const result = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: {
        pk: `VENUE#${venueCode}`,
        sk: `INCIDENT#${incidentId}`,
      },
    }),
  );

  const item = result.Item;
  if (!item) return null;

  const agencyId = typeof item.agencyId === "string" ? item.agencyId : user.agencyId;
  if (agencyId !== user.agencyId) return null;

  const status = String(item.status ?? "");
  if (!ACTIVE_VENUE_STATUSES.has(status)) return null;

  const lat = item.gpsLat ?? item.latitude;
  const lng = item.gpsLng ?? item.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const category =
    typeof item.category === "string"
      ? item.category
      : typeof item.incidentType === "string"
        ? item.incidentType
        : undefined;

  return {
    incidentId,
    agencyId,
    callerLocationLat: lat,
    callerLocationLng: lng,
    source: "venue",
    category,
  };
}

export async function requireActiveRingIncident(
  incidentId: string,
  user: UserContext,
): Promise<RingIncidentResult> {
  const venueIncident = await getVenueIncidentForRing(incidentId, user);
  if (venueIncident) {
    return { ok: true, incident: venueIncident };
  }

  const incident = await getIncidentForUser(incidentRepo, incidentId, user);
  if (!incident) {
    return { ok: false, statusCode: 404, message: "Incident not found." };
  }
  if (!ACTIVE_CORE_STATUSES.has(incident.status)) {
    return { ok: false, statusCode: 400, message: "Incident is not active." };
  }
  if (incident.callerLocationLat == null || incident.callerLocationLng == null) {
    return {
      ok: false,
      statusCode: 400,
      message: "Incident location is required for Ring camera discovery.",
    };
  }
  return {
    ok: true,
    incident: {
      incidentId,
      agencyId: incident.agencyId,
      callerLocationLat: incident.callerLocationLat,
      callerLocationLng: incident.callerLocationLng,
      source: "core",
      category: incident.category,
    },
  };
}

export function incidentCoordinates(incident: RingIncidentContext): {
  latitude: number;
  longitude: number;
} {
  return {
    latitude: incident.callerLocationLat,
    longitude: incident.callerLocationLng,
  };
}
