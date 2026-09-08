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
  CallAssistGisZone,
  CallAssistPremiseHazard,
  BotRebuildQueueEntry,
  LexBotRecord,
  CallAssistCallbackCampaign,
  CallAssistCallbackSettings,
  CallAssistSmsSelfService,
  CallAssistQaReview,
  CallAssistPromptRecord,
  CallAssistPromptKey,
  CallAssistPromptProposal,
  CallAssistTransferLedgerEntry,
  CallAssistSentiment,
  VoiceEmotionAssessment,
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
  tenantCity?: string;
  tenantState?: string;
  gisZones?: CallAssistGisZone[];
  seededProfile?: string;
  callback?: CallAssistCallbackSettings;
  selfServiceSmsEnabled?: boolean;
  promptOverrides?: Partial<Record<string, string>>;
  promptPackVersion?: string;
  retentionLastRun?: {
    at: string;
    sessionsDeleted: number;
    transcriptsRedacted: number;
    audioRedacted: number;
    surveysDeleted: number;
    skippedLegalHold: number;
  };
  /** Tenant test DID (E.164). Never a live PSAP/911 number. */
  testDID?: string;
  lexBotId?: string;
  lexBotAliasId?: string;
  lexBotName?: string;
  emergencyLine?: string;
  nonEmergencyWebsite?: string;
  openingGreeting?: string;
  afterHoursMessage?: string;
  defaultLanguageCode?: string;
  supportedLanguages?: string[];
  connectContactFlowId?: string;
  connectQueueArn?: string;
  connectEmergencyQueueArn?: string;
  agencyDisplayName?: string;
  agencyTypeLabel?: string;
  officerLabel?: string;
  defaultLocale?: "en_US" | "es_US" | "zh_CN" | "fr_CA";
  supportedLocales?: Array<"en_US" | "es_US" | "zh_CN" | "fr_CA">;
  lexBotTemplateVersion?: string;
  lexBotStatus?: string;
  connectInstanceId?: string;
  connectContactFlowArn?: string;
  connectNonEmergencyDID?: string;
  transcribeVocabularyName?: string;
  transcribeVocabularyStatus?: string;
  aiDisclosureRequired?: boolean;
  onboardingStatus?: string;
  onboardingSteps?: Array<{
    step: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    error?: string;
  }>;
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

export type CallAssistKnowledgeVersion = {
  version: number;
  title: string;
  body: string;
  updatedAt: string;
};

export type CallAssistKnowledgeArticle = {
  agencyId: string;
  articleId: string;
  title: string;
  body: string;
  tags: string[];
  enabled: boolean;
  updatedAt: string;
  source?: string;
  sourceType?: "manual" | "url" | "policy" | "import";
  version?: number;
  previousBodies?: CallAssistKnowledgeVersion[];
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
  lastConfidence?: number;
  confidenceSource?: string;
  confidenceAction?: string;
  confidenceBelowThreshold?: boolean;
  qaLowConfidence?: boolean;
  lastConfidenceUtterance?: string;
  bargeInCount?: number;
  lastBargeInAt?: string;
  knowledgeHit?: boolean;
  knowledgeArticleId?: string;
  knowledgeExcerpt?: string;
  aliAddress?: string;
  askedQuestionIds?: string[];
  lastQuestionId?: string;
  intentConfidence?: number;
  classificationConfidence?: number;
  locationConfidence?: number;
  routingConfidence?: number;
  cadNatureCode?: string;
  cadPriority?: 1 | 2 | 3 | 4;
  cadTypeLabel?: string;
  smsFallbackRecommended?: boolean;
  ttySmsScript?: string;
  ttySource?: string;
  premiseHazards?: CallAssistPremiseHazard[];
  duplicateCadIds?: string[];
  chronicLocation?: boolean;
  repeatCaller?: boolean;
  callback?: CallAssistCallbackCampaign;
  smsSelfService?: CallAssistSmsSelfService;
  shiftLabel?: string;
  dispatcherId?: string;
  humanTakeover?: boolean;
  falseTransferSuspected?: boolean;
  rmsReportNumber?: string;
  rmsExternalId?: string;
  rmsTarget?: string;
  audioPurgedAt?: string;
  transcriptPurgedAt?: string;
  sentiment?: CallAssistSentiment;
  voiceEmotion?: VoiceEmotionAssessment;
  lastTransferOutcome?: string;
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
  lexBot: (locale: string) => `LEXBOT#${locale}`,
  rebuild: (queuedAt: string) => `REBUILD#${queuedAt}`,
  callback: (id: string) => `CALLBACK#${id}`,
  qa: (sessionId: string) => `QA#${sessionId}`,
  prompt: (id: string) => `PROMPT#${id}`,
  token: (token: string) => `TOKEN#${token}`,
  xfer: (sessionId: string, ledgerId: string) => `XFER#${sessionId}#${ledgerId}`,
  proposal: (id: string) => `PROPOSAL#${id}`,
};

export const CALL_ASSIST_SELF_SERVICE_INDEX_PK = "__self_service__";

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
        Item: {
          ...config,
          sk: sk.config(),
          entityType: "call_assist_config",
          gsi1pk: "CALLASSIST#CONFIG",
          gsi1sk: config.agencyId,
        },
      }),
    );
  }

  async putSession(session: CallAssistSessionRecord): Promise<void> {
    const open = !session.completedAt && session.state !== "COMPLETED" && session.state !== "FAILED";
    const createdMs = Date.parse(session.createdAt);
    const safetyTtl =
      !session.legalHold && !open && Number.isFinite(createdMs)
        ? Math.floor(createdMs / 1000) + 365 * 8 * 86_400
        : undefined;
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...session,
          sk: sk.session(session.sessionId),
          entityType: "call_assist_session",
          gsi1pk: `${session.agencyId}#${open ? "OPEN" : "DONE"}`,
          gsi1sk: session.createdAt,
          ...(safetyTtl ? { expiresAt: safetyTtl } : {}),
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

  async deleteSessionIfNotOnLegalHold(agencyId: string, sessionId: string): Promise<boolean> {
    try {
      await ddb.send(
        new DeleteCommand({
          TableName: table(),
          Key: { agencyId, sk: sk.session(sessionId) },
          ConditionExpression: "attribute_not_exists(legalHold) OR legalHold = :f",
          ExpressionAttributeValues: { ":f": false },
        }),
      );
      return true;
    } catch (e: unknown) {
      const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
      if (name === "ConditionalCheckFailedException") return false;
      throw e;
    }
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

  async listAllKnowledge(agencyId: string): Promise<CallAssistKnowledgeArticle[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "KB#" },
      }),
    );
    return ((out.Items as CallAssistKnowledgeArticle[]) ?? []).filter((row) => row.agencyId === agencyId);
  }

  async listKnowledge(agencyId: string): Promise<CallAssistKnowledgeArticle[]> {
    return (await this.listAllKnowledge(agencyId)).filter((row) => row.enabled !== false);
  }

  async getKnowledge(agencyId: string, articleId: string): Promise<CallAssistKnowledgeArticle | null> {
    const out = await ddb.send(
      new GetCommand({ TableName: table(), Key: { agencyId, sk: sk.knowledge(articleId) } }),
    );
    const row = out.Item as CallAssistKnowledgeArticle | undefined;
    return row?.agencyId === agencyId ? row : null;
  }

  async putKnowledge(row: CallAssistKnowledgeArticle): Promise<CallAssistKnowledgeArticle> {
    const existing = await this.getKnowledge(row.agencyId, row.articleId);
    let version = existing?.version ?? 1;
    let previousBodies = existing?.previousBodies ?? [];
    if (existing && (existing.body !== row.body || existing.title !== row.title)) {
      previousBodies = [
        {
          version,
          title: existing.title,
          body: existing.body,
          updatedAt: existing.updatedAt,
        },
        ...previousBodies,
      ].slice(0, 10);
      version += 1;
    }
    const next: CallAssistKnowledgeArticle = {
      ...existing,
      ...row,
      source: row.source ?? existing?.source,
      sourceType: row.sourceType ?? existing?.sourceType ?? "manual",
      version,
      previousBodies,
    };
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: { ...next, sk: sk.knowledge(next.articleId), entityType: "call_assist_kb" },
      }),
    );
    return next;
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

  async listTenantConfigs(limit = 200): Promise<CallAssistTenantConfig[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": "CALLASSIST#CONFIG" },
        Limit: limit,
      }),
    );
    return ((out.Items ?? []) as CallAssistTenantConfig[]).filter((row) => row.agencyId);
  }

  async putLexBot(record: LexBotRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...record,
          sk: sk.lexBot(record.locale),
          entityType: "call_assist_lex_bot",
          gsi1pk: "CALLASSIST#LEXBOT",
          gsi1sk: `${record.status}#${record.updatedAt}`,
        },
      }),
    );
  }

  async listLexBots(limit = 200): Promise<LexBotRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": "CALLASSIST#LEXBOT" },
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as LexBotRecord[];
  }

  async enqueueRebuild(entry: BotRebuildQueueEntry): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...entry,
          sk: sk.rebuild(entry.queuedAt),
          entityType: "call_assist_bot_rebuild",
          gsi1pk: `CALLASSIST#REBUILD#${entry.status}`,
          gsi1sk: entry.queuedAt,
        },
      }),
    );
  }

  async dequeueNextRebuild(depth = 0): Promise<BotRebuildQueueEntry | null> {
    if (depth > 8) return null;
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": "CALLASSIST#REBUILD#QUEUED" },
        Limit: 1,
        ScanIndexForward: true,
      }),
    );
    const row = (out.Items?.[0] as BotRebuildQueueEntry | undefined) ?? null;
    if (!row) return null;
    const next: BotRebuildQueueEntry = { ...row, status: "IN_PROGRESS", attempts: row.attempts + 1 };
    try {
      await ddb.send(
        new PutCommand({
          TableName: table(),
          Item: {
            ...next,
            sk: sk.rebuild(next.queuedAt),
            entityType: "call_assist_bot_rebuild",
            gsi1pk: `CALLASSIST#REBUILD#${next.status}`,
            gsi1sk: next.queuedAt,
          },
          ConditionExpression: "#s = :queued",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":queued": "QUEUED" },
        }),
      );
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "ConditionalCheckFailedException") {
        return this.dequeueNextRebuild(depth + 1);
      }
      throw err;
    }
    return next;
  }

  async completeRebuild(entry: BotRebuildQueueEntry, status: "COMPLETE" | "FAILED", error?: string): Promise<void> {
    await this.enqueueRebuild({
      ...entry,
      status,
      processedAt: new Date().toISOString(),
      lastError: error,
    });
  }

  async putCallback(row: CallAssistCallbackCampaign): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...row,
          sk: sk.callback(row.callbackId),
          entityType: "call_assist_callback",
          gsi1pk: `${row.agencyId}#CALLBACK#${row.status}`,
          gsi1sk: row.dueAt,
        },
      }),
    );
  }

  async getCallback(agencyId: string, callbackId: string): Promise<CallAssistCallbackCampaign | null> {
    const out = await ddb.send(
      new GetCommand({ TableName: table(), Key: { agencyId, sk: sk.callback(callbackId) } }),
    );
    const row = out.Item as CallAssistCallbackCampaign | undefined;
    return row?.agencyId === agencyId ? row : null;
  }

  async listCallbacks(agencyId: string, status?: string, limit = 100): Promise<CallAssistCallbackCampaign[]> {
    if (status) {
      const out = await ddb.send(
        new QueryCommand({
          TableName: table(),
          IndexName: "gsi1",
          KeyConditionExpression: "gsi1pk = :p",
          ExpressionAttributeValues: { ":p": `${agencyId}#CALLBACK#${status}` },
          ScanIndexForward: true,
          Limit: Math.min(200, Math.max(1, limit)),
        }),
      );
      return ((out.Items as CallAssistCallbackCampaign[]) ?? []).filter((row) => row.agencyId === agencyId);
    }
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "CALLBACK#" },
        Limit: Math.min(200, Math.max(1, limit)),
      }),
    );
    return ((out.Items as CallAssistCallbackCampaign[]) ?? []).filter((row) => row.agencyId === agencyId);
  }

  async listDueCallbacks(agencyId: string, nowIso: string, limit = 50): Promise<CallAssistCallbackCampaign[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :p AND gsi1sk <= :due",
        ExpressionAttributeValues: { ":p": `${agencyId}#CALLBACK#QUEUED`, ":due": nowIso },
        Limit: Math.min(100, Math.max(1, limit)),
      }),
    );
    return ((out.Items as CallAssistCallbackCampaign[]) ?? []).filter((row) => row.agencyId === agencyId);
  }

  async putSelfServiceToken(row: {
    token: string;
    agencyId: string;
    sessionId: string;
    portalUrl: string;
    expiresAt: number;
  }): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          agencyId: CALL_ASSIST_SELF_SERVICE_INDEX_PK,
          sk: sk.token(row.token),
          entityType: "call_assist_self_service_token",
          targetAgencyId: row.agencyId,
          sessionId: row.sessionId,
          portalUrl: row.portalUrl,
          expiresAt: row.expiresAt,
        },
      }),
    );
  }

  async getSelfServiceToken(token: string): Promise<{
    agencyId: string;
    sessionId: string;
    portalUrl: string;
  } | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { agencyId: CALL_ASSIST_SELF_SERVICE_INDEX_PK, sk: sk.token(token) },
      }),
    );
    const row = out.Item as { targetAgencyId?: string; sessionId?: string; portalUrl?: string; expiresAt?: number } | undefined;
    if (!row?.targetAgencyId || !row.sessionId) return null;
    if (typeof row.expiresAt === "number" && row.expiresAt * 1000 < Date.now() && row.expiresAt < 4_000_000_000) {
      if (row.expiresAt < Date.now() / 1000) return null;
    }
    return { agencyId: row.targetAgencyId, sessionId: row.sessionId, portalUrl: row.portalUrl ?? "" };
  }

  async putQaReview(row: CallAssistQaReview): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...row,
          sk: sk.qa(row.sessionId),
          entityType: "call_assist_qa",
          gsi1pk: `${row.agencyId}#QA`,
          gsi1sk: row.createdAt,
        },
      }),
    );
  }

  async getQaReview(agencyId: string, sessionId: string): Promise<CallAssistQaReview | null> {
    const out = await ddb.send(
      new GetCommand({ TableName: table(), Key: { agencyId, sk: sk.qa(sessionId) } }),
    );
    const row = out.Item as CallAssistQaReview | undefined;
    return row?.agencyId === agencyId ? row : null;
  }

  async listQaReviews(agencyId: string, limit = 200): Promise<CallAssistQaReview[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :p",
        ExpressionAttributeValues: { ":p": `${agencyId}#QA` },
        ScanIndexForward: false,
        Limit: Math.min(400, Math.max(1, limit)),
      }),
    );
    return ((out.Items as CallAssistQaReview[]) ?? []).filter((row) => row.agencyId === agencyId);
  }

  async putPrompt(row: CallAssistPromptRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: { ...row, sk: sk.prompt(row.promptId), entityType: "call_assist_prompt" },
      }),
    );
  }

  async getPrompt(agencyId: string, promptId: CallAssistPromptKey): Promise<CallAssistPromptRecord | null> {
    const out = await ddb.send(
      new GetCommand({ TableName: table(), Key: { agencyId, sk: sk.prompt(promptId) } }),
    );
    const row = out.Item as CallAssistPromptRecord | undefined;
    return row?.agencyId === agencyId ? row : null;
  }

  async listPrompts(agencyId: string): Promise<CallAssistPromptRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "PROMPT#" },
      }),
    );
    return ((out.Items as CallAssistPromptRecord[]) ?? []).filter((row) => row.agencyId === agencyId);
  }

  async deleteSurvey(agencyId: string, sessionId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({ TableName: table(), Key: { agencyId, sk: sk.survey(sessionId) } }),
    );
  }

  async putTransfer(row: CallAssistTransferLedgerEntry): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...row,
          sk: sk.xfer(row.sessionId, row.ledgerId),
          entityType: "call_assist_transfer",
          gsi1pk: `${row.agencyId}#XFER#${row.sessionId}`,
          gsi1sk: row.startedAt,
        },
      }),
    );
  }

  async listTransfers(agencyId: string, sessionId: string): Promise<CallAssistTransferLedgerEntry[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": `XFER#${sessionId}#` },
      }),
    );
    const rows = ((out.Items as CallAssistTransferLedgerEntry[]) ?? []).filter((row) => row.agencyId === agencyId);
    return rows.sort((a, b) => a.attempt - b.attempt);
  }

  async putPromptProposal(row: CallAssistPromptProposal): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...row,
          sk: sk.proposal(row.proposalId),
          entityType: "call_assist_prompt_proposal",
          gsi1pk: `${row.agencyId}#PROPOSAL`,
          gsi1sk: row.submittedAt,
        },
      }),
    );
  }

  async getPromptProposal(agencyId: string, proposalId: string): Promise<CallAssistPromptProposal | null> {
    const out = await ddb.send(
      new GetCommand({ TableName: table(), Key: { agencyId, sk: sk.proposal(proposalId) } }),
    );
    const row = out.Item as CallAssistPromptProposal | undefined;
    return row?.agencyId === agencyId ? row : null;
  }

  async listPromptProposals(agencyId: string, limit = 100): Promise<CallAssistPromptProposal[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :p",
        ExpressionAttributeValues: { ":p": `${agencyId}#PROPOSAL` },
        ScanIndexForward: false,
        Limit: Math.min(200, Math.max(1, limit)),
      }),
    );
    return ((out.Items as CallAssistPromptProposal[]) ?? []).filter((row) => row.agencyId === agencyId);
  }
}

export const callAssistStore = new CallAssistStore();
