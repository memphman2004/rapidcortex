import {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Incident, SopProtocolOverlayState } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";
import { RETENTION_DUE_GSI, RETENTION_GSI_PK, retentionQueryUpperBoundSk } from "../lib/retentionPolicy.js";

export class IncidentRepository {
  async create(incident: Incident): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: env.incidentsTable,
        Item: incident,
      }),
    );
  }

  async get(incidentId: string): Promise<Incident | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: env.incidentsTable,
        Key: { incidentId },
      }),
    );
    return (result.Item as Incident) ?? null;
  }

  async listByAgency(agencyId: string): Promise<Incident[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.incidentsTable,
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: {
          ":agencyId": agencyId,
        },
        ScanIndexForward: false,
      }),
    );

    return (result.Items as Incident[]) ?? [];
  }

  /** Newest first, capped (for platform dashboards — avoids reading entire tenant history). */
  async listByAgencyWithLimit(agencyId: string, limit: number): Promise<Incident[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.incidentsTable,
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: {
          ":agencyId": agencyId,
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );

    return (result.Items as Incident[]) ?? [];
  }

  async listByAgencySince(agencyId: string, sinceIso: string, limit = 500): Promise<Incident[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.incidentsTable,
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a AND createdAt >= :s",
        ExpressionAttributeValues: {
          ":a": agencyId,
          ":s": sinceIso,
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (result.Items as Incident[]) ?? [];
  }

  async listByAgencySincePaginated(
    agencyId: string,
    sinceIso: string,
    limit: number,
    exclusiveStartKey?: string,
  ): Promise<{ items: Incident[]; nextCursor?: string }> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.incidentsTable,
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a AND createdAt >= :s",
        ExpressionAttributeValues: {
          ":a": agencyId,
          ":s": sinceIso,
        },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey
          ? (JSON.parse(exclusiveStartKey) as Record<string, unknown>)
          : undefined,
      }),
    );
    const items = (result.Items as Incident[]) ?? [];
    const nextCursor = result.LastEvaluatedKey
      ? JSON.stringify(result.LastEvaluatedKey)
      : undefined;
    return { items, nextCursor };
  }

  async patchDispatchFields(
    incidentId: string,
    fields: {
      escalationFlag?: boolean;
      dispatcherReviewAcknowledgedAt?: string | null;
      callerLanguage?: string | null;
    },
  ): Promise<void> {
    const sets = ["updatedAt = :updatedAt"];
    const values: Record<string, unknown> = {
      ":updatedAt": new Date().toISOString(),
    };
    if (fields.escalationFlag !== undefined) {
      sets.push("escalationFlag = :escalationFlag");
      values[":escalationFlag"] = fields.escalationFlag;
    }
    if (fields.dispatcherReviewAcknowledgedAt !== undefined) {
      sets.push("dispatcherReviewAcknowledgedAt = :dra");
      values[":dra"] = fields.dispatcherReviewAcknowledgedAt;
    }
    if (fields.callerLanguage !== undefined) {
      sets.push("callerLanguage = :callerLanguage");
      values[":callerLanguage"] = fields.callerLanguage;
    }
    await ddb.send(
      new UpdateCommand({
        TableName: env.incidentsTable,
        Key: { incidentId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeValues: values,
      }),
    );
  }

  /**
   * Best-effort mutex for cross-invocation analysis dedupe. Lease expires via wall-clock comparison.
   */
  async tryAcquireAnalysisLock(incidentId: string, leaseSeconds: number): Promise<boolean> {
    const until = new Date(Date.now() + leaseSeconds * 1000).toISOString();
    const now = new Date().toISOString();
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: env.incidentsTable,
          Key: { incidentId },
          UpdateExpression: "SET analysisInFlightUntil = :until, updatedAt = :now",
          ConditionExpression:
            "attribute_not_exists(analysisInFlightUntil) OR analysisInFlightUntil < :nowIso",
          ExpressionAttributeValues: {
            ":until": until,
            ":now": now,
            ":nowIso": now,
          },
        }),
      );
      return true;
    } catch (e: unknown) {
      const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
      if (name === "ConditionalCheckFailedException") return false;
      throw e;
    }
  }

  async releaseAnalysisLock(incidentId: string): Promise<void> {
    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: env.incidentsTable,
        Key: { incidentId },
        UpdateExpression: "REMOVE analysisInFlightUntil SET updatedAt = :now",
        ExpressionAttributeValues: { ":now": now },
      }),
    );
  }

  async updateSopProtocolOverlay(incidentId: string, overlay: SopProtocolOverlayState): Promise<void> {
    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: env.incidentsTable,
        Key: { incidentId },
        UpdateExpression: "SET sopProtocolOverlay = :o, updatedAt = :u",
        ExpressionAttributeValues: {
          ":o": overlay,
          ":u": now,
        },
      }),
    );
  }

  async updateAnalysisFields(
    incidentId: string,
    fields: Pick<
      Incident,
      "category" | "urgency" | "confidence" | "summary" | "escalationFlag" | "updatedAt"
    >,
  ): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: env.incidentsTable,
        Key: { incidentId },
        UpdateExpression: `
        SET category = :category,
            urgency = :urgency,
            confidence = :confidence,
            summary = :summary,
            escalationFlag = :escalationFlag,
            updatedAt = :updatedAt
      `,
        ExpressionAttributeValues: {
          ":category": fields.category,
          ":urgency": fields.urgency,
          ":confidence": fields.confidence,
          ":summary": fields.summary,
          ":escalationFlag": fields.escalationFlag,
          ":updatedAt": fields.updatedAt,
        },
      }),
    );
  }

  async updateCallerAddress(
    incidentId: string,
    fields: {
      callerAddressLine: string | null;
      callerAddressNormalized: string | null;
      callerLocationLat?: number | null;
      callerLocationLng?: number | null;
      callerLocationMapLabel?: string | null;
    },
  ): Promise<void> {
    const now = new Date().toISOString();
    const sets = [
      "callerAddressLine = :l",
      "callerAddressNormalized = :n",
      "updatedAt = :u",
    ];
    const vals: Record<string, unknown> = {
      ":l": fields.callerAddressLine,
      ":n": fields.callerAddressNormalized,
      ":u": now,
    };
    if (fields.callerLocationLat !== undefined) {
      sets.push("callerLocationLat = :lat");
      vals[":lat"] = fields.callerLocationLat;
    }
    if (fields.callerLocationLng !== undefined) {
      sets.push("callerLocationLng = :lng");
      vals[":lng"] = fields.callerLocationLng;
    }
    if (fields.callerLocationMapLabel !== undefined) {
      sets.push("callerLocationMapLabel = :ml");
      vals[":ml"] = fields.callerLocationMapLabel;
    }
    await ddb.send(
      new UpdateCommand({
        TableName: env.incidentsTable,
        Key: { incidentId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeValues: vals,
      }),
    );
  }

  /** Agency API (`/api/v1`) — partial patch for approved integration fields only. */
  async patchIntegrationFields(
    incidentId: string,
    fields: Partial<
      Pick<Incident, "title" | "status" | "category" | "urgency" | "summary" | "escalationFlag">
    > & {
      callerAddressLine?: string | null;
      callerAddressNormalized?: string | null;
    },
  ): Promise<void> {
    const now = new Date().toISOString();
    const sets: string[] = ["updatedAt = :u"];
    const vals: Record<string, unknown> = { ":u": now };
    const names: Record<string, string> = {};
    if (fields.title !== undefined) {
      sets.push("#t = :t");
      names["#t"] = "title";
      vals[":t"] = fields.title;
    }
    if (fields.status !== undefined) {
      sets.push("#s = :st");
      names["#s"] = "status";
      vals[":st"] = fields.status;
    }
    if (fields.category !== undefined) {
      sets.push("category = :c");
      vals[":c"] = fields.category;
    }
    if (fields.urgency !== undefined) {
      sets.push("urgency = :ur");
      vals[":ur"] = fields.urgency;
    }
    if (fields.summary !== undefined) {
      sets.push("summary = :su");
      vals[":su"] = fields.summary;
    }
    if (fields.escalationFlag !== undefined) {
      sets.push("escalationFlag = :e");
      vals[":e"] = fields.escalationFlag;
    }
    if (fields.callerAddressLine !== undefined) {
      sets.push("callerAddressLine = :cal");
      vals[":cal"] = fields.callerAddressLine;
    }
    if (fields.callerAddressNormalized !== undefined) {
      sets.push("callerAddressNormalized = :can");
      vals[":can"] = fields.callerAddressNormalized;
    }
    await ddb.send(
      new UpdateCommand({
        TableName: env.incidentsTable,
        Key: { incidentId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ...(Object.keys(names).length
          ? { ExpressionAttributeNames: names }
          : {}),
        ExpressionAttributeValues: vals,
      }),
    );
  }

  /** Dispatcher CAD entry workspace — partial update of CAD mirror fields + summary (no vendor write-back). */
  async patchDispatcherCadWorkspace(
    incidentId: string,
    fields: {
      summary?: string;
      cadNatureCode?: string | null;
      cadPriority?: string | null;
      cadLocation?: string | null;
      cadUnits?: string[] | null;
      cadCallerName?: string | null;
      cadCallerCallbackMasked?: string | null;
      urgency?: Incident["urgency"];
    },
  ): Promise<void> {
    const now = new Date().toISOString();
    const sets: string[] = ["updatedAt = :u"];
    const vals: Record<string, unknown> = { ":u": now };
    if (fields.summary !== undefined) {
      sets.push("summary = :su");
      vals[":su"] = fields.summary;
    }
    if (fields.cadNatureCode !== undefined) {
      sets.push("cadNatureCode = :cn");
      vals[":cn"] = fields.cadNatureCode;
    }
    if (fields.cadPriority !== undefined) {
      sets.push("cadPriority = :cp");
      vals[":cp"] = fields.cadPriority;
    }
    if (fields.cadLocation !== undefined) {
      sets.push("cadLocation = :cl");
      vals[":cl"] = fields.cadLocation;
    }
    if (fields.cadUnits !== undefined) {
      sets.push("cadUnits = :cu");
      vals[":cu"] = fields.cadUnits;
    }
    if (fields.cadCallerName !== undefined) {
      sets.push("cadCallerName = :ccn");
      vals[":ccn"] = fields.cadCallerName;
    }
    if (fields.cadCallerCallbackMasked !== undefined) {
      sets.push("cadCallerCallbackMasked = :ccc");
      vals[":ccc"] = fields.cadCallerCallbackMasked;
    }
    if (fields.urgency !== undefined) {
      sets.push("urgency = :ur");
      vals[":ur"] = fields.urgency;
    }
    await ddb.send(
      new UpdateCommand({
        TableName: env.incidentsTable,
        Key: { incidentId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeValues: vals,
      }),
    );
  }

  async listByAgencyAndCallerAddressNormalized(
    agencyId: string,
    callerAddressNormalized: string,
    opts: { excludeIncidentId?: string; limit?: number } = {},
  ): Promise<Incident[]> {
    const limit = Math.min(opts.limit ?? 25, 50);
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.incidentsTable,
        IndexName: "agencyId-callerAddressNormalized-index",
        KeyConditionExpression: "agencyId = :a AND callerAddressNormalized = :addr",
        ExpressionAttributeValues: {
          ":a": agencyId,
          ":addr": callerAddressNormalized,
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    const rows = (result.Items as Incident[]) ?? [];
    if (!opts.excludeIncidentId) return rows;
    return rows.filter((r) => r.incidentId !== opts.excludeIncidentId);
  }

  /**
   * Prior incidents at the same normalized caller address within `minCreatedAtIso` (inclusive).
   * Uses the address GSI with a `createdAt` filter; paginates until `maxItems` matches or the index is exhausted.
   */
  async listByAgencyAndCallerAddressNormalizedSince(
    agencyId: string,
    callerAddressNormalized: string,
    opts: { excludeIncidentId?: string; minCreatedAtIso: string; maxItems?: number },
  ): Promise<Incident[]> {
    const maxItems = Math.min(opts.maxItems ?? 150, 200);
    const out: Incident[] = [];
    let startKey: Record<string, unknown> | undefined;
    for (let page = 0; page < 60 && out.length < maxItems; page++) {
      const result = await ddb.send(
        new QueryCommand({
          TableName: env.incidentsTable,
          IndexName: "agencyId-callerAddressNormalized-index",
          KeyConditionExpression: "agencyId = :a AND callerAddressNormalized = :addr",
          FilterExpression: "createdAt >= :min",
          ExpressionAttributeValues: {
            ":a": agencyId,
            ":addr": callerAddressNormalized,
            ":min": opts.minCreatedAtIso,
          },
          ScanIndexForward: false,
          Limit: 40,
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      const rows = (result.Items as Incident[]) ?? [];
      for (const r of rows) {
        if (opts.excludeIncidentId && r.incidentId === opts.excludeIncidentId) continue;
        out.push(r);
        if (out.length >= maxItems) {
          return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
        }
      }
      if (!result.LastEvaluatedKey) break;
      startKey = result.LastEvaluatedKey as Record<string, unknown>;
    }
    return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }

  /**
   * Due rows for the retention GSI (sparse — only items with `retGsiPk` = `RETENTION`).
   * Caller must re-check `legalHold` and child dependencies before `deleteIfEligible`.
   */
  async listRetentionDue(
    pageSize: number,
    startKey?: Record<string, unknown>,
  ): Promise<{ items: Incident[]; lastKey?: Record<string, unknown> }> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: env.incidentsTable,
        IndexName: RETENTION_DUE_GSI,
        KeyConditionExpression: "retGsiPk = :p AND retGsiSk <= :max",
        ExpressionAttributeValues: {
          ":p": RETENTION_GSI_PK,
          ":max": retentionQueryUpperBoundSk(),
        },
        Limit: pageSize,
        ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      }),
    );
    return { items: (out.Items as Incident[]) ?? [], lastKey: out.LastEvaluatedKey };
  }

  async findByCadDedupeKey(cadDedupeKey: string): Promise<Incident | null> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.incidentsTable,
        IndexName: "cadDedupeKey-index",
        KeyConditionExpression: "cadDedupeKey = :k",
        ExpressionAttributeValues: { ":k": cadDedupeKey },
        Limit: 1,
      }),
    );
    return ((result.Items?.[0] as Incident) ?? null) ?? null;
  }

  /**
   * CAD ingest: locate an existing incident by vendor call number within an agency.
   * Uses `agencyId-createdAt-index` with a filter (no dedicated cadIncidentId GSI yet).
   */
  async findByCadIncidentId(agencyId: string, cadIncidentId: string): Promise<Incident | null> {
    let startKey: Record<string, unknown> | undefined;
    for (let page = 0; page < 40; page++) {
      const result = await ddb.send(
        new QueryCommand({
          TableName: env.incidentsTable,
          IndexName: "agencyId-createdAt-index",
          KeyConditionExpression: "agencyId = :a",
          FilterExpression: "cadIncidentId = :c",
          ExpressionAttributeValues: {
            ":a": agencyId,
            ":c": cadIncidentId,
          },
          Limit: 40,
          ScanIndexForward: false,
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      const items = (result.Items as Incident[] | undefined) ?? [];
      if (items.length > 0) return items[0] ?? null;
      if (!result.LastEvaluatedKey) break;
      startKey = result.LastEvaluatedKey as Record<string, unknown>;
    }
    return null;
  }

  /** CAD ingest: partial update without replacing the full item (avoids clobbering unrelated fields). */
  async patchFromCadIngest(
    incidentId: string,
    fields: {
      cadRevision: number;
      cadVendorRevisionLast?: number | null;
      cadLastSyncAt: string;
      cadStatus?: string | null;
      cadUnits?: string[];
      callerAddressLine?: string | null;
      callerAddressNormalized?: string | null;
      urgency: Incident["urgency"];
      title: string;
      cadNatureCode?: string | null;
      cadPriority?: string | null;
      cadLocation?: string | null;
      cadCoordinates?: Incident["cadCoordinates"] | null;
      cadRawPayload?: string | null;
      cadCallerName?: string | null;
      cadCallerCallbackMasked?: string | null;
      summary?: string;
      cadDedupeKey?: string | null;
      cadSystem?: Incident["cadSystem"];
      cadIncidentId?: string;
      source?: Incident["source"];
      cadPriorityModifier?: string | null;
      cadMappedIncidentTypeId?: string | null;
      cadDisposition?: string | null;
      cadIntersection?: string | null;
      cadBeat?: string | null;
      cadZone?: string | null;
      cadJurisdiction?: string | null;
      cadLocationConfidence?: string | null;
      cadLocationSource?: Incident["cadLocationSource"];
      cadUnitDetails?: Incident["cadUnitDetails"];
      cadCallerAddressLine?: string | null;
      cadAniAliSource?: Incident["cadAniAliSource"];
      cadRelatedCadNumbers?: string[];
      cadDuplicateOfCadNumber?: string | null;
      cadLinkedIncidentIds?: string[];
      cadAlerts?: Incident["cadAlerts"];
      category?: Incident["category"];
      escalationFlag?: boolean;
    },
  ): Promise<void> {
    const now = fields.cadLastSyncAt;
    const names: Record<string, string> = { "#src": "source" };
    const values: Record<string, unknown> = {
      ":cr": fields.cadRevision,
      ":ls": fields.cadLastSyncAt,
      ":u": now,
      ":ur": fields.urgency,
      ":ti": fields.title,
      ":cstat": fields.cadStatus ?? null,
      ":cu": fields.cadUnits ?? [],
      ":cal": fields.callerAddressLine ?? null,
      ":can": fields.callerAddressNormalized ?? null,
      ":cn": fields.cadNatureCode ?? null,
      ":cp": fields.cadPriority ?? null,
      ":cl": fields.cadLocation ?? null,
      ":cco": fields.cadCoordinates ?? null,
      ":crp": fields.cadRawPayload ?? null,
      ":ccn": fields.cadCallerName ?? null,
      ":ccb": fields.cadCallerCallbackMasked ?? null,
      ":su": fields.summary ?? "",
      ":cdk": fields.cadDedupeKey ?? null,
      ":csy": fields.cadSystem ?? null,
      ":cii": fields.cadIncidentId ?? null,
      ":src": fields.source ?? "cad",
      ":cvr": fields.cadVendorRevisionLast ?? null,
      ":cpm": fields.cadPriorityModifier ?? null,
      ":cmt": fields.cadMappedIncidentTypeId ?? null,
      ":cdisp": fields.cadDisposition ?? null,
      ":cint": fields.cadIntersection ?? null,
      ":cbeat": fields.cadBeat ?? null,
      ":czone": fields.cadZone ?? null,
      ":cjur": fields.cadJurisdiction ?? null,
      ":cloc": fields.cadLocationConfidence ?? null,
      ":clsrc": fields.cadLocationSource ?? null,
      ":cud": fields.cadUnitDetails ?? [],
      ":ccal": fields.cadCallerAddressLine ?? null,
      ":cani": fields.cadAniAliSource ?? null,
      ":crel": fields.cadRelatedCadNumbers ?? [],
      ":cdup": fields.cadDuplicateOfCadNumber ?? null,
      ":clnk": fields.cadLinkedIncidentIds ?? [],
      ":calt": fields.cadAlerts ?? [],
    };
    const sets = [
      "cadRevision = :cr",
      "cadLastSyncAt = :ls",
      "updatedAt = :u",
      "urgency = :ur",
      "title = :ti",
      "cadStatus = :cstat",
      "cadUnits = :cu",
      "callerAddressLine = :cal",
      "callerAddressNormalized = :can",
      "cadNatureCode = :cn",
      "cadPriority = :cp",
      "cadLocation = :cl",
      "cadCoordinates = :cco",
      "cadRawPayload = :crp",
      "cadCallerName = :ccn",
      "cadCallerCallbackMasked = :ccb",
      "summary = :su",
      "cadDedupeKey = :cdk",
      "cadSystem = :csy",
      "cadIncidentId = :cii",
      "#src = :src",
      "cadVendorRevisionLast = :cvr",
      "cadPriorityModifier = :cpm",
      "cadMappedIncidentTypeId = :cmt",
      "cadDisposition = :cdisp",
      "cadIntersection = :cint",
      "cadBeat = :cbeat",
      "cadZone = :czone",
      "cadJurisdiction = :cjur",
      "cadLocationConfidence = :cloc",
      "cadLocationSource = :clsrc",
      "cadUnitDetails = :cud",
      "cadCallerAddressLine = :ccal",
      "cadAniAliSource = :cani",
      "cadRelatedCadNumbers = :crel",
      "cadDuplicateOfCadNumber = :cdup",
      "cadLinkedIncidentIds = :clnk",
      "cadAlerts = :calt",
    ];
    if (fields.category) {
      sets.push("category = :cat");
      values[":cat"] = fields.category;
    }
    if (fields.escalationFlag === true) {
      sets.push("escalationFlag = :esc");
      values[":esc"] = true;
    }
    await ddb.send(
      new UpdateCommand({
        TableName: env.incidentsTable,
        Key: { incidentId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
  }

  async deleteIfNotOnLegalHold(incidentId: string): Promise<boolean> {
    try {
      await ddb.send(
        new DeleteCommand({
          TableName: env.incidentsTable,
          Key: { incidentId },
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
}
