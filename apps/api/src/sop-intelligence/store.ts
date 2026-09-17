import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  SOP_INTELLIGENCE_DEFAULT_LIBRARY,
  type SopIntelligencePendingStatus,
  type SopLibraryDocument,
} from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { nextPatternRecord, patternSk, type SopPatternRecord } from "./pattern-counter.js";

export type { SopPatternRecord };

export type DiscrepancyReportRecord = {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  agencyId: string;
  reportId: string;
  callId: string;
  dispatcherName?: string;
  telecom?: string;
  whatHappened: string;
  actionTaken?: string;
  sopGapIdentified: boolean;
  sopId?: string;
  stepId?: string;
  gapDescription?: string;
  rootCause?: string;
  gisCorrection?: string;
  vendorTicket?: string;
  resolutionStatus?: string;
  investigationNotes?: string;
  level?: "HIGH" | "MED" | "LOW";
  phase: 2;
  createdAt: string;
  ttl?: number;
};

export type PendingSopUpdateRecord = {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  agencyId: string;
  updateId: string;
  sopId: string;
  stepId: string;
  sopTitle: string;
  currentLang: string;
  suggestedLang: string;
  rationale: string;
  evidence: string[];
  evidenceCount: number;
  reportIds: string[];
  rootCauseType: string;
  confidence: number;
  status: SopIntelligencePendingStatus;
  generatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  deferredUntil?: string;
  ttl?: number;
};

export type SopLibraryRecord = SopLibraryDocument & {
  PK: string;
  SK: string;
  agencyId: string;
};

function reportsTable(): string {
  const t = env.sopIntelligenceReportsTable;
  if (!t) throw new Error("SOP_INTELLIGENCE_TABLES_UNAVAILABLE");
  return t;
}
function patternsTable(): string {
  const t = env.sopIntelligencePatternsTable;
  if (!t) throw new Error("SOP_INTELLIGENCE_TABLES_UNAVAILABLE");
  return t;
}
function pendingTable(): string {
  const t = env.sopIntelligencePendingTable;
  if (!t) throw new Error("SOP_INTELLIGENCE_TABLES_UNAVAILABLE");
  return t;
}
function libraryTable(): string {
  const t = env.sopIntelligenceLibraryTable;
  if (!t) throw new Error("SOP_INTELLIGENCE_TABLES_UNAVAILABLE");
  return t;
}

export class SopIntelligenceStore {
  async ensureLibrarySeeded(agencyId: string): Promise<SopLibraryRecord[]> {
    const existing = await this.listLibrary(agencyId);
    if (existing.length > 0) return existing;
    const now = new Date().toISOString();
    const seeded: SopLibraryRecord[] = SOP_INTELLIGENCE_DEFAULT_LIBRARY.map((doc) => ({
      ...doc,
      PK: agencyId,
      SK: `SOP#${doc.sopId}`,
      agencyId,
      version: 1,
      lastUpdated: now,
      lastUpdatedBy: "system:sop-intelligence-seed",
    }));
    await Promise.all(
      seeded.map((item) =>
        ddb.send(
          new PutCommand({
            TableName: libraryTable(),
            Item: item,
            ConditionExpression: "attribute_not_exists(PK)",
          }),
        ).catch(() => undefined),
      ),
    );
    return this.listLibrary(agencyId);
  }

  async listLibrary(agencyId: string): Promise<SopLibraryRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: libraryTable(),
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": agencyId, ":sk": "SOP#" },
      }),
    );
    return ((out.Items ?? []) as SopLibraryRecord[]).filter((row) => !row.SK.includes("#VER#"));
  }

  async getLibraryDoc(agencyId: string, sopId: string): Promise<SopLibraryRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: libraryTable(),
        Key: { PK: agencyId, SK: `SOP#${sopId}` },
      }),
    );
    return (out.Item as SopLibraryRecord | undefined) ?? null;
  }

  async putLibraryDoc(doc: SopLibraryRecord, previous?: SopLibraryRecord): Promise<void> {
    if (previous) {
      await ddb.send(
        new PutCommand({
          TableName: libraryTable(),
          Item: {
            ...previous,
            SK: `SOP#${previous.sopId}#VER#${previous.version}`,
            PK: previous.agencyId,
          },
        }),
      );
    }
    await ddb.send(
      new PutCommand({
        TableName: libraryTable(),
        Item: doc,
      }),
    );
  }

  async putReport(report: DiscrepancyReportRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: reportsTable(),
        Item: report,
      }),
    );
  }

  async listReports(agencyId: string, limit = 200): Promise<DiscrepancyReportRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: reportsTable(),
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": agencyId, ":sk": "REPORT#" },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as DiscrepancyReportRecord[];
  }

  async listGapReportsForSop(
    agencyId: string,
    sopId: string,
    limit = 50,
  ): Promise<DiscrepancyReportRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: reportsTable(),
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: { ":pk": `GAP#${agencyId}#${sopId}` },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as DiscrepancyReportRecord[];
  }

  async getPattern(agencyId: string, sopId: string, stepId: string): Promise<SopPatternRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: patternsTable(),
        Key: { PK: agencyId, SK: patternSk(sopId, stepId) },
      }),
    );
    return (out.Item as SopPatternRecord | undefined) ?? null;
  }

  async listPatterns(agencyId: string): Promise<SopPatternRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: patternsTable(),
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": agencyId, ":sk": "PATTERN#" },
      }),
    );
    return (out.Items ?? []) as SopPatternRecord[];
  }

  /** Read-then-write counter increment (no transaction). */
  async incrementPattern(params: {
    agencyId: string;
    sopId: string;
    stepId: string;
    sopTitle: string;
    reportId: string;
    gapDescription?: string;
  }): Promise<SopPatternRecord> {
    const existing = await this.getPattern(params.agencyId, params.sopId, params.stepId);
    const now = new Date().toISOString();
    const next = nextPatternRecord(existing, params, now);
    await ddb.send(
      new PutCommand({
        TableName: patternsTable(),
        Item: next,
      }),
    );
    return next;
  }

  async claimPatternSuggestion(agencyId: string, sopId: string, stepId: string): Promise<boolean> {
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: patternsTable(),
          Key: { PK: agencyId, SK: patternSk(sopId, stepId) },
          ConditionExpression: "attribute_exists(PK) AND (attribute_not_exists(suggestionGenerated) OR suggestionGenerated = :false)",
          UpdateExpression: "SET suggestionGenerated = :true",
          ExpressionAttributeValues: { ":true": true, ":false": false },
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async attachPendingToPattern(
    agencyId: string,
    sopId: string,
    stepId: string,
    pendingUpdateId: string,
  ): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: patternsTable(),
        Key: { PK: agencyId, SK: patternSk(sopId, stepId) },
        UpdateExpression: "SET pendingUpdateId = :id, suggestionGenerated = :true",
        ExpressionAttributeValues: { ":id": pendingUpdateId, ":true": true },
      }),
    );
  }

  async putPending(item: PendingSopUpdateRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: pendingTable(),
        Item: item,
      }),
    );
  }

  async getPending(agencyId: string, updateId: string): Promise<PendingSopUpdateRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: pendingTable(),
        Key: { PK: agencyId, SK: `PENDING#${updateId}` },
      }),
    );
    return (out.Item as PendingSopUpdateRecord | undefined) ?? null;
  }

  async listPending(agencyId: string): Promise<PendingSopUpdateRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: pendingTable(),
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: { ":pk": `PENDING#${agencyId}` },
        ScanIndexForward: false,
      }),
    );
    return (out.Items ?? []) as PendingSopUpdateRecord[];
  }

  async savePending(item: PendingSopUpdateRecord): Promise<void> {
    await this.putPending(item);
  }
}

export const sopIntelligenceStore = new SopIntelligenceStore();

export function newReportId(): string {
  return makeId("soprep");
}

export function newPendingId(): string {
  return makeId("soppend");
}
