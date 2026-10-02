/**
 * Feature 3: Alternative Response Router
 * Feature 4: Mutual Aid Resource Board
 *
 * Integration export: evaluateAlternativeResponse
 */

import { randomUUID } from "crypto";
import {
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  FEATURES_AUDIT_EVENT_TYPES,
  evaluateAltResponseRequestSchema,
  supervisorAltDecisionRequestSchema,
  altOutcomeRequestSchema,
  createMutualAidRequestSchema,
  commitMutualAidRequestSchema,
  updateCommitmentStatusRequestSchema,
  type AlternativeResponseFlag,
  type AlternativeResponseType,
  type CoResponderUnit,
  type MutualAidRequest,
  type ResourceCommitment,
  type CommittedResource,
} from "rapid-cortex-shared";
import {
  ddb,
  FeatureTables,
  AltResponseKeys,
  CoResponderKeys,
  MutualAidKeys,
  agencyPk,
} from "./tables.js";
import {
  featureBadRequest,
  featureNotFound,
  writeFeatureAudit,
  type FeatureActor,
} from "./errors.js";

const MH_PATTERNS: Record<AlternativeResponseType, RegExp[]> = {
  mental_health: [
    /\b(suicid|self.harm|harm.+(self|myself)|mental.+(health|crisis)|psych|breakdown|panic.attack|manic|bipolar|schizophrenia|hallucin|paranoid|hearing.voices)\b/i,
    /\b(therapist|psychiatrist|not.taking.meds|off.meds|welfare.check.+mental)\b/i,
  ],
  substance_use: [
    /\b(overdos|naloxone|narcan|heroin|fentanyl|drunk|intoxicat|passed.out|unresponsive.+alcohol|substance)\b/i,
  ],
  welfare_check: [
    /\b(welfare.check|haven.t.heard|not.answering|concerned.about|check.on|hasn.t.been.seen)\b/i,
  ],
  non_emergency_medical: [
    /\b(not.an.emergency|minor.injury|fell.but|tripped|small.cut|needs.medication|run.out.of.meds)\b/i,
  ],
  housing_crisis: [
    /\b(homeless|no.where.to.go|evict|sleeping.outside|living.in.car)\b/i,
  ],
  domestic_dispute_non_violent: [
    /\b(argument|yelling|fighting.but.not.hitting|verbal.dispute|domestic.but.no.weapons)\b/i,
  ],
  noise_complaint: [
    /\b(too.loud|noise.complaint|neighbor.playing|loud.music|loud.party)\b/i,
  ],
  quality_of_life: [
    /\b(panhandling|loitering|trespassing.+not.violent|quality.of.life)\b/i,
  ],
};

function detectAlternativeResponse(
  transcript: string,
): { type: AlternativeResponseType; signals: string[]; confidence: number } | null {
  for (const [type, patterns] of Object.entries(MH_PATTERNS) as [
    AlternativeResponseType,
    RegExp[],
  ][]) {
    const signals: string[] = [];
    for (const pattern of patterns) {
      const matches = transcript.match(pattern);
      if (matches) signals.push(...matches.map((m) => m.trim()));
    }
    if (signals.length > 0) {
      const confidence = Math.min(0.5 + signals.length * 0.15, 0.95);
      return { type, signals, confidence };
    }
  }
  return null;
}

/**
 * Called by transcript analysis / integration after segment analysis.
 * agencyId must come from the trusted caller (system or verified context).
 */
export async function evaluateAlternativeResponse(input: {
  agencyId: string;
  incidentId: string;
  transcript: string;
  callType?: string;
  actorId?: string;
}): Promise<{
  alternativeResponseDetected: boolean;
  flag?: AlternativeResponseFlag;
}> {
  const parsed = evaluateAltResponseRequestSchema.safeParse({
    agencyId: input.agencyId,
    incidentId: input.incidentId,
    transcript: input.transcript,
    callType: input.callType,
  });
  if (!parsed.success) throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const { agencyId, incidentId, transcript, callType } = parsed.data;
  const actorId = input.actorId;
  void callType;

  const detection = detectAlternativeResponse(transcript);
  if (!detection) return { alternativeResponseDetected: false };

  const coRes = await ddb.send(
    new QueryCommand({
      TableName: FeatureTables.coResponders(),
      KeyConditionExpression: "pk = :pk",
      FilterExpression: "currentStatus = :avail AND contains(specializations, :type)",
      ExpressionAttributeValues: {
        ":pk": agencyPk(agencyId),
        ":avail": "available",
        ":type": detection.type,
      },
    }),
  );

  const availableResources = (coRes.Items ?? []) as CoResponderUnit[];

  const flag: AlternativeResponseFlag = {
    pk: AltResponseKeys.flag(agencyId, incidentId).pk,
    sk: AltResponseKeys.flag(agencyId, incidentId).sk,
    incidentId,
    agencyId,
    flagType: detection.type,
    triggerSignals: detection.signals,
    confidence: detection.confidence,
    suggestedResources: availableResources.map((r) => ({
      resourceId: r.unitId,
      resourceType: r.type,
      name: r.unitName,
      phone: r.phone,
      availabilityStatus: r.currentStatus === "available" ? "available" : "busy",
      coverageArea: r.coverageZone,
      specializations: r.specializations,
    })),
    supervisorAlerted: false,
    createdAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: FeatureTables.altResponse(), Item: flag }));

  await writeFeatureAudit({
    agencyId,
    actorId: actorId ?? "system:evaluateAlternativeResponse",
    type: FEATURES_AUDIT_EVENT_TYPES.ALT_RESPONSE_FLAGGED,
    details: { incidentId, flagType: detection.type, confidence: detection.confidence },
    incidentId,
  });

  return { alternativeResponseDetected: true, flag };
}

export async function recordSupervisorDecision(
  actor: FeatureActor,
  incidentId: string,
  bodyUnknown: unknown,
): Promise<{ recorded: boolean; decision: string }> {
  const parsed = supervisorAltDecisionRequestSchema.safeParse(bodyUnknown);
  if (!parsed.success) throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  const now = new Date().toISOString();
  const agencyId = actor.agencyId;

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.altResponse(),
      Key: AltResponseKeys.flag(agencyId, incidentId),
      UpdateExpression:
        "SET supervisorDecision = :d, supervisorUserId = :u, supervisorDecidedAt = :now, finalDispatch = :fd",
      ExpressionAttributeValues: {
        ":d": parsed.data.decision,
        ":u": actor.userId,
        ":now": now,
        ":fd": parsed.data.finalDispatch ?? null,
      },
      ConditionExpression: "attribute_exists(pk)",
    }),
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.ALT_RESPONSE_SUPERVISOR_DECIDED,
    details: { incidentId, decision: parsed.data.decision },
    incidentId,
  });

  return { recorded: true, decision: parsed.data.decision };
}

export async function recordAlternativeOutcome(
  actor: FeatureActor,
  incidentId: string,
  bodyUnknown: unknown,
): Promise<{ recorded: boolean }> {
  const parsed = altOutcomeRequestSchema.safeParse(bodyUnknown);
  if (!parsed.success) throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  const now = new Date().toISOString();
  const agencyId = actor.agencyId;

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.altResponse(),
      Key: AltResponseKeys.flag(agencyId, incidentId),
      UpdateExpression: "SET outcome = :o",
      ExpressionAttributeValues: {
        ":o": { ...parsed.data, recordedAt: now, recordedBy: actor.userId },
      },
      ConditionExpression: "attribute_exists(pk)",
    }),
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.ALT_RESPONSE_OUTCOME_RECORDED,
    details: { incidentId, resolution: parsed.data.resolution },
    incidentId,
  });

  return { recorded: true };
}

export async function listCoResponders(
  actor: FeatureActor,
): Promise<{ coResponders: CoResponderUnit[] }> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: FeatureTables.coResponders(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": agencyPk(actor.agencyId),
        ":prefix": CoResponderKeys.prefix,
      },
    }),
  );
  return { coResponders: (res.Items ?? []) as CoResponderUnit[] };
}

export async function createMutualAidRequest(
  actor: FeatureActor,
  bodyUnknown: unknown,
): Promise<{ requestId: string; message: string }> {
  const parsed = createMutualAidRequestSchema.safeParse(bodyUnknown);
  if (!parsed.success) throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  const body = parsed.data;
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();
  const requestId = randomUUID();

  const request: MutualAidRequest = {
    pk: MutualAidKeys.request(agencyId, requestId, now).pk,
    sk: MutualAidKeys.request(agencyId, requestId, now).sk,
    requestId,
    requestingAgencyId: agencyId,
    requestingAgencyName: body.requestingAgencyName,
    incidentId: body.incidentId,
    incidentType: body.incidentType,
    priority: body.priority ?? 2,
    status: "open",
    resourcesNeeded: body.resourcesNeeded.map((r) => ({
      needId: randomUUID(),
      ...r,
      filledQuantity: 0,
    })),
    resourcesCommitted: [],
    location: body.location,
    requestNotes: body.requestNotes,
    icsFormNumber: body.icsFormNumber,
    requestedAt: now,
    neededBy: body.neededBy,
    gsi1pk: "STATUS#open",
    gsi1sk: `PRIORITY#${body.priority ?? 2}#${now}`,
  };

  await ddb.send(new PutCommand({ TableName: FeatureTables.mutualAid(), Item: request }));

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.MUTUAL_AID_REQUESTED,
    details: { requestId, priority: body.priority },
    incidentId: body.incidentId,
    resourceId: requestId,
  });

  return { requestId, message: "Mutual aid request broadcast to partner network" };
}

export async function listMutualAidRequests(
  actor: FeatureActor,
): Promise<{ requests: MutualAidRequest[]; total: number }> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: FeatureTables.mutualAid(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": agencyPk(actor.agencyId),
        ":prefix": MutualAidKeys.prefix,
      },
      ScanIndexForward: false,
      Limit: 50,
    }),
  );
  return { requests: (res.Items ?? []) as MutualAidRequest[], total: res.Count ?? 0 };
}

async function findMutualAidRequest(
  agencyId: string,
  requestId: string,
): Promise<MutualAidRequest> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: FeatureTables.mutualAid(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      FilterExpression: "requestId = :rid",
      ExpressionAttributeValues: {
        ":pk": agencyPk(agencyId),
        ":prefix": `MAID_REQ#${requestId}`,
        ":rid": requestId,
      },
      Limit: 1,
    }),
  );
  const item = res.Items?.[0] as MutualAidRequest | undefined;
  if (!item) {
    // Partner commit: look up via request-id GSI if present, then verify.
    try {
      const gsi = await ddb.send(
        new QueryCommand({
          TableName: FeatureTables.mutualAid(),
          IndexName: "request-id-index",
          KeyConditionExpression: "requestId = :rid",
          ExpressionAttributeValues: { ":rid": requestId },
          Limit: 1,
        }),
      );
      const found = gsi.Items?.[0] as MutualAidRequest | undefined;
      if (found) return found;
    } catch {
      /* GSI may not exist yet */
    }
    throw featureNotFound("Request not found");
  }
  return item;
}

export async function commitResources(
  actor: FeatureActor,
  requestId: string,
  bodyUnknown: unknown,
): Promise<{ commitmentId: string; message: string }> {
  const parsed = commitMutualAidRequestSchema.safeParse(bodyUnknown);
  if (!parsed.success) throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  const body = parsed.data;
  const now = new Date().toISOString();

  const req = await findMutualAidRequest(actor.agencyId, requestId);

  const commitment: ResourceCommitment = {
    commitmentId: randomUUID(),
    committingAgencyId: actor.agencyId,
    committingAgencyName: body.committingAgencyName,
    resources: body.resources as CommittedResource[],
    status: "committed",
    estimatedArrival: body.estimatedArrival,
    committedAt: now,
    committedBy: actor.userId,
  };

  const updatedCommitments = [...(req.resourcesCommitted ?? []), commitment];
  const filledByType = new Map<string, number>();
  for (const c of updatedCommitments) {
    for (const r of c.resources) {
      filledByType.set(r.unitType, (filledByType.get(r.unitType) ?? 0) + 1);
    }
  }
  const updatedNeeds = req.resourcesNeeded.map((n) => ({
    ...n,
    filledQuantity: Math.min(n.quantity, filledByType.get(n.resourceType) ?? n.filledQuantity),
  }));
  const allFilled = updatedNeeds.every((n) => n.filledQuantity >= n.quantity);
  const status = allFilled ? "filled" : "partially_filled";

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.mutualAid(),
      Key: { pk: req.pk, sk: req.sk },
      UpdateExpression:
        "SET resourcesCommitted = :c, resourcesNeeded = :n, #status = :s, gsi1pk = :gsi",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":c": updatedCommitments,
        ":n": updatedNeeds,
        ":s": status,
        ":gsi": `STATUS#${status}`,
      },
    }),
  );

  await writeFeatureAudit({
    agencyId: actor.agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.MUTUAL_AID_COMMITTED,
    details: { requestId, commitmentId: commitment.commitmentId, requestingAgencyId: req.requestingAgencyId },
    resourceId: commitment.commitmentId,
  });

  return { commitmentId: commitment.commitmentId, message: "Resources committed" };
}

export async function updateCommitmentStatus(
  actor: FeatureActor,
  requestId: string,
  commitmentId: string,
  bodyUnknown: unknown,
): Promise<{ updated: boolean; status: string }> {
  const parsed = updateCommitmentStatusRequestSchema.safeParse({
    requestId,
    commitmentId,
    ...(typeof bodyUnknown === 'object' && bodyUnknown ? bodyUnknown : {}),
  });
  if (!parsed.success) throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  const now = new Date().toISOString();

  const req = await findMutualAidRequest(actor.agencyId, requestId);
  const updatedCommitments = req.resourcesCommitted.map((c) =>
    c.commitmentId === commitmentId
      ? {
          ...c,
          status: parsed.data.status,
          ...(parsed.data.status === "released" ? { releasedAt: now } : {}),
          ...(parsed.data.status === "on_scene" && !c.actualArrival
            ? { actualArrival: now }
            : {}),
        }
      : c,
  );

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.mutualAid(),
      Key: { pk: req.pk, sk: req.sk },
      UpdateExpression: "SET resourcesCommitted = :c",
      ExpressionAttributeValues: { ":c": updatedCommitments },
    }),
  );

  await writeFeatureAudit({
    agencyId: actor.agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.MUTUAL_AID_COMMITMENT_UPDATED,
    details: { requestId, commitmentId, status: parsed.data.status },
    resourceId: commitmentId,
  });

  return { updated: true, status: parsed.data.status };
}

/** HTTP-facing wrapper: evaluate using verified agencyId from actor (ignore body agencyId). */
export async function evaluateAlternativeResponseForHttp(
  actor: FeatureActor,
  bodyUnknown: unknown,
): Promise<{ alternativeResponseDetected: boolean; flag?: AlternativeResponseFlag }> {
  const raw = typeof bodyUnknown === "object" && bodyUnknown ? (bodyUnknown as Record<string, unknown>) : {};
  // Never trust agencyId from body — overwrite with verified actor agency.
  const parsed = evaluateAltResponseRequestSchema.safeParse({
    ...raw,
    agencyId: actor.agencyId,
  });
  if (!parsed.success) throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  return evaluateAlternativeResponse({
    agencyId: actor.agencyId,
    incidentId: parsed.data.incidentId,
    transcript: parsed.data.transcript,
    callType: parsed.data.callType,
    actorId: actor.userId,
  });
}
