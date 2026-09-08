import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  CallAssistMode,
  CallAssistSource,
  CallAssistState,
  CallIntakeData,
  CallTriageResult,
  ExternalAgencyRoute,
  RoutingRecommendation,
  RetentionPolicy,
  SafetyDecision,
  TransferPackage,
  CadProviderId,
  AgencyTaxonomy,
  CallAssistConfidenceThresholds,
  CallAssistDemoScenarioConfig,
  CallAssistTaxonomyVertical,
} from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";
import { env } from "../lib/env.js";

function table(): string {
  const t = env.callAssistTable;
  if (!t) throw new Error("CALL_ASSIST_TABLE is not configured");
  return t;
}

export type CallAssistOperatingHours = {
  timezone: string;
  openMinutes: number;
  closeMinutes: number;
  allDay?: boolean;
  days?: Array<{ day: number; closed: boolean; openMinutes: number; closeMinutes: number }>;
};

export type CallAssistTenantConfig = {
  agencyId: string;
  disclosureEnabled: boolean;
  disclosureText: string;
  emergencyDestination: string;
  demoEmergencyDestination: string;
  cadProviderId: CadProviderId;
  cadHumanReviewRequired: boolean;
  cadNatureMapping: Record<string, string>;
  carfaxPortalUrl: string;
  onlineReportUrl: string;
  retention: RetentionPolicy;
  operatingHours: CallAssistOperatingHours;
  videoAssistEnabled: boolean;
  shortName?: string;
  agencyName?: string;
  agencyShortName?: string;
  shiftLabel?: string;
  vertical?: CallAssistTaxonomyVertical;
  uiVertical?: CallAssistTaxonomyVertical;
  alertPickupLine?: string;
  cadProviderLabel?: string | null;
  confidenceThresholds?: CallAssistConfidenceThresholds;
  taxonomy?: AgencyTaxonomy | null;
  demoScenarios?: CallAssistDemoScenarioConfig[];
  onboardingComplete?: boolean;
  onboardingCompletedAt?: string | null;
  seededProfile?: string;
  /** Tenant test DID (E.164). Never a live PSAP/911 number. */
  testDID?: string;
  lexBotId?: string;
  lexBotAliasId?: string;
  updatedAt: string;
};

export const CALL_ASSIST_DID_INDEX_PK = "__did_index__";

export type CallAssistShiftRecord = {
  agencyId: string;
  currentShift: string;
  setBy: string;
  setAt: string;
  expiresAt: string;
};

export type CallAssistKnowledgeArticle = {
  agencyId: string;
  articleId: string;
  title: string;
  body: string;
  tags: string[];
  enabled: boolean;
  updatedAt: string;
};

export type CallAssistRecordsRequest = {
  agencyId: string;
  requestId: string;
  requestorName: string;
  requestorEmail: string;
  dateFrom: string;
  dateTo: string;
  notes?: string;
  sessionIds?: string[];
  status: "OPEN" | "EXPORTING" | "FULFILLED" | "DENIED";
  createdAt: string;
  updatedAt: string;
  actorId: string;
};

export type CallAssistSessionRecord = {
  agencyId: string;
  sessionId: string;
  state: CallAssistState;
  mode: CallAssistMode;
  source: CallAssistSource;
  aniHash?: string;
  aniLast4?: string;
  language: string;
  ttyMode: boolean;
  connectContactId?: string;
  disclosureDelivered: boolean;
  utterances: Array<{ sequence: number; speaker: string; text: string; at: string }>;
  intake: CallIntakeData;
  triage?: CallTriageResult;
  safety?: SafetyDecision;
  routing?: RoutingRecommendation;
  transfer?: TransferPackage;
  locationKey?: string;
  continueAiConversation: boolean;
  nextQuestion?: string;
  cadPushStatus?: string;
  cadIncidentId?: string;
  rmsDraftStatus?: string;
  legalHold: boolean;
  videoAssistIncidentId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  caseNumber?: string;
  cadPayload?: Record<string, unknown>;
};

export type CallerHistoryRecord = {
  agencyId: string;
  aniHash: string;
  last4?: string;
  callCount: number;
  lastSessionId: string;
  lastAt: string;
};

export type ChronicLocationRecord = {
  agencyId: string;
  locationKey: string;
  hitCount: number;
  lastSessionId: string;
  lastAt: string;
};

const sk = {
  config: () => "CONFIG#tenant",
  session: (id: string) => `SESSION#${id}`,
  external: (id: string) => `EXT#${id}`,
  knowledge: (id: string) => `KB#${id}`,
  records: (id: string) => `RECORDS#${id}`,
  caller: (hash: string) => `CALLER#${hash}`,
  loc: (key: string) => `LOC#${key}`,
  locIdx: (key: string, sessionId: string) => `LOCIDX#${key}#${sessionId}`,
  survey: (sessionId: string) => `SURVEY#${sessionId}`,
  demoRun: (id: string) => `DEMO#${id}`,
  shift: () => "SHIFT#current",
  did: (e164: string) => `PHONE#${e164}`,
};

export function normalizeCallAssistDid(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

export class CallAssistStore {
  async getConfig(agencyId: string): Promise<CallAssistTenantConfig | null> {
    const out = await ddb.send(new GetCommand({ TableName: table(), Key: { agencyId, sk: sk.config() } }));
    return (out.Item as CallAssistTenantConfig | undefined) ?? null;
  }

  async putConfig(config: CallAssistTenantConfig): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: { ...config, sk: sk.config(), entityType: "call_assist_config" },
      }),
    );
  }

  async putSession(session: CallAssistSessionRecord): Promise<void> {
    const open = !session.completedAt && session.state !== "COMPLETED" && session.state !== "FAILED";
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...session,
          sk: sk.session(session.sessionId),
          entityType: "call_assist_session",
          gsi1pk: `${session.agencyId}#${open ? "OPEN" : "DONE"}`,
          gsi1sk: session.createdAt,
        },
      }),
    );
    if (session.locationKey) {
      await ddb.send(
        new PutCommand({
          TableName: table(),
          Item: {
            agencyId: session.agencyId,
            sk: sk.locIdx(session.locationKey, session.sessionId),
            entityType: "call_assist_locidx",
            sessionId: session.sessionId,
            locationKey: session.locationKey,
            createdAt: session.createdAt,
            source: session.source,
          },
        }),
      );
    }
  }

  async getSession(agencyId: string, sessionId: string): Promise<CallAssistSessionRecord | null> {
    const out = await ddb.send(
      new GetCommand({ TableName: table(), Key: { agencyId, sk: sk.session(sessionId) } }),
    );
    return (out.Item as CallAssistSessionRecord | undefined) ?? null;
  }

  async listSessions(agencyId: string, openOnly: boolean, limit = 100): Promise<CallAssistSessionRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :p",
        ExpressionAttributeValues: { ":p": `${agencyId}#${openOnly ? "OPEN" : "DONE"}` },
        ScanIndexForward: false,
        Limit: Math.min(500, Math.max(1, limit)),
      }),
    );
    return ((out.Items as CallAssistSessionRecord[]) ?? []).filter((row) => row.agencyId === agencyId);
  }

  async listSessionsByPrefix(agencyId: string, limit = 100): Promise<CallAssistSessionRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "SESSION#" },
        Limit: Math.min(500, Math.max(1, limit)),
      }),
    );
    return ((out.Items as CallAssistSessionRecord[]) ?? []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async listLocationIndex(agencyId: string, locationKey: string): Promise<Array<{ sessionId: string; createdAt: string }>> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": `LOCIDX#${locationKey}#` },
      }),
    );
    return ((out.Items as Array<{ sessionId: string; createdAt: string }>) ?? []).filter(Boolean);
  }

  async getCaller(agencyId: string, aniHash: string): Promise<CallerHistoryRecord | null> {
    const out = await ddb.send(
      new GetCommand({ TableName: table(), Key: { agencyId, sk: sk.caller(aniHash) } }),
    );
    return (out.Item as CallerHistoryRecord | undefined) ?? null;
  }

  async putCaller(row: CallerHistoryRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: { ...row, sk: sk.caller(row.aniHash), entityType: "call_assist_caller" },
      }),
    );
  }

  async getChronic(agencyId: string, locationKey: string): Promise<ChronicLocationRecord | null> {
    const out = await ddb.send(
      new GetCommand({ TableName: table(), Key: { agencyId, sk: sk.loc(locationKey) } }),
    );
    return (out.Item as ChronicLocationRecord | undefined) ?? null;
  }

  async putChronic(row: ChronicLocationRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: { ...row, sk: sk.loc(row.locationKey), entityType: "call_assist_chronic" },
      }),
    );
  }

  async listExternal(agencyId: string): Promise<ExternalAgencyRoute[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "EXT#" },
      }),
    );
    return (out.Items as ExternalAgencyRoute[]) ?? [];
  }

  async putExternal(row: ExternalAgencyRoute): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: { ...row, sk: sk.external(row.externalAgencyId), entityType: "call_assist_external" },
      }),
    );
  }

  async deleteExternal(agencyId: string, externalAgencyId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({ TableName: table(), Key: { agencyId, sk: sk.external(externalAgencyId) } }),
    );
  }

  async listKnowledge(agencyId: string): Promise<CallAssistKnowledgeArticle[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "KB#" },
      }),
    );
    return (out.Items as CallAssistKnowledgeArticle[]) ?? [];
  }

  async putKnowledge(row: CallAssistKnowledgeArticle): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: { ...row, sk: sk.knowledge(row.articleId), entityType: "call_assist_kb" },
      }),
    );
  }

  async deleteKnowledge(agencyId: string, articleId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({ TableName: table(), Key: { agencyId, sk: sk.knowledge(articleId) } }),
    );
  }

  async putRecordsRequest(row: CallAssistRecordsRequest): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: { ...row, sk: sk.records(row.requestId), entityType: "call_assist_records" },
      }),
    );
  }

  async listRecordsRequests(agencyId: string): Promise<CallAssistRecordsRequest[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "RECORDS#" },
      }),
    );
    return (out.Items as CallAssistRecordsRequest[]) ?? [];
  }

  async getRecordsRequest(agencyId: string, requestId: string): Promise<CallAssistRecordsRequest | null> {
    const out = await ddb.send(
      new GetCommand({ TableName: table(), Key: { agencyId, sk: sk.records(requestId) } }),
    );
    return (out.Item as CallAssistRecordsRequest | undefined) ?? null;
  }

  async putSurvey(row: {
    agencyId: string;
    sessionId: string;
    score: number;
    channel: string;
    comment?: string;
    createdAt: string;
  }): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: { ...row, sk: sk.survey(row.sessionId), entityType: "call_assist_survey" },
      }),
    );
  }

  async listSurveys(agencyId: string, limit = 200): Promise<Array<{ sessionId: string; score: number; channel: string; createdAt: string }>> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "SURVEY#" },
        Limit: limit,
      }),
    );
    return (out.Items as Array<{ sessionId: string; score: number; channel: string; createdAt: string }>) ?? [];
  }

  async putDemoRun(row: Record<string, unknown> & { agencyId: string; runId: string }): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: { ...row, sk: sk.demoRun(row.runId), entityType: "call_assist_demo" },
      }),
    );
  }

  async getShift(agencyId: string): Promise<CallAssistShiftRecord | null> {
    const out = await ddb.send(new GetCommand({ TableName: table(), Key: { agencyId, sk: sk.shift() } }));
    const row = (out.Item as CallAssistShiftRecord | undefined) ?? null;
    if (!row) return null;
    if (Date.parse(row.expiresAt) <= Date.now()) return null;
    return row.agencyId === agencyId ? row : null;
  }

  async putShift(row: CallAssistShiftRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: { ...row, sk: sk.shift(), entityType: "call_assist_shift" },
      }),
    );
  }

  async deleteShift(agencyId: string): Promise<void> {
    await ddb.send(new DeleteCommand({ TableName: table(), Key: { agencyId, sk: sk.shift() } }));
  }

  async putDidLookup(phoneNumber: string, targetAgencyId: string): Promise<void> {
    const e164 = normalizeCallAssistDid(phoneNumber);
    if (!e164 || !targetAgencyId) return;
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          agencyId: CALL_ASSIST_DID_INDEX_PK,
          sk: sk.did(e164),
          entityType: "call_assist_did",
          targetAgencyId,
          testDID: e164,
          updatedAt: new Date().toISOString(),
        },
      }),
    );
  }

  async getAgencyIdByDid(phoneNumber: string): Promise<string | null> {
    const e164 = normalizeCallAssistDid(phoneNumber);
    if (!e164) return null;
    const out = await ddb.send(
      new GetCommand({ TableName: table(), Key: { agencyId: CALL_ASSIST_DID_INDEX_PK, sk: sk.did(e164) } }),
    );
    const row = out.Item as { targetAgencyId?: string } | undefined;
    return row?.targetAgencyId?.trim() || null;
  }
}

export const callAssistStore = new CallAssistStore();
