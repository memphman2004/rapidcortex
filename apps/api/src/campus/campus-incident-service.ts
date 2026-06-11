import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { z } from "zod";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import type {
  CampusIncident,
  CampusIncidentNote,
  CampusIncidentStatus,
  CampusIncidentType,
} from "./campus-types.js";
import { CAMPUS_KEYS } from "./campus-types.js";
import type { createIncidentSchema, updateIncidentSchema } from "./campus-schemas.js";
import { isConfidentialType, legalStatusTransition } from "./campus-schemas.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

function campusIncidentsTable(): string {
  const t = process.env.CAMPUS_INCIDENTS_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_INCIDENTS_TABLE not set");
  return t;
}

export function campusMediaBucket(): string {
  return process.env.ASSETS_BUCKET?.trim() ?? "";
}

export function makeIncidentId(campusCode: string): string {
  const year = new Date().getFullYear();
  const seq = String(Date.now()).slice(-6);
  return `${campusCode}-${year}-${seq}`;
}

export async function createCampusIncident(
  input: z.infer<typeof createIncidentSchema>,
  agencyId: string,
  actorId?: string,
): Promise<CampusIncident> {
  const id = makeIncidentId(input.campusCode);
  const now = new Date().toISOString();
  const confidential = input.confidential ?? isConfidentialType(input.type);

  const item: CampusIncident = {
    pk: CAMPUS_KEYS.incidentPk(input.campusCode),
    sk: CAMPUS_KEYS.incidentSk(id),
    id,
    campusCode: input.campusCode,
    buildingCode: input.buildingCode,
    buildingLabel: input.buildingCode,
    floor: input.floor ?? null,
    roomCode: input.roomCode ?? "",
    zoneCode: input.zoneCode ?? input.roomCode ?? undefined,
    zoneLabel: input.qrLocationName
      ? `${input.qrLocationName} · Zone ${input.zoneCode ?? input.roomCode}`
      : [input.buildingCode, input.roomCode].filter(Boolean).join(" · "),
    qrRcli: input.qrRcli,
    qrLocationName: input.qrLocationName,
    type: input.type,
    source: input.source,
    status: "open",
    description: input.description,
    isAnonymous: input.isAnonymous,
    confidential,
    assignedTo: null,
    assignedToName: null,
    cameraRefs: [],
    hasMedia: false,
    mediaUrls: [],
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    cleryCategory: null,
  };

  await ddb.send(
    new PutCommand({
      TableName: campusIncidentsTable(),
      Item: item,
      ConditionExpression: "attribute_not_exists(pk)",
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    incidentId: id,
    actorId: actorId ?? "anonymous",
    type: "CAMPUS_INCIDENT_CREATED",
    details: { campusCode: input.campusCode, type: input.type, source: input.source },
    createdAt: now,
    resourceType: "incident",
    resourceId: id,
  });

  return item;
}

export async function getCampusIncident(
  campusCode: string,
  incidentId: string,
): Promise<CampusIncident | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: campusIncidentsTable(),
      Key: {
        pk: CAMPUS_KEYS.incidentPk(campusCode),
        sk: CAMPUS_KEYS.incidentSk(incidentId),
      },
    }),
  );
  return (result.Item as CampusIncident) ?? null;
}

export async function listCampusIncidents(opts: {
  campusCode: string;
  status?: CampusIncidentStatus[];
  type?: CampusIncidentType[];
  confidentialOnly?: boolean;
  limit?: number;
  cursor?: string;
}): Promise<{ incidents: CampusIncident[]; cursor?: string; total: number }> {
  const limit = opts.limit ?? 25;
  const result = await ddb.send(
    new QueryCommand({
      TableName: campusIncidentsTable(),
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": CAMPUS_KEYS.incidentPk(opts.campusCode) },
      Limit: limit + 1,
      ExclusiveStartKey: opts.cursor
        ? JSON.parse(Buffer.from(opts.cursor, "base64").toString())
        : undefined,
      ScanIndexForward: false,
    }),
  );

  let items = (result.Items ?? []).filter(
    (i) => typeof (i as { sk?: string }).sk === "string" && String((i as { sk: string }).sk).startsWith("INCIDENT#"),
  ) as CampusIncident[];

  if (opts.status?.length) {
    items = items.filter((i) => opts.status!.includes(i.status));
  }
  if (opts.type?.length) {
    items = items.filter((i) => opts.type!.includes(i.type));
  }
  if (opts.confidentialOnly) {
    items = items.filter((i) => i.confidential);
  }

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
      : undefined;

  return { incidents: page, cursor: nextCursor, total: page.length };
}

export async function updateCampusIncident(
  campusCode: string,
  incidentId: string,
  update: z.infer<typeof updateIncidentSchema>,
  actorId: string,
  actorName: string,
): Promise<CampusIncident> {
  const existing = await getCampusIncident(campusCode, incidentId);
  if (!existing) throw new Error("NOT_FOUND");

  if (update.status && !legalStatusTransition(existing.status, update.status)) {
    throw new Error(`ILLEGAL_TRANSITION:${existing.status}->${update.status}`);
  }

  const now = new Date().toISOString();
  const updates: string[] = ["updatedAt = :now"];
  const values: Record<string, unknown> = { ":now": now };

  if (update.status) {
    updates.push("#st = :status");
    values[":status"] = update.status;
    if (update.status === "resolved") {
      updates.push("resolvedAt = :now");
    }
  }
  if (update.assignedTo !== undefined) {
    updates.push("assignedTo = :at");
    values[":at"] = update.assignedTo;
  }
  if (update.assignedToName !== undefined) {
    updates.push("assignedToName = :atn");
    values[":atn"] = update.assignedToName;
  }
  if (update.cleryCategory !== undefined) {
    updates.push("cleryCategory = :cc");
    values[":cc"] = update.cleryCategory;
  }

  const result = await ddb.send(
    new UpdateCommand({
      TableName: campusIncidentsTable(),
      Key: {
        pk: CAMPUS_KEYS.incidentPk(campusCode),
        sk: CAMPUS_KEYS.incidentSk(incidentId),
      },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: update.status ? { "#st": "status" } : undefined,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    }),
  );

  if (update.status) {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: campusCode,
      incidentId,
      actorId,
      type: "CAMPUS_INCIDENT_STATUS_CHANGED",
      details: { from: existing.status, to: update.status, actorName },
      createdAt: now,
      resourceType: "incident",
      resourceId: incidentId,
    });
  }

  return result.Attributes as CampusIncident;
}

export async function addIncidentNote(
  campusCode: string,
  incidentId: string,
  content: string,
  authorId: string,
  authorName: string,
): Promise<CampusIncidentNote> {
  const noteId = makeId("note");
  const now = new Date().toISOString();
  const note: CampusIncidentNote = {
    noteId,
    incidentId,
    authorId,
    authorName,
    content,
    createdAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: campusIncidentsTable(),
      Item: {
        pk: CAMPUS_KEYS.incidentPk(campusCode),
        sk: `NOTE#${incidentId}#${noteId}`,
        ...note,
      },
    }),
  );

  return note;
}

export async function escalateCampusIncident(
  campusCode: string,
  incidentId: string,
  actorId: string,
): Promise<{ escalatedIncidentId: string }> {
  await updateCampusIncident(campusCode, incidentId, { status: "escalated" }, actorId, "system");

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: campusCode,
    incidentId,
    actorId,
    type: "CAMPUS_INCIDENT_ESCALATED_TO_CORE",
    details: { campusCode },
    createdAt: new Date().toISOString(),
    resourceType: "incident",
    resourceId: incidentId,
  });

  return { escalatedIncidentId: incidentId };
}

const OPEN_STATUSES: CampusIncidentStatus[] = ["open", "assigned", "responding"];

export async function findOpenCampusIncidentByPhoneHash(
  campusCode: string,
  phoneHash: string,
  withinMinutes = 30,
): Promise<CampusIncident | null> {
  const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
  const { incidents } = await listCampusIncidents({ campusCode, limit: 40 });
  const match = incidents.find(
    (i) =>
      i.phoneHash === phoneHash &&
      OPEN_STATUSES.includes(i.status) &&
      i.createdAt >= cutoff,
  );
  return match ?? null;
}

export async function createCampusSmsIncident(params: {
  campusCode: string;
  type: CampusIncidentType;
  description: string;
  buildingHint: string;
  roomHint: string;
  phoneHash: string;
  reporterLast4: string;
}): Promise<CampusIncident> {
  return createCampusIncident(
    {
      campusCode: params.campusCode,
      buildingCode: params.buildingHint || "UNKNOWN",
      roomCode: params.roomHint || "",
      type: params.type,
      source: "sms",
      description: params.description,
      isAnonymous: true,
    },
    params.campusCode,
    "sms-inbound",
  ).then(async (incident) => {
    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: campusIncidentsTable(),
        Key: {
          pk: CAMPUS_KEYS.incidentPk(params.campusCode),
          sk: CAMPUS_KEYS.incidentSk(incident.id),
        },
        UpdateExpression:
          "SET phoneHash = :ph, reporterLast4 = :rl4, locationLinkSent = :lls, locationData = :ld, updatedAt = :now",
        ExpressionAttributeValues: {
          ":ph": params.phoneHash,
          ":rl4": params.reporterLast4,
          ":lls": false,
          ":ld": [],
          ":now": now,
        },
      }),
    );
    return {
      ...incident,
      phoneHash: params.phoneHash,
      reporterLast4: params.reporterLast4,
      locationLinkSent: false,
      locationData: [],
    };
  });
}

export async function markCampusLocationLinkSent(
  campusCode: string,
  incidentId: string,
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: campusIncidentsTable(),
      Key: {
        pk: CAMPUS_KEYS.incidentPk(campusCode),
        sk: CAMPUS_KEYS.incidentSk(incidentId),
      },
      UpdateExpression: "SET locationLinkSent = :t, updatedAt = :now",
      ExpressionAttributeValues: {
        ":t": true,
        ":now": new Date().toISOString(),
      },
    }),
  );
}

export async function appendCampusIncidentLocation(
  campusCode: string,
  incidentId: string,
  entry: import("./campus-types.js").CampusIncidentLocationEntry,
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: campusIncidentsTable(),
      Key: {
        pk: CAMPUS_KEYS.incidentPk(campusCode),
        sk: CAMPUS_KEYS.incidentSk(incidentId),
      },
      UpdateExpression:
        "SET locationData = list_append(if_not_exists(locationData, :empty), :entry), updatedAt = :now",
      ExpressionAttributeValues: {
        ":empty": [],
        ":entry": [entry],
        ":now": new Date().toISOString(),
      },
    }),
  );
}

export async function appendCampusSmsChatMessage(
  campusCode: string,
  incidentId: string,
  body: string,
): Promise<void> {
  const message = {
    messageId: makeId("sms"),
    body,
    receivedAt: new Date().toISOString(),
  };
  await ddb.send(
    new UpdateCommand({
      TableName: campusIncidentsTable(),
      Key: {
        pk: CAMPUS_KEYS.incidentPk(campusCode),
        sk: CAMPUS_KEYS.incidentSk(incidentId),
      },
      UpdateExpression:
        "SET smsChatMessages = list_append(if_not_exists(smsChatMessages, :empty), :msg), description = :desc, updatedAt = :now",
      ExpressionAttributeValues: {
        ":empty": [],
        ":msg": [message],
        ":desc": body,
        ":now": new Date().toISOString(),
      },
    }),
  );
}
