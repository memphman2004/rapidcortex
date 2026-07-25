import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type {
  EidoDocument,
  EidoImportBody,
  Incident,
  IncidentCategory,
  UrgencyLevel,
  UserContext,
} from "rapid-cortex-shared";
import { eidoDocumentSchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { ddb } from "../../repositories/baseRepository.js";
import { IncidentRepository } from "../../repositories/incidentRepository.js";
import { ng911AssistStore } from "./ng911AssistStore.js";

const auditRepo = new AuditRepository();
const incidentRepo = new IncidentRepository();

const INCIDENT_CATEGORIES: readonly IncidentCategory[] = [
  "medical",
  "fire",
  "police",
  "welfare_check",
  "domestic_disturbance",
  "unknown",
];

const URGENCY_LEVELS: readonly UrgencyLevel[] = ["critical", "high", "moderate", "low"];

function mapIncidentStatusToEido(status: Incident["status"]): EidoDocument["status"] {
  switch (status) {
    case "active":
    case "in_progress":
      return "active";
    case "completed":
      return "closed";
    case "archived":
      return "cancelled";
    default:
      return "unknown";
  }
}

function mapEidoStatusToIncident(status: EidoDocument["status"] | undefined): Incident["status"] {
  switch (status) {
    case "created":
    case "active":
      return "active";
    case "closed":
      return "completed";
    case "cancelled":
      return "archived";
    default:
      return "active";
  }
}

function mapIncidentTypeToCategory(incidentType: string | undefined): IncidentCategory {
  const normalized = incidentType?.trim().toLowerCase().replaceAll(" ", "_");
  const match = INCIDENT_CATEGORIES.find((c) => c === normalized);
  return match ?? "unknown";
}

function mapPriorityToUrgency(priority: string | undefined): UrgencyLevel {
  const normalized = priority?.trim().toLowerCase();
  const match = URGENCY_LEVELS.find((u) => u === normalized);
  return match ?? "moderate";
}

function buildLocation(incident: Incident): EidoDocument["location"] {
  const hasGeo = incident.callerLocationLat != null && incident.callerLocationLng != null;
  const hasCivic = Boolean(incident.callerAddressLine?.trim());
  if (!hasGeo && !hasCivic) return undefined;
  return {
    locationType: hasGeo ? "geodetic" : hasCivic ? "civic" : "unknown",
    ...(hasGeo
      ? {
          latitude: incident.callerLocationLat ?? undefined,
          longitude: incident.callerLocationLng ?? undefined,
        }
      : {}),
    ...(hasCivic ? { civicAddress: incident.callerAddressLine ?? undefined } : {}),
    ...(incident.callerLocationMapLabel
      ? { locationDescription: incident.callerLocationMapLabel }
      : {}),
  };
}

function buildCall(incident: Incident): EidoDocument["call"] {
  if (!incident.callerCallback && !incident.callerLanguage) return undefined;
  return {
    ...(incident.callerCallback ? { callerPhoneE164: incident.callerCallback } : {}),
    ...(incident.callerLanguage ? { callLanguage: incident.callerLanguage } : {}),
  };
}

/** Builds and persists a practical EIDO-compatible export for an incident (see `eido.ts` doc comment). */
export async function exportFromIncident(
  agencyId: string,
  incidentId: string,
  includeAdditionalData = false,
): Promise<EidoDocument> {
  const incident = await incidentRepo.get(incidentId);
  if (!incident || incident.agencyId !== agencyId) throw new Error("NOT_FOUND");

  const now = new Date().toISOString();
  const eido: EidoDocument = eidoDocumentSchema.parse({
    eidoType: "EmergencyIncidentDataObject",
    eidoVersion: "RC-1.0",
    incidentId: incident.incidentId,
    agencyId: incident.agencyId,
    incidentNumber: incident.incidentId,
    status: mapIncidentStatusToEido(incident.status),
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
    priority: incident.urgency,
    incidentType: incident.category,
    summary: incident.summary,
    agency: { agencyId: incident.agencyId },
    location: buildLocation(incident),
    call: buildCall(incident),
    sourceSystem: "rapid-cortex",
    sourceIncidentId: incident.incidentId,
  });

  if (includeAdditionalData) {
    const pkg = await ng911AssistStore.getAdditionalData(agencyId, incidentId);
    if (pkg) {
      eido.extensions = { additionalData: pkg };
    }
  }

  await ng911AssistStore.putEido(eido);

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    incidentId,
    actorId: "system",
    type: AUDIT_EVENT_TYPES.EIDO_EXPORTED,
    details: { includeAdditionalData },
    createdAt: now,
    resourceType: "incident",
    resourceId: incidentId,
  });

  return eido;
}

export async function getStoredEido(
  agencyId: string,
  incidentId: string,
): Promise<EidoDocument | null> {
  return ng911AssistStore.getEido(agencyId, incidentId);
}

async function appendIncidentSummaryNote(
  incident: Incident,
  note: string,
): Promise<void> {
  const now = new Date().toISOString();
  const trimmedNote = note.trim();
  if (!trimmedNote) return;
  const combined = [incident.summary, `[EIDO import ${now}] ${trimmedNote}`]
    .filter((part) => part && part.trim().length > 0)
    .join("\n\n")
    .slice(0, 4000);

  await ddb.send(
    new UpdateCommand({
      TableName: env.incidentsTable,
      Key: { incidentId: incident.incidentId },
      UpdateExpression: "SET summary = :s, updatedAt = :u",
      ExpressionAttributeValues: { ":s": combined, ":u": now },
    }),
  );
}

/**
 * Imports an externally-produced EIDO document. When `sourceIncidentId` (or `incidentId`)
 * matches an existing agency incident, the EIDO is stored and, if it carries notes, appended
 * to the incident summary. Otherwise a new incident is created only when explicitly allowed.
 */
export async function importEido(
  user: UserContext,
  body: EidoImportBody,
): Promise<{ eido: EidoDocument; incidentId: string; created: boolean }> {
  const eido = eidoDocumentSchema.parse(body.eido);
  if (eido.agencyId !== user.agencyId) throw new Error("FORBIDDEN");

  const targetIncidentId = eido.sourceIncidentId?.trim() || eido.incidentId;
  let incident = await incidentRepo.get(targetIncidentId);
  if (incident && incident.agencyId !== user.agencyId) throw new Error("FORBIDDEN");

  let created = false;

  if (!incident) {
    if (!body.createIncidentIfMissing) throw new Error("NOT_FOUND");

    const now = new Date().toISOString();
    incident = {
      incidentId: targetIncidentId,
      agencyId: user.agencyId,
      title: eido.incidentType ? `EIDO import — ${eido.incidentType}` : "EIDO import",
      category: mapIncidentTypeToCategory(eido.incidentType),
      urgency: mapPriorityToUrgency(eido.priority),
      status: mapEidoStatusToIncident(eido.status),
      source: "cad",
      confidence: null,
      escalationFlag: false,
      summary: eido.summary?.trim() || "Imported from external EIDO document.",
      createdAt: eido.createdAt ?? now,
      updatedAt: now,
      callerAddressLine: eido.location?.civicAddress ?? null,
      callerLocationLat: eido.location?.latitude ?? null,
      callerLocationLng: eido.location?.longitude ?? null,
      callerCallback: eido.call?.callerPhoneE164 ?? null,
      callerLanguage: eido.call?.callLanguage ?? null,
    };
    await incidentRepo.create(incident);
    created = true;
  } else if (eido.notes?.trim()) {
    await appendIncidentSummaryNote(incident, eido.notes);
  }

  const storedEido: EidoDocument = {
    ...eido,
    incidentId: incident.incidentId,
    sourceIncidentId: incident.incidentId,
  };
  await ng911AssistStore.putEido(storedEido);

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: user.agencyId,
    incidentId: incident.incidentId,
    actorId: user.userId,
    type: AUDIT_EVENT_TYPES.EIDO_IMPORTED,
    details: { created, sourceIncidentId: eido.sourceIncidentId ?? null },
    createdAt: new Date().toISOString(),
    resourceType: "incident",
    resourceId: incident.incidentId,
  });

  return { eido: storedEido, incidentId: incident.incidentId, created };
}
