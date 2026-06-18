import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { VenueIncidentStatusPatch, VenueIncidentUpdateBody } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { VENUE_KEYS } from "../../venue/venue-types.js";
import {
  broadcastVenueIncidentStatusChanged,
  broadcastVenueIncidentUpdate,
} from "../../venue/venue-incident-realtime.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

function venueConfigTable(): string {
  const t = process.env.VENUE_CONFIG_TABLE?.trim();
  if (!t) throw new Error("VENUE_CONFIG_TABLE not set");
  return t;
}

export type VenueIncidentUpdateRecord = {
  updateId: string;
  incidentId: string;
  message: string;
  actorId: string;
  actorLabel: string;
  createdAt: string;
};

async function getIncident(venueCode: string, incidentId: string) {
  const result = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.incidentPk(venueCode),
        sk: `INCIDENT#${incidentId}`,
      },
    }),
  );
  return result.Item ?? null;
}

export async function listVenueIncidentUpdates(
  venueCode: string,
  incidentId: string,
): Promise<VenueIncidentUpdateRecord[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: venueConfigTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": VENUE_KEYS.incidentPk(venueCode),
        ":prefix": `INCIDENT#${incidentId}#UPDATE#`,
      },
      ScanIndexForward: true,
      Limit: 100,
    }),
  );
  return (result.Items ?? []).map((row) => ({
    updateId: String(row.updateId ?? ""),
    incidentId,
    message: String(row.message ?? ""),
    actorId: String(row.actorId ?? ""),
    actorLabel: String(row.actorLabel ?? "Dispatcher"),
    createdAt: String(row.createdAt ?? ""),
  }));
}

export async function postVenueIncidentUpdate(params: {
  agencyId: string;
  venueCode: string;
  incidentId: string;
  actorId: string;
  actorLabel: string;
  body: VenueIncidentUpdateBody;
}): Promise<VenueIncidentUpdateRecord> {
  const incident = await getIncident(params.venueCode, params.incidentId);
  if (!incident) throw Object.assign(new Error("Incident not found"), { statusCode: 404 });

  const now = new Date().toISOString();
  const updateId = makeId("upd");
  const record: VenueIncidentUpdateRecord = {
    updateId,
    incidentId: params.incidentId,
    message: params.body.message.trim(),
    actorId: params.actorId,
    actorLabel: params.actorLabel,
    createdAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: {
        pk: VENUE_KEYS.incidentPk(params.venueCode),
        sk: `INCIDENT#${params.incidentId}#UPDATE#${now}#${updateId}`,
        agencyId: params.agencyId,
        ...record,
      },
    }),
  );

  await ddb.send(
    new UpdateCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.incidentPk(params.venueCode),
        sk: `INCIDENT#${params.incidentId}`,
      },
      UpdateExpression: "SET updatedAt = :u",
      ExpressionAttributeValues: { ":u": now },
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: params.agencyId,
    incidentId: params.incidentId,
    actorId: params.actorId,
    type: AUDIT_EVENT_TYPES.VENUE_INCIDENT_UPDATE_POSTED,
    details: { updateId, messagePreview: record.message.slice(0, 120) },
    createdAt: now,
    resourceType: "incident",
    resourceId: params.incidentId,
  });

  await broadcastVenueIncidentUpdate({
    agencyId: params.agencyId,
    incidentId: params.incidentId,
    updateId,
    message: record.message,
    actorLabel: record.actorLabel,
    createdAt: now,
  });

  return record;
}

export async function patchVenueIncidentStatus(params: {
  agencyId: string;
  venueCode: string;
  incidentId: string;
  actorId: string;
  actorLabel: string;
  body: VenueIncidentStatusPatch;
}): Promise<{ status: string; updatedAt: string }> {
  const incident = await getIncident(params.venueCode, params.incidentId);
  if (!incident) throw Object.assign(new Error("Incident not found"), { statusCode: 404 });

  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.incidentPk(params.venueCode),
        sk: `INCIDENT#${params.incidentId}`,
      },
      UpdateExpression: "SET #st = :status, updatedAt = :u",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: { ":status": params.body.status, ":u": now },
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: params.agencyId,
    incidentId: params.incidentId,
    actorId: params.actorId,
    type: AUDIT_EVENT_TYPES.VENUE_INCIDENT_STATUS_CHANGED,
    details: { status: params.body.status },
    createdAt: now,
    resourceType: "incident",
    resourceId: params.incidentId,
  });

  await broadcastVenueIncidentStatusChanged({
    agencyId: params.agencyId,
    incidentId: params.incidentId,
    status: params.body.status,
    actorLabel: params.actorLabel,
    updatedAt: now,
  });

  return { status: params.body.status, updatedAt: now };
}
