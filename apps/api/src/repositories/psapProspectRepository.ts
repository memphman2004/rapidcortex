import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import type {
  AddPsapActivityRequest,
  PatchPsapProspectBody,
  PsapActivity,
  PsapMapPin,
  PsapOutreachStatus,
  PsapProspect,
  PsapProspectListQuery,
  PsapProspectListResponse,
  PsapProspectStats,
} from "rapid-cortex-shared";
import { PSAP_OUTREACH_STATUSES } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

function table(): string {
  const t = env.psapProspectsTable;
  if (!t) throw new Error("PSAP_PROSPECTS_TABLE_NOT_CONFIGURED");
  return t;
}

function emptyStats(): PsapProspectStats {
  const byStatus = Object.fromEntries(
    PSAP_OUTREACH_STATUSES.map((s) => [s, 0]),
  ) as Record<PsapOutreachStatus, number>;
  return { total: 0, byStatus, withAddress: 0, withContact: 0, totalEstimatedValue: 0 };
}

function matchesFilters(p: PsapProspect, q: PsapProspectListQuery): boolean {
  if (q.assignedToUserId && p.assignedToUserId !== q.assignedToUserId) return false;
  if (q.hasAddress === true && !p.mailingAddress?.streetAddress?.trim()) return false;
  if (q.hasAddress === false && p.mailingAddress?.streetAddress?.trim()) return false;
  if (q.hasContact === true && !p.primaryContactName?.trim()) return false;
  if (q.hasContact === false && p.primaryContactName?.trim()) return false;
  if (q.verifiedOnly === true && p.mailingAddress?.verified !== true) return false;
  if (q.search?.trim()) {
    const s = q.search.trim().toLowerCase();
    const hay = `${p.psapName} ${p.city} ${p.county}`.toLowerCase();
    if (!hay.includes(s)) return false;
  }
  return true;
}

function sortProspects(
  items: PsapProspect[],
  sortBy: PsapProspectListQuery["sortBy"] = "psapName",
  sortDir: PsapProspectListQuery["sortDir"] = "asc",
): PsapProspect[] {
  const dir = sortDir === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    const av = String(a[sortBy ?? "psapName"] ?? "");
    const bv = String(b[sortBy ?? "psapName"] ?? "");
    return av.localeCompare(bv) * dir;
  });
}

export class PsapProspectRepository {
  async get(psapId: string): Promise<PsapProspect | null> {
    const r = await ddb.send(new GetCommand({ TableName: table(), Key: { psapId } }));
    return (r.Item as PsapProspect | undefined) ?? null;
  }

  async findByPhone(phone: string): Promise<PsapProspect | null> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "PhoneIndex",
        KeyConditionExpression: "phone = :p",
        ExpressionAttributeValues: { ":p": phone },
        Limit: 1,
      }),
    );
    const id = r.Items?.[0]?.psapId as string | undefined;
    if (!id) return null;
    return this.get(id);
  }

  async putNew(item: PsapProspect): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: item,
        ConditionExpression: "attribute_not_exists(psapId)",
      }),
    );
  }

  /** Paginate Query/Scan until exhausted (UNCONTACTED alone can exceed 1MB). */
  private async queryAll(
    input: Omit<
      ConstructorParameters<typeof QueryCommand>[0],
      "ExclusiveStartKey"
    >,
  ): Promise<PsapProspect[]> {
    const out: PsapProspect[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await ddb.send(
        new QueryCommand({
          ...input,
          ExclusiveStartKey,
        }),
      );
      out.push(...((r.Items as PsapProspect[]) ?? []));
      ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);
    return out;
  }

  /** Fetch all rows matching filters (one Dynamo read path), then sort. */
  private async fetchMatching(query: PsapProspectListQuery): Promise<PsapProspect[]> {
    let items: PsapProspect[] = [];

    if (query.state) {
      items = await this.queryAll({
        TableName: table(),
        IndexName: "StateUpdatedIndex",
        KeyConditionExpression: "#st = :st",
        ExpressionAttributeNames: { "#st": "state" },
        ExpressionAttributeValues: { ":st": query.state.toUpperCase() },
        ScanIndexForward: false,
      });
      if (query.outreachStatus) {
        items = items.filter((i) => i.outreachStatus === query.outreachStatus);
      }
    } else if (query.outreachStatus) {
      items = await this.queryAll({
        TableName: table(),
        IndexName: "StatusUpdatedIndex",
        KeyConditionExpression: "outreachStatus = :s",
        ExpressionAttributeValues: { ":s": query.outreachStatus },
        ScanIndexForward: false,
      });
    } else {
      items = await this.scanAll();
    }

    return sortProspects(
      items.filter((p) => matchesFilters(p, query)),
      query.sortBy,
      query.sortDir,
    );
  }

  async list(query: PsapProspectListQuery): Promise<PsapProspectListResponse> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const items = await this.fetchMatching(query);
    const total = items.length;
    const start = (page - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);
    return {
      items: pageItems,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  }

  async listAllMatching(query: PsapProspectListQuery): Promise<PsapProspect[]> {
    return this.fetchMatching(query);
  }

  async scanAll(): Promise<PsapProspect[]> {
    const out: PsapProspect[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await ddb.send(
        new ScanCommand({
          TableName: table(),
          ExclusiveStartKey,
        }),
      );
      out.push(...((r.Items as PsapProspect[]) ?? []));
      ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);
    return out;
  }

  async stats(): Promise<PsapProspectStats> {
    const items = await this.scanAll();
    const stats = emptyStats();
    stats.total = items.length;
    for (const p of items) {
      stats.byStatus[p.outreachStatus] = (stats.byStatus[p.outreachStatus] ?? 0) + 1;
      if (p.mailingAddress?.streetAddress?.trim()) stats.withAddress += 1;
      if (p.primaryContactName?.trim()) stats.withContact += 1;
      if (typeof p.estimatedValue === "number") stats.totalEstimatedValue += p.estimatedValue;
    }
    return stats;
  }

  async mapPins(): Promise<PsapMapPin[]> {
    const items = await this.scanAll();
    return items
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      .map((p) => ({
        psapId: p.psapId,
        lat: p.latitude,
        lon: p.longitude,
        status: p.outreachStatus,
        psapName: p.psapName,
        state: p.state,
      }));
  }

  async patch(
    psapId: string,
    body: PatchPsapProspectBody,
    actor: { userId: string; displayName: string },
  ): Promise<PsapProspect | null> {
    const current = await this.get(psapId);
    if (!current) return null;
    const now = new Date().toISOString();
    const next: PsapProspect = {
      ...current,
      ...body,
      mailingAddress: body.mailingAddress
        ? {
            city: body.mailingAddress.city ?? current.mailingAddress?.city ?? current.city,
            county: body.mailingAddress.county ?? current.mailingAddress?.county ?? current.county,
            state: body.mailingAddress.state ?? current.mailingAddress?.state ?? current.state,
            streetAddress:
              body.mailingAddress.streetAddress ?? current.mailingAddress?.streetAddress,
            zip: body.mailingAddress.zip ?? current.mailingAddress?.zip,
            verified: body.mailingAddress.verified ?? current.mailingAddress?.verified ?? false,
            enrichedAt: body.mailingAddress.enrichedAt ?? current.mailingAddress?.enrichedAt,
            source: body.mailingAddress.source ?? current.mailingAddress?.source,
          }
        : current.mailingAddress,
      primaryContactEmail:
        body.primaryContactEmail === ""
          ? undefined
          : (body.primaryContactEmail ?? current.primaryContactEmail),
      updatedAt: now,
      activities: [...(current.activities ?? [])],
    };

    if (body.outreachStatus && body.outreachStatus !== current.outreachStatus) {
      const activity: PsapActivity = {
        activityId: randomUUID(),
        type: "stage_change",
        description: `Status changed from ${current.outreachStatus} to ${body.outreachStatus}`,
        performedByUserId: actor.userId,
        performedByName: actor.displayName,
        performedAt: now,
        metadata: { from: current.outreachStatus, to: body.outreachStatus },
      };
      next.activities = [activity, ...next.activities];
    }

    await ddb.send(new PutCommand({ TableName: table(), Item: next }));
    return next;
  }

  async addActivity(
    psapId: string,
    body: AddPsapActivityRequest,
    actor: { userId: string; displayName: string },
  ): Promise<PsapProspect | null> {
    const current = await this.get(psapId);
    if (!current) return null;
    const now = new Date().toISOString();
    const activity: PsapActivity = {
      activityId: randomUUID(),
      type: body.type,
      description: body.description,
      performedByUserId: actor.userId,
      performedByName: actor.displayName,
      performedAt: now,
      metadata: body.metadata,
    };
    const contactTypes = new Set(["call", "email", "mail"]);
    const next: PsapProspect = {
      ...current,
      activities: [activity, ...(current.activities ?? [])],
      updatedAt: now,
      ...(contactTypes.has(body.type)
        ? { lastContactedAt: now, lastContactedBy: actor.displayName }
        : {}),
    };
    await ddb.send(new PutCommand({ TableName: table(), Item: next }));
    return next;
  }
}
