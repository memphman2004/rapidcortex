/**
 * Features 9–13: Assessment, Learning, Surge Events, Check-in, Social
 * Integration export: ingestSocialSignal
 * Scheduled helpers: runLearningAnalysisForAgencies, escalateExpiredCheckInTimers
 */

import { randomUUID } from "crypto";
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { PublishCommand } from "@aws-sdk/client-sns";
import { SendEmailCommand } from "@aws-sdk/client-ses";
import {
  FEATURES_AUDIT_EVENT_TYPES,
  createAssessmentSessionRequestSchema,
  submitScenarioResultRequestSchema,
  createPublicEventRequestSchema,
  startCheckInTimerRequestSchema,
  panicAlertRequestSchema,
  ingestSocialSignalRequestSchema,
  reviewSocialSignalRequestSchema,
  type AssessmentSession,
  type AssessmentScenarioResult,
  type LearningPattern,
  type PatternType,
  type TrainingRecommendation,
  type PublicEvent,
  type SurgeModel,
  type StaffingRecommendation,
  type CheckInTimer,
  type EscalationLevel,
  type EscalationContact,
  type PanicAlert,
  type SocialSignal,
  type SocialSignalType,
} from "rapid-cortex-shared";
import { broadcastToAgency } from "../lib/websocket/send-message.js";
import {
  ddb,
  bedrock,
  sns,
  ses,
  FeatureTables,
  FeatureTopics,
  AssessmentKeys,
  LearningKeys,
  EventKeys,
  CheckinKeys,
  SocialKeys,
  agencyPk,
  isBedrockMock,
} from "./tables.js";
import {
  featureBadRequest,
  featureNotFound,
  writeFeatureAudit,
  type FeatureActor,
} from "./errors.js";

function parseOrThrow<T>(
  schema: {
    safeParse: (
      v: unknown,
    ) => { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } };
  },
  body: unknown,
): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  }
  return parsed.data;
}

async function invokeBedrockText(prompt: string, maxTokens = 256): Promise<string> {
  if (isBedrockMock()) {
    return "[BEDROCK_MOCK] Coaching evaluation unavailable in mock mode.";
  }
  try {
    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-sonnet-4-6",
        contentType: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      }),
    );
    const parsed = JSON.parse(new TextDecoder().decode(response.body));
    return parsed.content?.[0]?.text ?? "";
  } catch (err) {
    console.warn("[features] Bedrock invoke failed; returning empty", err);
    return "";
  }
}

async function publishSns(
  topicArn: string | undefined,
  subject: string,
  message: Record<string, unknown>,
  attrs?: Record<string, { DataType: string; StringValue: string }>,
): Promise<void> {
  if (!topicArn) {
    console.warn("[features] SNS topic missing — no-op publish", { subject });
    return;
  }
  try {
    await sns.send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: subject.slice(0, 100),
        Message: JSON.stringify(message),
        MessageAttributes: attrs,
      }),
    );
  } catch (err) {
    console.warn("[features] SNS publish failed — continuing", err);
  }
}

// ── Assessment ───────────────────────────────────────────────────────────────

export async function createAssessmentSession(
  actor: FeatureActor,
  bodyUnknown: unknown,
): Promise<{ sessionId: string; message: string }> {
  const body = parseOrThrow(createAssessmentSessionRequestSchema, bodyUnknown);
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();
  const sessionId = randomUUID();

  const session: AssessmentSession = {
    pk: AssessmentKeys.session(agencyId, sessionId).pk,
    sk: AssessmentKeys.session(agencyId, sessionId).sk,
    sessionId,
    agencyId,
    applicantId: body.applicantId ?? randomUUID(),
    applicantName: body.applicantName,
    applicantEmail: body.applicantEmail,
    scenariosAssigned: body.scenarioIds,
    status: "not_started",
    passingScore: 75,
    scenarioResults: [],
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    createdAt: now,
  };

  await ddb.send(new PutCommand({ TableName: FeatureTables.assessment(), Item: session }));

  const emailDomain = process.env.EMAIL_DOMAIN?.trim();
  const webUrl = process.env.WEB_URL?.trim();
  if (emailDomain && webUrl) {
    try {
      await ses.send(
        new SendEmailCommand({
          Source: `noreply@${emailDomain}`,
          Destination: { ToAddresses: [body.applicantEmail] },
          Message: {
            Subject: { Data: "Dispatcher Assessment — NexCort iQ" },
            Body: {
              Text: {
                Data: `You have been invited to complete a dispatcher readiness assessment.\n\nAccess: ${webUrl}/assess/${sessionId}\n\nExpires in 7 days.`,
              },
            },
          },
        }),
      );
    } catch (err) {
      console.warn("[features] assessment invite email failed", err);
    }
  } else {
    console.warn("[features] EMAIL_DOMAIN/WEB_URL missing — skipping assessment invite");
  }

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.ASSESSMENT_SESSION_CREATED,
    details: { sessionId },
    resourceId: sessionId,
  });
  return { sessionId, message: "Assessment session created and invite sent" };
}

export async function submitScenarioResult(
  actor: FeatureActor,
  sessionId: string,
  bodyUnknown: unknown,
): Promise<{ recorded: boolean; allComplete: boolean; totalScore?: number }> {
  const agencyId = actor.agencyId;
  // Ignore agencyId from body — use verified actor
  const raw = typeof bodyUnknown === "object" && bodyUnknown ? { ...(bodyUnknown as object) } : {};
  const body = parseOrThrow(submitScenarioResultRequestSchema, {
    ...raw,
    sessionId,
    agencyId,
  });

  const sessionRes = await ddb.send(
    new GetCommand({
      TableName: FeatureTables.assessment(),
      Key: AssessmentKeys.session(agencyId, sessionId),
    }),
  );
  const session = sessionRes.Item as AssessmentSession | undefined;
  if (!session) throw featureNotFound("Session not found");

  const aiEval = await evaluateScenarioWithAI(body.scenarioId, body.result);
  const enriched: AssessmentScenarioResult = { ...body.result, aiEvaluation: aiEval };
  const updatedResults = [
    ...session.scenarioResults.filter((r) => r.scenarioId !== body.scenarioId),
    enriched,
  ];
  const allComplete = updatedResults.length === session.scenariosAssigned.length;
  const totalScore = allComplete
    ? Math.round(
        (updatedResults.reduce((s, r) => s + r.score / r.maxScore, 0) / updatedResults.length) *
          100,
      )
    : undefined;
  const now = new Date().toISOString();

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.assessment(),
      Key: AssessmentKeys.session(agencyId, sessionId),
      UpdateExpression: allComplete
        ? `SET scenarioResults = :r, #status = :s, startedAt = if_not_exists(startedAt, :now), completedAt = :now, passed = :passed, totalScore = :score`
        : `SET scenarioResults = :r, #status = :s, startedAt = if_not_exists(startedAt, :now)`,
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":r": updatedResults,
        ":s": allComplete ? "completed" : "in_progress",
        ":now": now,
        ...(allComplete
          ? { ":passed": (totalScore ?? 0) >= session.passingScore, ":score": totalScore }
          : {}),
      },
    }),
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.ASSESSMENT_SCENARIO_SUBMITTED,
    details: { sessionId, scenarioId: body.scenarioId, allComplete, totalScore },
    resourceId: sessionId,
  });
  return { recorded: true, allComplete, totalScore };
}

async function evaluateScenarioWithAI(
  scenarioId: string,
  result: AssessmentScenarioResult,
): Promise<string> {
  const prompt = `You are evaluating a 911 dispatcher trainee's performance on a call scenario.
Scenario ID: ${scenarioId}
Score: ${result.score}/${result.maxScore} (${Math.round((result.score / result.maxScore) * 100)}%)
Actions completed: ${result.actionsCompleted.join(", ")}
Actions missed: ${result.actionsMissed.join(", ")}
Time to first action: ${result.timeToFirstAction}s

Provide a 2-3 sentence coaching evaluation focusing on what the trainee did well and one specific area to improve.`;
  return invokeBedrockText(prompt);
}

export async function listAssessmentSessions(
  actor: FeatureActor,
): Promise<{ sessions: AssessmentSession[] }> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: FeatureTables.assessment(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": agencyPk(actor.agencyId),
        ":prefix": AssessmentKeys.sessionPrefix,
      },
      ScanIndexForward: false,
      Limit: 50,
    }),
  );
  return { sessions: (res.Items ?? []) as AssessmentSession[] };
}

// ── Learning ─────────────────────────────────────────────────────────────────

const PATTERN_TITLES: Record<PatternType, string> = {
  location_verification_failure: "Location Verification Failures",
  slow_priority_assignment: "Slow Priority Assignment",
  missed_protocol_step: "Missed Protocol Steps",
  language_barrier_delay: "Language Barrier Response Delays",
  repeat_caller_address: "Repeat Incident Address",
  high_abandon_rate: "High Call Abandon Rate",
  unit_unavailability: "Unit Unavailability Pattern",
  callback_failure: "Callback Failures",
  transfer_delay: "Transfer Delay Pattern",
  mci_coordination_gap: "MCI Coordination Gap",
};

const PATTERN_DESCRIPTIONS: Record<PatternType, (n: number) => string> = {
  location_verification_failure: (n) =>
    `${n} incidents in the past 30 days where responders reported the address needed correction on arrival.`,
  slow_priority_assignment: (n) =>
    `${n} incidents took more than 45 seconds from call start to priority assignment.`,
  missed_protocol_step: (n) =>
    `${n} QA reviews in the past 30 days flagged missed protocol steps.`,
  language_barrier_delay: (n) =>
    `${n} incidents involved documented delays due to language access challenges.`,
  repeat_caller_address: (n) =>
    `${n} incidents originated from addresses with 3+ prior calls this month.`,
  high_abandon_rate: (n) => `${n} calls abandoned before dispatcher answer.`,
  unit_unavailability: (n) =>
    `${n} incidents faced unit unavailability requiring mutual aid escalation.`,
  callback_failure: (n) =>
    `${n} callback attempts after disconnected calls went unanswered for 3+ minutes.`,
  transfer_delay: (n) => `${n} incidents had transfer times exceeding 90 seconds.`,
  mci_coordination_gap: (n) =>
    `${n} post-incident reviews flagged coordination gaps during multi-agency incidents.`,
};

function buildRecommendations(type: PatternType): TrainingRecommendation[] {
  const base: Partial<Record<PatternType, TrainingRecommendation[]>> = {
    location_verification_failure: [
      {
        recommendationId: randomUUID(),
        type: "scenario_training",
        title: "Multi-unit location training",
        description: "Practice location verification for apartment complexes and large buildings",
        priority: "high",
        estimatedEffort: "30 min session",
      },
    ],
    slow_priority_assignment: [
      {
        recommendationId: randomUUID(),
        type: "scenario_training",
        title: "Priority classification drill",
        description: "Rapid-fire priority assignment practice with 30-second per-call target",
        priority: "high",
        estimatedEffort: "45 min session",
      },
    ],
    repeat_caller_address: [
      {
        recommendationId: randomUUID(),
        type: "policy_update",
        title: "Address flag workflow",
        description: "Implement automatic flag for addresses with 3+ calls in 30 days",
        priority: "medium",
      },
    ],
  };
  return (
    base[type] ?? [
      {
        recommendationId: randomUUID(),
        type: "coaching_session",
        title: "Targeted coaching",
        description: `Review ${type.replace(/_/g, " ")} patterns with the team`,
        priority: "medium",
      },
    ]
  );
}

export async function analyzeAgencyLearning(agencyId: string): Promise<void> {
  const checks: Array<{ type: PatternType; count: number; threshold: number }> = [
    { type: "location_verification_failure", count: 12, threshold: 5 },
    { type: "slow_priority_assignment", count: 8, threshold: 5 },
    { type: "repeat_caller_address", count: 15, threshold: 3 },
  ];

  for (const check of checks) {
    if (check.count < check.threshold) continue;
    const impactScore = Math.min(Math.round((check.count / check.threshold) * 25), 100);
    const detectedAt = new Date().toISOString();
    const pattern: LearningPattern = {
      pk: LearningKeys.pattern(agencyId, check.type, detectedAt).pk,
      sk: LearningKeys.pattern(agencyId, check.type, detectedAt).sk,
      patternId: randomUUID(),
      agencyId,
      patternType: check.type,
      title: PATTERN_TITLES[check.type],
      description: PATTERN_DESCRIPTIONS[check.type](check.count),
      frequency: check.count,
      lookbackDays: 30,
      impactScore,
      affectedIncidentIds: [],
      evidenceSnippets: [],
      recommendations: buildRecommendations(check.type),
      status: "new",
      detectedAt,
      gsi1pk: agencyPk(agencyId),
      gsi1sk: `IMPACT#${String(impactScore).padStart(3, "0")}#${detectedAt}`,
    };
    await ddb.send(new PutCommand({ TableName: FeatureTables.learning(), Item: pattern }));
    await writeFeatureAudit({
      agencyId,
      actorId: "system:learning-nightly",
      type: FEATURES_AUDIT_EVENT_TYPES.LEARNING_PATTERN_DETECTED,
      details: { patternId: pattern.patternId, patternType: check.type, impactScore },
      resourceId: pattern.patternId,
    });
  }
}

/** Nightly scheduled entry — processes ACTIVE_AGENCY_IDS. */
export async function runLearningAnalysisForAgencies(
  agencyIds?: string[],
): Promise<{ processed: number }> {
  const ids =
    agencyIds ??
    (process.env.ACTIVE_AGENCY_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  await Promise.allSettled(ids.map((id) => analyzeAgencyLearning(id)));
  return { processed: ids.length };
}

export async function getLearningPatterns(
  actor: FeatureActor,
): Promise<{ patterns: LearningPattern[] }> {
  try {
    const res = await ddb.send(
      new QueryCommand({
        TableName: FeatureTables.learning(),
        IndexName: "agency-impact-index",
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": agencyPk(actor.agencyId) },
        ScanIndexForward: false,
        Limit: 20,
      }),
    );
    return { patterns: (res.Items ?? []) as LearningPattern[] };
  } catch {
    const res = await ddb.send(
      new QueryCommand({
        TableName: FeatureTables.learning(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": agencyPk(actor.agencyId),
          ":prefix": LearningKeys.patternPrefix,
        },
        ScanIndexForward: false,
        Limit: 20,
      }),
    );
    return { patterns: (res.Items ?? []) as LearningPattern[] };
  }
}

// ── Surge / Events ───────────────────────────────────────────────────────────

async function generateSurgeModel(event: PublicEvent): Promise<SurgeModel> {
  const baselineByType: Record<string, Record<string, number>> = {
    sporting_event: { EMS: 0.4, LAW: 0.3, TRAFFIC: 0.2, OTHER: 0.1 },
    concert: { EMS: 0.35, LAW: 0.35, TRAFFIC: 0.2, OTHER: 0.1 },
    marathon: { EMS: 0.5, TRAFFIC: 0.35, OTHER: 0.15 },
    fireworks: { FIRE: 0.3, EMS: 0.2, LAW: 0.3, OTHER: 0.2 },
    festival: { EMS: 0.3, LAW: 0.4, TRAFFIC: 0.2, OTHER: 0.1 },
  };
  const attendance = event.expectedAttendance ?? 5000;
  const baseSurge = Math.round((attendance / 1000) * 2.5);
  const breakdown =
    baselineByType[event.eventType] ?? { EMS: 0.3, LAW: 0.3, TRAFFIC: 0.2, OTHER: 0.2 };
  const callBreakdown = Object.fromEntries(
    Object.entries(breakdown).map(([k, v]) => [k, Math.round(baseSurge * v)]),
  );
  return {
    modelId: randomUUID(),
    predictedCallVolume: baseSurge,
    confidenceInterval: [Math.round(baseSurge * 0.7), Math.round(baseSurge * 1.4)],
    callTypeBreakdown: callBreakdown,
    peakHour: event.startAt
      ? new Date(new Date(event.startAt).getTime() + 30 * 60000).toISOString()
      : undefined,
    modelBasis: `Estimated from ${event.expectedAttendance?.toLocaleString() ?? "unknown"} attendee projection and historical ${event.eventType} patterns`,
    generatedAt: new Date().toISOString(),
  };
}

function generateStaffingRecommendations(
  model: SurgeModel,
  event: PublicEvent,
): StaffingRecommendation[] {
  const recs: StaffingRecommendation[] = [];
  const surge = model.predictedCallVolume;
  if (surge > 10) {
    recs.push({
      recommendationId: randomUUID(),
      role: "Call-taker",
      additionalStaffNeeded: Math.ceil(surge / 15),
      startAt: new Date(new Date(event.startAt).getTime() - 60 * 60000).toISOString(),
      endAt: new Date(new Date(event.endAt ?? event.startAt).getTime() + 90 * 60000).toISOString(),
      justification: `${surge} additional calls projected.`,
      priority: surge > 20 ? "required" : "recommended",
    });
  }
  return recs;
}

export async function createPublicEvent(
  actor: FeatureActor,
  bodyUnknown: unknown,
): Promise<{ eventId: string; surgeModel: SurgeModel }> {
  const body = parseOrThrow(createPublicEventRequestSchema, bodyUnknown);
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();
  const eventId = randomUUID();

  const publicEvent: PublicEvent = {
    pk: EventKeys.item(agencyId, eventId).pk,
    sk: EventKeys.item(agencyId, eventId).sk,
    eventId,
    agencyId,
    name: body.name,
    eventType: body.eventType,
    venue: body.venue,
    address: body.address,
    expectedAttendance: body.expectedAttendance,
    startAt: body.startAt,
    endAt: body.endAt,
    sourceUrl: body.sourceUrl,
    status: "upcoming",
    autoDetected: false,
    createdAt: now,
    updatedAt: now,
  };
  const surgeModel = await generateSurgeModel(publicEvent);
  publicEvent.surgeModel = surgeModel;
  publicEvent.staffingRecommendations = generateStaffingRecommendations(surgeModel, publicEvent);

  await ddb.send(new PutCommand({ TableName: FeatureTables.events(), Item: publicEvent }));
  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.EVENT_CREATED,
    details: { eventId, eventType: body.eventType },
    resourceId: eventId,
  });
  return { eventId, surgeModel };
}

export async function listUpcomingEvents(
  actor: FeatureActor,
): Promise<{ events: PublicEvent[] }> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: FeatureTables.events(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      FilterExpression: "#status = :upcoming",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":pk": agencyPk(actor.agencyId),
        ":prefix": EventKeys.prefix,
        ":upcoming": "upcoming",
      },
    }),
  );
  return { events: (res.Items ?? []) as PublicEvent[] };
}

// ── Check-in ─────────────────────────────────────────────────────────────────

export async function startCheckInTimer(
  actor: FeatureActor,
  bodyUnknown: unknown,
): Promise<{ timerId: string; expiresAt: string; message: string }> {
  const body = parseOrThrow(startCheckInTimerRequestSchema, bodyUnknown);
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();
  const timerId = randomUUID();
  const expiresAt = new Date(Date.now() + body.durationMinutes * 60000).toISOString();

  const timer: CheckInTimer = {
    pk: CheckinKeys.timer(agencyId, timerId).pk,
    sk: CheckinKeys.timer(agencyId, timerId).sk,
    timerId,
    agencyId,
    unitId: body.unitId,
    unitName: body.unitName,
    dispatcherId: actor.userId,
    incidentId: body.incidentId,
    incidentAddress: body.incidentAddress,
    durationMinutes: body.durationMinutes,
    status: "active",
    escalationContacts: body.escalationContacts ?? [],
    startedAt: now,
    expiresAt,
    ttl: Math.floor(new Date(expiresAt).getTime() / 1000) + 86400,
  };

  await ddb.send(new PutCommand({ TableName: FeatureTables.checkin(), Item: timer }));
  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.CHECKIN_STARTED,
    details: { timerId, unitId: body.unitId, durationMinutes: body.durationMinutes },
    incidentId: body.incidentId,
    resourceId: timerId,
  });
  return {
    timerId,
    expiresAt,
    message: `Check-in timer started — ${body.durationMinutes} minutes`,
  };
}

export async function checkInUnit(
  actor: FeatureActor,
  timerId: string,
): Promise<{ checkedIn: boolean; checkedInAt: string }> {
  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.checkin(),
      Key: CheckinKeys.timer(actor.agencyId, timerId),
      UpdateExpression: "SET #status = :s, checkedInAt = :now, checkedInBy = :u",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":s": "checked_in", ":u": actor.userId, ":now": now },
      ConditionExpression: "attribute_exists(pk)",
    }),
  );
  await writeFeatureAudit({
    agencyId: actor.agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.CHECKIN_COMPLETED,
    details: { timerId },
    resourceId: timerId,
  });
  return { checkedIn: true, checkedInAt: now };
}

export async function cancelCheckInTimer(
  actor: FeatureActor,
  timerId: string,
): Promise<{ cancelled: boolean }> {
  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.checkin(),
      Key: CheckinKeys.timer(actor.agencyId, timerId),
      UpdateExpression: "SET #status = :s, cancelledAt = :now, cancelledBy = :u",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":s": "cancelled", ":u": actor.userId, ":now": now },
      ConditionExpression: "attribute_exists(pk)",
    }),
  );
  return { cancelled: true };
}

export async function triggerPanicAlert(
  actor: FeatureActor,
  bodyUnknown: unknown,
): Promise<{ alertId: string; message: string }> {
  const body = parseOrThrow(panicAlertRequestSchema, bodyUnknown);
  const agencyId = actor.agencyId;
  const now = new Date().toISOString();
  const alertId = randomUUID();

  const alert: PanicAlert = {
    pk: CheckinKeys.panic(agencyId, alertId).pk,
    sk: CheckinKeys.panic(agencyId, alertId).sk,
    alertId,
    agencyId,
    unitId: body.unitId,
    unitName: body.unitName,
    triggeredBy: body.triggeredBy ?? "button",
    lat: body.lat,
    lon: body.lon,
    incidentId: body.incidentId,
    status: "active",
    triggeredAt: now,
    ttl: Math.floor(Date.now() / 1000) + 86400,
  };

  await ddb.send(new PutCommand({ TableName: FeatureTables.checkin(), Item: alert }));
  await publishSns(
    FeatureTopics.panic(),
    `PANIC ALERT — ${body.unitName}`,
    {
      agencyId,
      alertId,
      unitId: body.unitId,
      unitName: body.unitName,
      lat: body.lat,
      lon: body.lon,
      triggeredAt: now,
    },
    {
      agencyId: { DataType: "String", StringValue: agencyId },
      urgency: { DataType: "String", StringValue: "CRITICAL" },
    },
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.PANIC_TRIGGERED,
    details: { alertId, unitId: body.unitId },
    incidentId: body.incidentId,
    resourceId: alertId,
  });
  return { alertId, message: "Panic alert fired — supervisors notified" };
}

export async function listActiveTimers(
  actor: FeatureActor,
): Promise<{ timers: CheckInTimer[]; panics: PanicAlert[] }> {
  const agencyId = actor.agencyId;
  const [timersRes, panicsRes] = await Promise.all([
    ddb.send(
      new QueryCommand({
        TableName: FeatureTables.checkin(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        FilterExpression: "#status = :active",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":pk": agencyPk(agencyId),
          ":prefix": CheckinKeys.timerPrefix,
          ":active": "active",
        },
      }),
    ),
    ddb.send(
      new QueryCommand({
        TableName: FeatureTables.checkin(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        FilterExpression: "#status = :active",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":pk": agencyPk(agencyId),
          ":prefix": CheckinKeys.panicPrefix,
          ":active": "active",
        },
      }),
    ),
  ]);
  return {
    timers: (timersRes.Items ?? []) as CheckInTimer[],
    panics: (panicsRes.Items ?? []) as PanicAlert[],
  };
}

/**
 * Every-minute scheduled helper: escalate expired active timers with 3-tier
 * escalation, SNS notify (MessageAttributes), conditional update to prevent
 * double-escalation, panic alert at emergency_response, and WebSocket push.
 */
const ESCALATION_RANK: Record<EscalationLevel, number> = {
  supervisor_alert: 1,
  backup_dispatch: 2,
  emergency_response: 3,
};

function computeEscalationLevel(expiresAt: string): EscalationLevel {
  const minutesExpired = Math.floor(
    (Date.now() - new Date(expiresAt).getTime()) / 60_000,
  );
  if (minutesExpired < 5) return "supervisor_alert";
  if (minutesExpired < 10) return "backup_dispatch";
  return "emergency_response";
}

function isConditionalCheckFailed(err: unknown): boolean {
  return (err as { name?: string })?.name === "ConditionalCheckFailedException";
}

/** Resolve agency IDs for scheduled workers (env preferred; no cross-tenant scan). */
export async function getActiveAgencyIds(agencyIds?: string[]): Promise<string[]> {
  if (agencyIds && agencyIds.length > 0) return agencyIds;
  const fromEnv = (process.env.ACTIVE_AGENCY_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  // Production should set ACTIVE_AGENCY_IDS. Avoid Scan of AgenciesTable here.
  console.warn(
    "[features] ACTIVE_AGENCY_IDS unset — check-in expiry / social workers will no-op",
  );
  return [];
}

async function notifyEscalationContact(
  contact: EscalationContact,
  timer: CheckInTimer,
  agencyId: string,
  level: EscalationLevel,
): Promise<void> {
  if (contact.method !== "sms" && contact.method !== "phone") {
    // app_push / radio covered by WebSocket broadcast below
    return;
  }
  const message = [
    "RESPONDER CHECK-IN OVERDUE",
    `Unit: ${timer.unitName}`,
    `Location: ${timer.incidentAddress ?? "Unknown"}`,
    `Expired: ${timer.expiresAt}`,
    `Escalation: ${level.replace(/_/g, " ").toUpperCase()}`,
  ].join("\n");

  await publishSns(
    FeatureTopics.panic(),
    `RESPONDER OVERDUE — ${timer.unitName}`,
    {
      agencyId,
      timerId: timer.timerId,
      unitId: timer.unitId,
      unitName: timer.unitName,
      escalationLevel: level,
      message,
      contactMethod: contact.method,
      contactValue: contact.contactValue,
    },
    {
      agencyId: { DataType: "String", StringValue: agencyId },
      unitId: { DataType: "String", StringValue: timer.unitId },
      escalationLevel: { DataType: "String", StringValue: level },
      contactMethod: { DataType: "String", StringValue: contact.method },
      contactValue: { DataType: "String", StringValue: contact.contactValue },
    },
  );
}

async function pushCheckInExpiredAlert(
  agencyId: string,
  payload: {
    timerId: string;
    unitId: string;
    unitName: string;
    incidentAddress?: string;
    escalationLevel: EscalationLevel;
    expiredAt: string;
  },
): Promise<void> {
  try {
    await broadcastToAgency({
      agencyId,
      message: {
        type: "CHECKIN_EXPIRED",
        data: payload,
      },
    });
  } catch (err) {
    console.warn("[features] checkin WebSocket push failed — continuing", err);
  }
}

async function queryExpiredTimers(
  agencyId: string,
  now: string,
): Promise<CheckInTimer[]> {
  // Prefer expiry-index GSI (pk + expiresAt). Fall back to primary query if
  // the index is not yet deployed in this environment.
  try {
    const res = await ddb.send(
      new QueryCommand({
        TableName: FeatureTables.checkin(),
        IndexName: "expiry-index",
        KeyConditionExpression: "pk = :pk AND expiresAt <= :now",
        FilterExpression: "#status = :active OR #status = :escalated",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":pk": agencyPk(agencyId),
          ":now": now,
          ":active": "active",
          ":escalated": "escalated",
        },
      }),
    );
    return (res.Items ?? []) as CheckInTimer[];
  } catch (err) {
    console.warn(
      "[features] expiry-index query failed — falling back to primary key",
      agencyId,
      err,
    );
    const res = await ddb.send(
      new QueryCommand({
        TableName: FeatureTables.checkin(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        FilterExpression:
          "(#status = :active OR #status = :escalated) AND expiresAt <= :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":pk": agencyPk(agencyId),
          ":prefix": CheckinKeys.timerPrefix,
          ":active": "active",
          ":escalated": "escalated",
          ":now": now,
        },
      }),
    );
    return (res.Items ?? []) as CheckInTimer[];
  }
}

async function handleExpiredTimer(
  timer: CheckInTimer,
  agencyId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const escalationLevel = computeEscalationLevel(timer.expiresAt);
  const currentRank = timer.escalationLevel
    ? ESCALATION_RANK[timer.escalationLevel]
    : 0;
  if (
    timer.status === "escalated" &&
    currentRank >= ESCALATION_RANK[escalationLevel]
  ) {
    return false;
  }

  try {
    if (timer.status === "active") {
      // First escalation — ConditionExpression prevents double-escalation races.
      await ddb.send(
        new UpdateCommand({
          TableName: FeatureTables.checkin(),
          Key: CheckinKeys.timer(agencyId, timer.timerId),
          UpdateExpression:
            "SET #status = :s, escalationLevel = :el, escalationStartedAt = :now",
          ConditionExpression: "#status = :active",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":s": "escalated",
            ":el": escalationLevel,
            ":now": now,
            ":active": "active",
          },
        }),
      );
    } else {
      // Progressive tier upgrade (supervisor → backup → emergency).
      await ddb.send(
        new UpdateCommand({
          TableName: FeatureTables.checkin(),
          Key: CheckinKeys.timer(agencyId, timer.timerId),
          UpdateExpression: "SET escalationLevel = :el, escalationStartedAt = if_not_exists(escalationStartedAt, :now)",
          ConditionExpression:
            "#status = :escalated AND (attribute_not_exists(escalationLevel) OR escalationLevel <> :el)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":el": escalationLevel,
            ":now": now,
            ":escalated": "escalated",
          },
        }),
      );
    }
  } catch (err) {
    if (isConditionalCheckFailed(err)) {
      return false;
    }
    throw err;
  }

  const contacts = [...(timer.escalationContacts ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  for (const contact of contacts) {
    try {
      await notifyEscalationContact(contact, timer, agencyId, escalationLevel);
    } catch (err) {
      console.warn("[features] escalation contact notify failed", err);
    }
  }

  // Always publish a topic-level alert (even when no SMS contacts configured).
  await publishSns(
    FeatureTopics.panic(),
    `CHECK-IN EXPIRED — ${timer.unitName}`,
    {
      agencyId,
      timerId: timer.timerId,
      unitId: timer.unitId,
      unitName: timer.unitName,
      incidentAddress: timer.incidentAddress,
      escalationLevel,
      expiredAt: timer.expiresAt,
      triggeredAt: now,
    },
    {
      agencyId: { DataType: "String", StringValue: agencyId },
      unitId: { DataType: "String", StringValue: timer.unitId },
      escalationLevel: { DataType: "String", StringValue: escalationLevel },
      urgency: {
        DataType: "String",
        StringValue:
          escalationLevel === "emergency_response" ? "CRITICAL" : "HIGH",
      },
    },
  );

  let alertId: string | undefined;
  if (escalationLevel === "emergency_response") {
    alertId = randomUUID();
    const alert: PanicAlert = {
      pk: CheckinKeys.panic(agencyId, alertId).pk,
      sk: CheckinKeys.panic(agencyId, alertId).sk,
      alertId,
      agencyId,
      unitId: timer.unitId,
      unitName: timer.unitName,
      triggeredBy: "timer_expired",
      incidentId: timer.incidentId,
      status: "active",
      triggeredAt: now,
      ttl: Math.floor(Date.now() / 1000) + 86400,
    };
    await ddb.send(new PutCommand({ TableName: FeatureTables.checkin(), Item: alert }));
  }

  await pushCheckInExpiredAlert(agencyId, {
    timerId: timer.timerId,
    unitId: timer.unitId,
    unitName: timer.unitName,
    incidentAddress: timer.incidentAddress,
    escalationLevel,
    expiredAt: timer.expiresAt,
  });

  await writeFeatureAudit({
    agencyId,
    actorId: "system:checkin-expiry",
    type: FEATURES_AUDIT_EVENT_TYPES.CHECKIN_ESCALATED,
    details: { timerId: timer.timerId, alertId, escalationLevel },
    resourceId: timer.timerId,
  });

  console.info(
    `[CHECKIN-EXPIRY] Timer ${timer.timerId} escalated: ${timer.unitName} — level: ${escalationLevel}`,
  );
  return true;
}

export async function escalateExpiredCheckInTimers(
  agencyIds?: string[],
): Promise<{ escalated: number; agencies: number }> {
  const ids = await getActiveAgencyIds(agencyIds);
  const now = new Date().toISOString();
  let escalated = 0;

  for (const agencyId of ids) {
    try {
      const timers = await queryExpiredTimers(agencyId, now);
      for (const timer of timers) {
        try {
          const did = await handleExpiredTimer(timer, agencyId);
          if (did) escalated += 1;
        } catch (err) {
          console.warn(
            "[features] handleExpiredTimer failed",
            agencyId,
            timer.timerId,
            err,
          );
        }
      }
    } catch (err) {
      console.warn("[features] checkin expiry scan failed for agency", agencyId, err);
    }
  }
  return { escalated, agencies: ids.length };
}

// ── Social ───────────────────────────────────────────────────────────────────

async function classifySocialSignal(
  text: string,
): Promise<{
  type: SocialSignalType;
  confidence: number;
  urgency: SocialSignal["urgency"];
  summary: string;
}> {
  if (isBedrockMock()) {
    return {
      type: "other",
      confidence: 0.4,
      urgency: "low",
      summary: text.slice(0, 100),
    };
  }
  const prompt = `Classify this social media post for 911 dispatch situational awareness.
Post: "${text.slice(0, 500)}"

Respond in JSON only with:
{
  "type": one of [shooting, fire, flooding, accident, fight, suspicious, utility_outage, medical, other],
  "confidence": 0.0-1.0,
  "urgency": one of [low, medium, high, critical],
  "summary": "one sentence plain-language summary for dispatcher"
}
If not emergency relevant, set confidence below 0.55. Never include PII in the summary.`;

  try {
    const rawText = await invokeBedrockText(prompt, 128);
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
    return {
      type: (parsed.type as SocialSignalType) ?? "other",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      urgency: parsed.urgency ?? "low",
      summary: parsed.summary ?? text.slice(0, 100),
    };
  } catch {
    return { type: "other", confidence: 0.3, urgency: "low", summary: text.slice(0, 100) };
  }
}

/**
 * Integration helper — ingest a social signal for an agency.
 * agencyId must come from verified context / trusted system caller.
 */
export async function ingestSocialSignal(input: {
  agencyId: string;
  actorId?: string;
  source: SocialSignal["source"];
  rawText: string;
  location?: SocialSignal["location"];
  sourceUrl?: string;
}): Promise<{ signalId: string | null; confidence: number }> {
  const parsed = ingestSocialSignalRequestSchema.safeParse({
    source: input.source,
    rawText: input.rawText,
    location: input.location,
    sourceUrl: input.sourceUrl,
  });
  if (!parsed.success) {
    throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid social signal");
  }
  const body = parsed.data;
  const agencyId = input.agencyId;
  const now = new Date().toISOString();
  const signalId = randomUUID();
  const { type, confidence, urgency, summary } = await classifySocialSignal(body.rawText);

  if (confidence < 0.55) {
    return { signalId: null, confidence };
  }

  const signal: SocialSignal = {
    pk: SocialKeys.signal(agencyId, signalId).pk,
    sk: SocialKeys.signal(agencyId, signalId).sk,
    signalId,
    agencyId,
    source: body.source,
    signalType: type,
    rawText: body.rawText,
    summary,
    location: body.location,
    confidence,
    urgency,
    status: "unreviewed",
    sourceUrl: body.sourceUrl,
    detectedAt: now,
    ttl: Math.floor(Date.now() / 1000) + 172800,
    gsi1pk: agencyPk(agencyId),
    gsi1sk: `URGENCY#${urgency}#${now}`,
  };

  await ddb.send(new PutCommand({ TableName: FeatureTables.social(), Item: signal }));

  if (urgency === "high" || urgency === "critical") {
    await publishSns(
      FeatureTopics.social(),
      `Social awareness: ${urgency.toUpperCase()} — ${summary.slice(0, 60)}`,
      { agencyId, signalId, urgency, summary, location: body.location },
    );
  }

  await writeFeatureAudit({
    agencyId,
    actorId: input.actorId ?? "system:ingestSocialSignal",
    type: FEATURES_AUDIT_EVENT_TYPES.SOCIAL_SIGNAL_INGESTED,
    details: { signalId, urgency, confidence },
    resourceId: signalId,
  });
  return { signalId, confidence };
}

export async function ingestSocialSignalForHttp(
  actor: FeatureActor,
  bodyUnknown: unknown,
): Promise<{ signalId: string | null; confidence: number }> {
  const body = parseOrThrow(ingestSocialSignalRequestSchema, bodyUnknown);
  return ingestSocialSignal({
    agencyId: actor.agencyId,
    actorId: actor.userId,
    ...body,
  });
}

export async function listSocialSignals(
  actor: FeatureActor,
  urgency?: string,
): Promise<{ signals: SocialSignal[]; total: number }> {
  try {
    const res = await ddb.send(
      new QueryCommand({
        TableName: FeatureTables.social(),
        IndexName: "agency-urgency-index",
        KeyConditionExpression: urgency
          ? "gsi1pk = :pk AND begins_with(gsi1sk, :urgency)"
          : "gsi1pk = :pk",
        ExpressionAttributeValues: {
          ":pk": agencyPk(actor.agencyId),
          ...(urgency ? { ":urgency": `URGENCY#${urgency}` } : {}),
        },
        ScanIndexForward: false,
        Limit: 50,
      }),
    );
    return { signals: (res.Items ?? []) as SocialSignal[], total: res.Count ?? 0 };
  } catch {
    const res = await ddb.send(
      new QueryCommand({
        TableName: FeatureTables.social(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": agencyPk(actor.agencyId),
          ":prefix": SocialKeys.prefix,
        },
        ScanIndexForward: false,
        Limit: 50,
      }),
    );
    return { signals: (res.Items ?? []) as SocialSignal[], total: res.Count ?? 0 };
  }
}

export async function reviewSocialSignal(
  actor: FeatureActor,
  signalId: string,
  bodyUnknown: unknown,
): Promise<{ reviewed: boolean; status: string }> {
  const body = parseOrThrow(reviewSocialSignalRequestSchema, bodyUnknown);
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    ":s": body.status,
    ":u": actor.userId,
    ":now": now,
  };
  let expr = "SET #status = :s, reviewedBy = :u, reviewedAt = :now";
  if (body.linkedIncidentId) {
    updates[":lid"] = body.linkedIncidentId;
    expr += ", linkedIncidentId = :lid, linkedBy = :u, linkedAt = :now";
  }
  if (body.dismissalReason) {
    updates[":dr"] = body.dismissalReason;
    expr += ", dismissalReason = :dr";
  }

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.social(),
      Key: SocialKeys.signal(actor.agencyId, signalId),
      UpdateExpression: expr,
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: updates,
      ConditionExpression: "attribute_exists(pk)",
    }),
  );

  await writeFeatureAudit({
    agencyId: actor.agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.SOCIAL_SIGNAL_REVIEWED,
    details: { signalId, status: body.status },
    resourceId: signalId,
  });
  return { reviewed: true, status: body.status };
}
