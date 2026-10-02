/**
 * Feature 5–8: MCI, Critical Infrastructure, Interpreter, Evidence
 * Integration export: createEvidenceRecord
 */

import { randomUUID } from "crypto";
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  FEATURES_AUDIT_EVENT_TYPES,
  activateMciRequestSchema,
  addMciPatientRequestSchema,
  updateHospitalCapacityRequestSchema,
  transportPatientRequestSchema,
  upsertInfraRequestSchema,
  upsertProtocolRequestSchema,
  requestInterpreterRequestSchema,
  completeInterpreterRequestSchema,
  createEvidenceRequestSchema,
  evidenceHoldRequestSchema,
  publicRecordsRequestSchema,
  type MCIEvent,
  type MCIPatient,
  type HospitalCapacityEntry,
  type CriticalInfrastructure,
  type IncidentProtocol,
  type InterpreterRequest,
  type LanguageAccessRecord,
  type EvidenceRecord,
  type ChainOfCustodyEntry,
  type PublicRecordsRequest,
} from "rapid-cortex-shared";
import {
  ddb,
  s3,
  FeatureTables,
  FeatureBuckets,
  MciKeys,
  InfraKeys,
  InterpreterKeys,
  EvidenceKeys,
  agencyPk,
} from "./tables.js";
import {
  FeatureError,
  featureBadRequest,
  featureNotFound,
  writeFeatureAudit,
  type FeatureActor,
} from "./errors.js";

function parseOrThrow<T>(
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } } },
  body: unknown,
): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  }
  return parsed.data;
}

// ── MCI ──────────────────────────────────────────────────────────────────────

/**
 * Resolve an MCI event by mciId alone (cross-agency lookup via GSI).
 * Prefer agency-scoped Gets when actor.agencyId is known.
 */
export async function getMCIEvent(mciId: string): Promise<MCIEvent | null> {
  const gsiRes = await ddb.send(
    new QueryCommand({
      TableName: FeatureTables.mci(),
      IndexName: "mci-id-index",
      KeyConditionExpression: "mciId = :id",
      ExpressionAttributeValues: { ":id": mciId },
      Limit: 1,
    }),
  );
  const gsiItem = gsiRes.Items?.[0] as { pk?: string; sk?: string } | undefined;
  if (!gsiItem?.pk || !gsiItem?.sk) return null;

  const res = await ddb.send(
    new GetCommand({
      TableName: FeatureTables.mci(),
      Key: { pk: gsiItem.pk, sk: gsiItem.sk },
    }),
  );
  return (res.Item as MCIEvent | undefined) ?? null;
}


export async function activateMCI(
  actor: FeatureActor,
  bodyUnknown: unknown,
): Promise<{ mciId: string; message: string }> {
  const body = parseOrThrow(activateMciRequestSchema, bodyUnknown);
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();
  const mciId = randomUUID();

  const mci: MCIEvent = {
    pk: MciKeys.event(agencyId, mciId).pk,
    sk: MciKeys.event(agencyId, mciId).sk,
    mciId,
    agencyId,
    name: body.name,
    incidentType: body.incidentType ?? "MCI",
    location: body.location,
    status: "active",
    severity: body.severity ?? "major",
    casualtyEstimate: body.casualtyEstimate,
    commanderUserId: actor.userId,
    commanderName: actor.displayName,
    linkedIncidentId: body.linkedIncidentId,
    linkedCADIncidentId: body.linkedCADIncidentId,
    triageSummary: {
      red: 0,
      yellow: 0,
      green: 0,
      black: 0,
      gray: 0,
      total: 0,
      transported: 0,
      awaiting: 0,
    },
    hospitalBoard: [],
    activatedAt: now,
    updatedAt: now,
    gsi1pk: "STATUS#active",
    gsi1sk: `ACTIVATED#${now}`,
  };

  await ddb.send(new PutCommand({ TableName: FeatureTables.mci(), Item: mci }));
  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.MCI_ACTIVATED,
    details: { mciId, name: body.name },
    incidentId: body.linkedIncidentId,
    resourceId: mciId,
  });
  return { mciId, message: "MCI activated — command console ready" };
}

export async function getMCIStatus(
  actor: FeatureActor,
  mciId: string,
): Promise<{ mci: MCIEvent; patients: MCIPatient[] }> {
  const agencyId = actor.agencyId;
  const res = await ddb.send(
    new GetCommand({
      TableName: FeatureTables.mci(),
      Key: MciKeys.event(agencyId, mciId),
    }),
  );
  const mci = res.Item as MCIEvent | undefined;
  if (!mci || mci.agencyId !== agencyId) throw featureNotFound("MCI not found");

  const patientsRes = await ddb.send(
    new QueryCommand({
      TableName: FeatureTables.mci(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": MciKeys.patientPrefix(mciId).pk,
        ":prefix": MciKeys.patientPrefix(mciId).prefix,
      },
    }),
  );
  return { mci, patients: (patientsRes.Items ?? []) as MCIPatient[] };
}

export async function addTriagePatient(
  actor: FeatureActor,
  mciId: string,
  bodyUnknown: unknown,
): Promise<{ patientId: string }> {
  const body = parseOrThrow(addMciPatientRequestSchema, bodyUnknown);
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();
  const patientId = randomUUID();

  const mciRes = await ddb.send(
    new GetCommand({ TableName: FeatureTables.mci(), Key: MciKeys.event(agencyId, mciId) }),
  );
  if (!mciRes.Item) throw featureNotFound("MCI not found");

  const patient: MCIPatient = {
    pk: MciKeys.patient(mciId, patientId).pk,
    sk: MciKeys.patient(mciId, patientId).sk,
    patientId,
    mciId,
    tagNumber: body.tagNumber,
    triageColor: body.triageColor,
    zone: body.zone,
    chiefComplaint: body.chiefComplaint,
    age: body.age,
    sex: body.sex,
    vitalSigns: body.vitalSigns,
    transportStatus: "awaiting",
    lastUpdatedAt: now,
    updatedBy: actor.userId,
  };

  await ddb.send(new PutCommand({ TableName: FeatureTables.mci(), Item: patient }));
  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.mci(),
      Key: MciKeys.event(agencyId, mciId),
      UpdateExpression: `
        SET updatedAt = :now,
            triageSummary.#color = triageSummary.#color + :one,
            triageSummary.total = triageSummary.total + :one,
            triageSummary.awaiting = triageSummary.awaiting + :one
      `,
      ExpressionAttributeNames: { "#color": body.triageColor },
      ExpressionAttributeValues: { ":now": now, ":one": 1 },
    }),
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.MCI_PATIENT_ADDED,
    details: { mciId, patientId, triageColor: body.triageColor },
    resourceId: patientId,
  });
  return { patientId };
}

export async function updatePatientTransport(
  actor: FeatureActor,
  mciId: string,
  patientId: string,
  bodyUnknown: unknown,
): Promise<{ updated: boolean }> {
  const body = parseOrThrow(transportPatientRequestSchema, bodyUnknown);
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();

  const mciRes = await ddb.send(
    new GetCommand({ TableName: FeatureTables.mci(), Key: MciKeys.event(agencyId, mciId) }),
  );
  if (!mciRes.Item) throw featureNotFound("MCI not found");

  const sets = [
    "transportStatus = :ts",
    "assignedHospital = :hosp",
    "assignedUnit = :unit",
    "lastUpdatedAt = :now",
    "updatedBy = :uid",
  ];
  const values: Record<string, unknown> = {
    ":ts": body.transportStatus,
    ":hosp": body.hospital ?? null,
    ":unit": body.unit ?? null,
    ":now": now,
    ":uid": actor.userId,
  };
  if (body.departed) {
    sets.push("departedAt = :dt");
    values[":dt"] = now;
  }
  if (body.arrived) {
    sets.push("arrivedAt = :at");
    values[":at"] = now;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.mci(),
      Key: MciKeys.patient(mciId, patientId),
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(pk)",
    }),
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.MCI_PATIENT_TRANSPORTED,
    details: { mciId, patientId, transportStatus: body.transportStatus },
    resourceId: patientId,
  });
  return { updated: true };
}

export async function updateHospitalBoard(
  actor: FeatureActor,
  mciId: string,
  bodyUnknown: unknown,
): Promise<{ updated: boolean }> {
  const body = parseOrThrow(updateHospitalCapacityRequestSchema, bodyUnknown);
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.mci(),
      Key: MciKeys.event(agencyId, mciId),
      UpdateExpression: "SET hospitalBoard = :hb, updatedAt = :now",
      ExpressionAttributeValues: { ":hb": body.hospitals as HospitalCapacityEntry[], ":now": now },
      ConditionExpression: "attribute_exists(pk)",
    }),
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.MCI_HOSPITAL_CAPACITY_UPDATED,
    details: { mciId, hospitalCount: body.hospitals.length },
    resourceId: mciId,
  });
  return { updated: true };
}

// ── Infrastructure ───────────────────────────────────────────────────────────

export async function upsertInfrastructure(
  actor: FeatureActor,
  infraId: string | undefined,
  bodyUnknown: unknown,
): Promise<{ infraId: string }> {
  const body = parseOrThrow(upsertInfraRequestSchema, bodyUnknown);
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();
  const id = infraId ?? body.infraId ?? randomUUID();

  const existing = await ddb.send(
    new GetCommand({ TableName: FeatureTables.infra(), Key: InfraKeys.item(agencyId, id) }),
  );
  const prior = existing.Item as CriticalInfrastructure | undefined;

  const infra: CriticalInfrastructure = {
    pk: InfraKeys.item(agencyId, id).pk,
    sk: InfraKeys.item(agencyId, id).sk,
    infraId: id,
    agencyId,
    name: body.name,
    infraType: body.infraType,
    address: body.address,
    primaryContact: body.primaryContact,
    afterHoursContact: body.afterHoursContact,
    securityContact: body.securityContact,
    occupancyLoad: body.occupancyLoad,
    operatingHours: body.operatingHours,
    floorPlans: prior?.floorPlans ?? [],
    protocols: prior?.protocols ?? [],
    hazards: prior?.hazards ?? [],
    utilities: body.utilities,
    stagingAreas: body.stagingAreas,
    accessPoints: body.accessPoints,
    notes: body.notes,
    cleryActReporting: body.cleryActReporting,
    createdAt: prior?.createdAt ?? now,
    updatedAt: now,
    gsi1pk: `TYPE#${body.infraType}`,
    gsi1sk: agencyPk(agencyId),
  };

  await ddb.send(new PutCommand({ TableName: FeatureTables.infra(), Item: infra }));
  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.INFRA_UPSERTED,
    details: { infraId: id, infraType: body.infraType },
    resourceId: id,
  });
  return { infraId: id };
}

export async function listInfrastructure(
  actor: FeatureActor,
  infraType?: string,
): Promise<{ infrastructure: CriticalInfrastructure[]; total: number }> {
  const agencyId = actor.agencyId;
  let res;
  if (infraType) {
    try {
      res = await ddb.send(
        new QueryCommand({
          TableName: FeatureTables.infra(),
          IndexName: "type-agency-index",
          KeyConditionExpression: "gsi1pk = :type AND gsi1sk = :agency",
          ExpressionAttributeValues: {
            ":type": `TYPE#${infraType}`,
            ":agency": agencyPk(agencyId),
          },
        }),
      );
    } catch {
      res = await ddb.send(
        new QueryCommand({
          TableName: FeatureTables.infra(),
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
          FilterExpression: "infraType = :type",
          ExpressionAttributeValues: {
            ":pk": agencyPk(agencyId),
            ":prefix": InfraKeys.prefix,
            ":type": infraType,
          },
        }),
      );
    }
  } else {
    res = await ddb.send(
      new QueryCommand({
        TableName: FeatureTables.infra(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": agencyPk(agencyId),
          ":prefix": InfraKeys.prefix,
        },
      }),
    );
  }
  return {
    infrastructure: (res.Items ?? []) as CriticalInfrastructure[],
    total: res.Count ?? 0,
  };
}

export async function upsertProtocol(
  actor: FeatureActor,
  infraId: string,
  protocolId: string | undefined,
  bodyUnknown: unknown,
): Promise<{ protocolId: string }> {
  const body = parseOrThrow(upsertProtocolRequestSchema, bodyUnknown);
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();
  const id = protocolId ?? body.protocolId ?? randomUUID();

  const res = await ddb.send(
    new GetCommand({ TableName: FeatureTables.infra(), Key: InfraKeys.item(agencyId, infraId) }),
  );
  const existing = res.Item as CriticalInfrastructure | undefined;
  if (!existing) throw featureNotFound("Infrastructure not found");

  const protocol: IncidentProtocol = {
    protocolId: id,
    incidentType: body.incidentType,
    title: body.title,
    steps: body.steps,
    contacts: body.contacts,
    resources: body.resources,
    lastUpdatedAt: now,
  };
  const protocols = [
    ...(existing.protocols ?? []).filter((p) => p.protocolId !== id),
    protocol,
  ];

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.infra(),
      Key: InfraKeys.item(agencyId, infraId),
      UpdateExpression: "SET protocols = :p, updatedAt = :now",
      ExpressionAttributeValues: { ":p": protocols, ":now": now },
    }),
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.INFRA_PROTOCOL_UPSERTED,
    details: { infraId, protocolId: id },
    resourceId: id,
  });
  return { protocolId: id };
}

// ── Interpreter ──────────────────────────────────────────────────────────────

export async function requestInterpreter(
  actor: FeatureActor,
  bodyUnknown: unknown,
): Promise<{ requestId: string; status: string; message: string }> {
  const body = parseOrThrow(requestInterpreterRequestSchema, bodyUnknown);
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();
  const requestId = randomUUID();

  const request: InterpreterRequest = {
    pk: InterpreterKeys.request(agencyId, requestId).pk,
    sk: InterpreterKeys.request(agencyId, requestId).sk,
    requestId,
    agencyId,
    incidentId: body.incidentId,
    dispatcherId: actor.userId,
    language: body.language,
    languageDisplayName: body.languageDisplayName,
    triggerReason: body.triggerReason ?? "dispatcher_request",
    aiConfidenceAtEscalation: body.aiConfidence,
    method: body.method ?? "live_phone_interpreter",
    status: "pending",
    serviceProvider: body.serviceProvider ?? process.env.DEFAULT_INTERPRETER_SERVICE,
    requestedAt: now,
  };

  await ddb.send(new PutCommand({ TableName: FeatureTables.interpreter(), Item: request }));
  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.INTERPRETER_REQUESTED,
    details: { requestId, language: body.language },
    incidentId: body.incidentId,
    resourceId: requestId,
  });
  return { requestId, status: "pending", message: "Interpreter being connected" };
}

export async function updateInterpreterStatus(
  actor: FeatureActor,
  requestId: string,
  bodyUnknown: unknown,
): Promise<{ updated: boolean; status: string }> {
  const body = parseOrThrow(completeInterpreterRequestSchema, bodyUnknown);
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = { ":status": body.status, ":now": now };
  let expr = "SET #status = :status";
  if (body.status === "connected") {
    expr += ", connectedAt = :now, connectionStartedAt = if_not_exists(connectionStartedAt, :now)";
  }
  if (body.status === "completed") {
    updates[":resolved"] = now;
    expr += ", resolvedAt = :resolved";
    if (body.durationSeconds !== undefined) {
      updates[":dur"] = body.durationSeconds;
      expr += ", durationSeconds = :dur";
    }
    if (body.callQuality) {
      updates[":q"] = body.callQuality;
      expr += ", callQuality = :q";
    }
    const record: LanguageAccessRecord = {
      pk: agencyPk(agencyId),
      sk: `${InterpreterKeys.lepPrefix(String(new Date().getFullYear()), String(new Date().getMonth() + 1))}#${randomUUID()}`,
      recordId: randomUUID(),
      agencyId,
      incidentId: body.incidentId ?? requestId,
      language: body.language ?? "und",
      methodsUsed: body.method ? [body.method] : ["live_phone_interpreter"],
      totalDurationSeconds: body.durationSeconds ?? 0,
      adequateLanguageAccess: body.callQuality !== "poor",
      date: now.slice(0, 10),
    };
    await ddb.send(new PutCommand({ TableName: FeatureTables.interpreter(), Item: record }));
  }

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.interpreter(),
      Key: InterpreterKeys.request(agencyId, requestId),
      UpdateExpression: expr,
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: updates,
      ConditionExpression: "attribute_exists(pk)",
    }),
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.INTERPRETER_COMPLETED,
    details: { requestId, status: body.status },
    resourceId: requestId,
  });
  return { updated: true, status: body.status };
}

export async function listInterpreterRequests(
  actor: FeatureActor,
): Promise<{ requests: InterpreterRequest[] }> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: FeatureTables.interpreter(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": agencyPk(actor.agencyId),
        ":prefix": InterpreterKeys.prefix,
      },
      ScanIndexForward: false,
      Limit: 50,
    }),
  );
  return { requests: (res.Items ?? []) as InterpreterRequest[] };
}

// ── Evidence ─────────────────────────────────────────────────────────────────

export type CreateEvidenceRecordInput = {
  agencyId: string;
  actorId: string;
  actorName?: string;
  actorRole?: string;
  incidentId: string;
  evidenceType: EvidenceRecord["evidenceType"];
  sourceMethod?: EvidenceRecord["sourceMethod"];
  originalFilename?: string;
  mimeType: string;
  fileSizeBytes?: number;
  sha256Hash?: string;
  retentionDays?: number;
  /** When linking an existing media object, skip generating a new evidence-bucket key/URL. */
  existingS3Key?: string;
  existingS3Bucket?: string;
};

/**
 * Integration helper — create evidence + optional presigned upload URL.
 * agencyId must come from verified context / trusted system caller.
 */
export async function createEvidenceRecord(
  input: CreateEvidenceRecordInput,
): Promise<{ evidenceId: string; uploadUrl?: string; s3Key: string }> {
  const parsed = createEvidenceRequestSchema.safeParse({
    incidentId: input.incidentId,
    evidenceType: input.evidenceType,
    sourceMethod: input.sourceMethod,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    sha256Hash: input.sha256Hash,
    retentionDays: input.retentionDays,
  });
  if (!parsed.success) {
    throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid evidence input");
  }
  const body = parsed.data;
  const agencyId = input.agencyId;
  const now = new Date().toISOString();
  const evidenceId = randomUUID();
  const linkingExisting = Boolean(input.existingS3Key);
  const bucket =
    input.existingS3Bucket?.trim() || FeatureBuckets.evidence() || "";
  const s3Key =
    input.existingS3Key?.trim() ||
    `evidence/${agencyId}/${body.incidentId}/${evidenceId}-${body.originalFilename ?? "file"}`;
  const retentionDays =
    body.retentionDays ?? (body.evidenceType === "transcript" ? 365 : 1825);

  const record: EvidenceRecord = {
    pk: EvidenceKeys.item(agencyId, evidenceId).pk,
    sk: EvidenceKeys.item(agencyId, evidenceId).sk,
    evidenceId,
    agencyId,
    incidentId: body.incidentId,
    evidenceType: body.evidenceType,
    sourceMethod: body.sourceMethod ?? "caller_upload",
    originalFilename: body.originalFilename,
    s3Key,
    s3Bucket: bucket,
    mimeType: body.mimeType,
    fileSizeBytes: body.fileSizeBytes ?? 0,
    sha256Hash: body.sha256Hash ?? "",
    status: "active",
    chain: [
      {
        entryId: randomUUID(),
        action: "created",
        userId: input.actorId,
        userName: input.actorName ?? input.actorId,
        userRole: input.actorRole ?? "SYSTEM",
        purpose: linkingExisting
          ? `Evidence linked from existing media object`
          : `Evidence created from ${body.sourceMethod ?? "caller_upload"}`,
        timestamp: now,
      },
    ],
    publicRecordsRequests: [],
    retentionDays,
    purgeAt: new Date(Date.now() + retentionDays * 86400000).toISOString(),
    uploadedAt: now,
  };

  await ddb.send(new PutCommand({ TableName: FeatureTables.evidence(), Item: record }));

  let uploadUrl: string | undefined;
  if (!linkingExisting && bucket) {
    uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        ContentType: body.mimeType,
        Metadata: {
          evidenceId,
          agencyId,
          incidentId: body.incidentId,
          uploadedBy: input.actorId,
        },
      }),
      { expiresIn: 900 },
    );
  } else if (!linkingExisting && !bucket) {
    console.warn("[features] EVIDENCE_BUCKET missing — skipping upload URL");
  }

  await writeFeatureAudit({
    agencyId,
    actorId: input.actorId,
    type: FEATURES_AUDIT_EVENT_TYPES.EVIDENCE_CREATED,
    details: { evidenceId, incidentId: body.incidentId },
    incidentId: body.incidentId,
    resourceId: evidenceId,
  });

  return { evidenceId, uploadUrl, s3Key };
}

export async function createEvidenceForHttp(
  actor: FeatureActor,
  bodyUnknown: unknown,
): Promise<{ evidenceId: string; uploadUrl?: string; s3Key: string }> {
  const body = parseOrThrow(createEvidenceRequestSchema, bodyUnknown);
  return createEvidenceRecord({
    agencyId: actor.agencyId,
    actorId: actor.userId,
    actorName: actor.displayName,
    actorRole: actor.role,
    ...body,
  });
}

export async function listEvidenceForIncident(
  actor: FeatureActor,
  incidentId: string,
): Promise<{ evidence: EvidenceRecord[]; total: number }> {
  const agencyId = actor.agencyId;
  try {
    const res = await ddb.send(
      new QueryCommand({
        TableName: FeatureTables.evidence(),
        IndexName: "incident-index",
        KeyConditionExpression: "pk = :pk AND incidentId = :iid",
        ExpressionAttributeValues: { ":pk": agencyPk(agencyId), ":iid": incidentId },
      }),
    );
    return { evidence: (res.Items ?? []) as EvidenceRecord[], total: res.Count ?? 0 };
  } catch {
    const res = await ddb.send(
      new QueryCommand({
        TableName: FeatureTables.evidence(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        FilterExpression: "incidentId = :iid",
        ExpressionAttributeValues: {
          ":pk": agencyPk(agencyId),
          ":prefix": EvidenceKeys.prefix,
          ":iid": incidentId,
        },
      }),
    );
    return { evidence: (res.Items ?? []) as EvidenceRecord[], total: res.Count ?? 0 };
  }
}

export async function placeEvidenceHold(
  actor: FeatureActor,
  evidenceId: string,
  bodyUnknown: unknown,
): Promise<{ held: boolean; holdOrderedAt: string }> {
  const body = parseOrThrow(evidenceHoldRequestSchema, bodyUnknown);
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();

  const res = await ddb.send(
    new GetCommand({
      TableName: FeatureTables.evidence(),
      Key: EvidenceKeys.item(agencyId, evidenceId),
    }),
  );
  const record = res.Item as EvidenceRecord | undefined;
  if (!record) throw featureNotFound("Evidence not found");

  const entry: ChainOfCustodyEntry = {
    entryId: randomUUID(),
    action: "hold_placed",
    userId: actor.userId,
    userName: actor.displayName ?? actor.userId,
    userRole: actor.role,
    purpose: body.holdReason,
    timestamp: now,
  };

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.evidence(),
      Key: EvidenceKeys.item(agencyId, evidenceId),
      UpdateExpression: `
        SET #status = :held,
            holdReason = :reason,
            holdOrderedBy = :uid,
            holdOrderedAt = :now,
            chain = :chain,
            purgeAt = :never
      `,
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":held": "under_hold",
        ":reason": body.holdReason,
        ":uid": actor.userId,
        ":now": now,
        ":chain": [...record.chain, entry],
        ":never": "9999-12-31T23:59:59Z",
      },
    }),
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.EVIDENCE_HOLD_PLACED,
    details: { evidenceId, holdReason: body.holdReason },
    incidentId: record.incidentId,
    resourceId: evidenceId,
  });
  return { held: true, holdOrderedAt: now };
}

export async function downloadEvidence(
  actor: FeatureActor,
  evidenceId: string,
): Promise<{ recorded: boolean; downloadUrl?: string }> {
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();
  const res = await ddb.send(
    new GetCommand({
      TableName: FeatureTables.evidence(),
      Key: EvidenceKeys.item(agencyId, evidenceId),
    }),
  );
  const record = res.Item as EvidenceRecord | undefined;
  if (!record) throw featureNotFound("Evidence not found");

  const entry: ChainOfCustodyEntry = {
    entryId: randomUUID(),
    action: "downloaded",
    userId: actor.userId,
    userName: actor.displayName ?? actor.userId,
    userRole: actor.role,
    purpose: "Authorized download",
    timestamp: now,
  };

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.evidence(),
      Key: EvidenceKeys.item(agencyId, evidenceId),
      UpdateExpression: "SET chain = :c",
      ExpressionAttributeValues: { ":c": [...record.chain, entry] },
    }),
  );

  let downloadUrl: string | undefined;
  const bucket = record.s3Bucket || FeatureBuckets.evidence();
  if (bucket) {
    downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: record.s3Key }),
      { expiresIn: 300 },
    );
  } else {
    console.warn("[features] evidence bucket missing — no download URL");
  }

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.EVIDENCE_ACCESSED,
    details: { evidenceId, action: "downloaded" },
    incidentId: record.incidentId,
    resourceId: evidenceId,
  });
  return { recorded: true, downloadUrl };
}

export async function createPublicRecordsRequest(
  actor: FeatureActor,
  evidenceId: string,
  bodyUnknown: unknown,
): Promise<{ requestId: string }> {
  const body = parseOrThrow(publicRecordsRequestSchema, bodyUnknown);
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();

  const res = await ddb.send(
    new GetCommand({
      TableName: FeatureTables.evidence(),
      Key: EvidenceKeys.item(agencyId, evidenceId),
    }),
  );
  if (!res.Item) throw featureNotFound("Evidence not found");

  const request: PublicRecordsRequest = {
    requestId: randomUUID(),
    requestorName: body.requestorName,
    requestorOrg: body.requestorOrg,
    requestorEmail: body.requestorEmail,
    requestedAt: now,
    dueDate: body.dueDate,
    status: "pending",
    redactionRequired: body.redactionRequired ?? false,
    redactionReason: body.redactionReason,
    notes: body.notes,
  };

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.evidence(),
      Key: EvidenceKeys.item(agencyId, evidenceId),
      UpdateExpression:
        "SET publicRecordsRequests = list_append(if_not_exists(publicRecordsRequests, :empty), :req)",
      ExpressionAttributeValues: { ":req": [request], ":empty": [] },
    }),
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.EVIDENCE_PUBLIC_RECORDS_REQUESTED,
    details: { evidenceId, requestId: request.requestId },
    resourceId: evidenceId,
  });
  return { requestId: request.requestId };
}

void FeatureError;
