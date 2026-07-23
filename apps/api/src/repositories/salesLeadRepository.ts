import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import type {
  ContactSalesLeadBody,
  LeadActivity,
  LeadAttribution,
  LeadNote,
  PatchSalesLeadBody,
  PipelineStage,
  SalesLeadCrmRecord,
  SalesLeadPackageSold,
  SalesLeadStatus,
  StageEvent,
} from "rapid-cortex-shared";
import {
  CHANNEL_CONFIG,
  PIPELINE_STAGES,
  stageToPipelineStageAndStatus,
  type LeadChannel,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";
import { normalizeLead } from "../features/leads/leads-normalize.js";

export type SalesLeadRecord = ContactSalesLeadBody & {
  leadId: string;
  createdAt: string;
  source?: string;
  status?: SalesLeadStatus;
  packageSold?: SalesLeadPackageSold;
  notes?: string | LeadNote[];
  assignee?: string;
  updatedAt?: string;
  updatedBy?: string;
  pipelineStage?: PipelineStage;
  attribution?: LeadAttribution;
  activities?: LeadActivity[];
};

export type RingWaitlistLeadRecord = {
  leadId: string;
  email: string;
  source: string;
  requestedState?: string | null;
  requestedCity?: string | null;
  createdAt: string;
  status?: SalesLeadStatus;
  packageSold?: SalesLeadPackageSold;
  notes?: string | LeadNote[];
  assignee?: string;
  updatedAt?: string;
  updatedBy?: string;
  pipelineStage?: PipelineStage;
  attribution?: LeadAttribution;
  activities?: LeadActivity[];
};

export type AnySalesLeadRecord = SalesLeadRecord | RingWaitlistLeadRecord;

function table(): string {
  const t = env.salesLeadsTable?.trim();
  if (!t) throw new Error("SALES_LEADS_TABLE_NOT_CONFIGURED");
  return t;
}

function sortByCreatedDesc(items: AnySalesLeadRecord[]): AnySalesLeadRecord[] {
  return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function displayName(userId: string, name?: string): string {
  return name?.trim() || userId;
}

export class SalesLeadRepository {
  async putLead(lead: SalesLeadRecord): Promise<void> {
    const now = lead.createdAt || new Date().toISOString();
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...lead,
          source: lead.source ?? "contact-sales",
          status: lead.status ?? "new",
          pipelineStage: lead.pipelineStage ?? "NEW",
          notes: Array.isArray(lead.notes) ? lead.notes : [],
          activities: lead.activities ?? [
            {
              activityId: randomUUID(),
              type: "created",
              description: `Lead created · Source: ${lead.source ?? "contact-sales"}`,
              createdAt: now,
            },
          ],
        },
      }),
    );
  }

  async putRingWaitlistLead(lead: RingWaitlistLeadRecord): Promise<void> {
    const now = lead.createdAt || new Date().toISOString();
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...lead,
          status: lead.status ?? "new",
          pipelineStage: lead.pipelineStage ?? "NEW",
          notes: Array.isArray(lead.notes) ? lead.notes : [],
          activities: lead.activities ?? [
            {
              activityId: randomUUID(),
              type: "created",
              description: "Lead created · Source: Ring Waitlist",
              createdAt: now,
            },
          ],
        },
      }),
    );
  }

  /** Deterministic Cortex dual-write — fails quietly if leadId already exists [CR-5]. */
  async putCortexLeadIfAbsent(item: Record<string, unknown>): Promise<"created" | "exists" | "error"> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: table(),
          Item: item,
          ConditionExpression: "attribute_not_exists(leadId)",
        }),
      );
      return "created";
    } catch (err) {
      if ((err as { name?: string }).name === "ConditionalCheckFailedException") return "exists";
      throw err;
    }
  }

  async getById(leadId: string): Promise<AnySalesLeadRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { leadId },
      }),
    );
    return (out.Item as AnySalesLeadRecord | undefined) ?? null;
  }

  async getNormalized(leadId: string): Promise<SalesLeadCrmRecord | null> {
    const raw = await this.getById(leadId);
    if (!raw) return null;
    return normalizeLead(raw as unknown as Record<string, unknown>);
  }

  async listRecent(limit = 200): Promise<AnySalesLeadRecord[]> {
    const max = Math.min(Math.max(limit, 1), 500);
    const items: AnySalesLeadRecord[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const out = await ddb.send(
        new ScanCommand({
          TableName: table(),
          ExclusiveStartKey: exclusiveStartKey,
          Limit: Math.min(100, max - items.length),
        }),
      );
      for (const item of out.Items ?? []) {
        items.push(item as AnySalesLeadRecord);
      }
      exclusiveStartKey = out.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey && items.length < max);

    return sortByCreatedDesc(items).slice(0, max);
  }

  async listNormalized(limit = 500): Promise<SalesLeadCrmRecord[]> {
    const items = await this.listRecent(limit);
    return items.map((item) => normalizeLead(item as unknown as Record<string, unknown>));
  }

  async updateCrmFields(
    leadId: string,
    patch: PatchSalesLeadBody & { updatedBy: string; updatedByName?: string },
  ): Promise<SalesLeadCrmRecord | null> {
    const existing = await this.getById(leadId);
    if (!existing) return null;
    const normalized = normalizeLead(existing as unknown as Record<string, unknown>);

    const now = new Date().toISOString();
    const sets: string[] = ["updatedAt = :updatedAt", "updatedBy = :updatedBy"];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {
      ":updatedAt": now,
      ":updatedBy": patch.updatedBy,
    };

    const changed: string[] = [];

    const assign = (attr: string, value: unknown, label: string) => {
      if (value === undefined) return;
      const nk = `#${attr}`;
      const vk = `:${attr}`;
      names[nk] = attr;
      values[vk] = value;
      sets.push(`${nk} = ${vk}`);
      changed.push(label);
    };

    if (patch.status !== undefined) {
      const fromLegacy = stageToPipelineStageAndStatus(
        normalizeLead({ status: patch.status }).pipelineStage,
      );
      assign("status", fromLegacy.status, "status");
      assign("pipelineStage", fromLegacy.pipelineStage, "pipelineStage");
    }

    assign("packageSold", patch.packageSold, "packageSold");
    assign("firstName", patch.firstName, "firstName");
    assign("lastName", patch.lastName, "lastName");
    assign("phone", patch.phone, "phone");
    assign("title", patch.title, "title");
    assign("agencyName", patch.agencyName, "agencyName");
    assign("agencyType", patch.agencyType, "agencyType");
    assign("vertical", patch.vertical, "vertical");
    assign("estimatedValue", patch.estimatedValue, "estimatedValue");
    assign("probability", patch.probability, "probability");
    assign("assignedToName", patch.assignedToName, "assignedToName");
    assign("nextAction", patch.nextAction, "nextAction");
    assign("nextActionDate", patch.nextActionDate, "nextActionDate");
    assign("lostReason", patch.lostReason, "lostReason");

    const assignee = patch.assignedTo ?? patch.assignee;
    if (assignee !== undefined) {
      assign("assignedTo", assignee, "assignedTo");
      assign("assignee", assignee, "assignee");
    }

    // Legacy string notes only if caller still sends notes string
    if (typeof patch.notes === "string") {
      assign("notes", patch.notes, "notes");
    }

    if (changed.length > 0 && typeof patch.notes !== "string") {
      const activity: LeadActivity = {
        activityId: randomUUID(),
        type: "field_updated",
        description: `Updated ${changed.join(", ")}`,
        authorId: patch.updatedBy,
        authorName: displayName(patch.updatedBy, patch.updatedByName),
        createdAt: now,
        metadata: { fields: changed.join(",") },
      };
      const activities = [...(normalized.activities ?? []), activity];
      names["#activities"] = "activities";
      values[":activities"] = activities;
      sets.push("#activities = :activities");
    }

    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { leadId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(leadId)",
      }),
    );

    return this.getNormalized(leadId);
  }

  async updateStage(
    leadId: string,
    opts: {
      stage: PipelineStage;
      note?: string;
      lostReason?: string;
      pilotStartDate?: string;
      changedBy: string;
      changedByName?: string;
    },
  ): Promise<SalesLeadCrmRecord | null> {
    const existing = await this.getById(leadId);
    if (!existing) return null;
    const normalized = normalizeLead(existing as unknown as Record<string, unknown>);
    const from = normalized.pipelineStage;
    const to = opts.stage;
    if (from === to) return normalized;

    const now = new Date().toISOString();
    const { pipelineStage, status } = stageToPipelineStageAndStatus(to);
    const historyEntry: StageEvent = {
      from,
      to,
      changedAt: now,
      changedBy: opts.changedBy,
      changedByName: displayName(opts.changedBy, opts.changedByName),
      note: opts.note,
    };
    const activity: LeadActivity = {
      activityId: randomUUID(),
      type: "stage_change",
      description: `Moved from ${from} to ${to}`,
      authorId: opts.changedBy,
      authorName: displayName(opts.changedBy, opts.changedByName),
      createdAt: now,
      metadata: { fromStage: from, toStage: to, ...(opts.note ? { note: opts.note } : {}) },
    };

    const stageHistory = [...(normalized.stageHistory ?? []), historyEntry];
    const activities = [...(normalized.activities ?? []), activity];

    const sets = [
      "#status = :status",
      "pipelineStage = :pipelineStage",
      "stageUpdatedAt = :stageUpdatedAt",
      "stageHistory = :stageHistory",
      "activities = :activities",
      "updatedAt = :updatedAt",
      "updatedBy = :updatedBy",
    ];
    const values: Record<string, unknown> = {
      ":status": status,
      ":pipelineStage": pipelineStage,
      ":stageUpdatedAt": now,
      ":stageHistory": stageHistory,
      ":activities": activities,
      ":updatedAt": now,
      ":updatedBy": opts.changedBy,
    };
    const names: Record<string, string> = { "#status": "status" };

    if (to === "PILOT") {
      sets.push("pilotStartDate = :pilotStartDate");
      values[":pilotStartDate"] = opts.pilotStartDate ?? now.slice(0, 10);
    }
    if (to === "WON") {
      sets.push("wonDate = :wonDate");
      values[":wonDate"] = now;
    }
    if (to === "LOST" && opts.lostReason) {
      sets.push("lostReason = :lostReason");
      values[":lostReason"] = opts.lostReason;
    }

    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { leadId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(leadId)",
      }),
    );

    return this.getNormalized(leadId);
  }

  async addNote(
    leadId: string,
    opts: {
      text: string;
      pinned?: boolean;
      authorId: string;
      authorName?: string;
    },
  ): Promise<SalesLeadCrmRecord | null> {
    const existing = await this.getById(leadId);
    if (!existing) return null;
    const normalized = normalizeLead(existing as unknown as Record<string, unknown>);
    const now = new Date().toISOString();
    const note: LeadNote = {
      noteId: randomUUID(),
      text: opts.text,
      authorId: opts.authorId,
      authorName: displayName(opts.authorId, opts.authorName),
      createdAt: now,
      pinned: opts.pinned ?? false,
    };
    const activity: LeadActivity = {
      activityId: randomUUID(),
      type: "note_added",
      description: "Note added",
      authorId: opts.authorId,
      authorName: note.authorName,
      createdAt: now,
    };
    const notes = [...(normalized.notes ?? []), note];
    const activities = [...(normalized.activities ?? []), activity];

    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { leadId },
        UpdateExpression:
          "SET notes = :notes, activities = :activities, lastContactedAt = :lastContactedAt, updatedAt = :updatedAt, updatedBy = :updatedBy",
        ExpressionAttributeValues: {
          ":notes": notes,
          ":activities": activities,
          ":lastContactedAt": now,
          ":updatedAt": now,
          ":updatedBy": opts.authorId,
        },
        ConditionExpression: "attribute_exists(leadId)",
      }),
    );

    return this.getNormalized(leadId);
  }

  async addActivity(
    leadId: string,
    activity: Omit<LeadActivity, "activityId" | "createdAt"> & {
      activityId?: string;
      createdAt?: string;
    },
  ): Promise<SalesLeadCrmRecord | null> {
    const existing = await this.getById(leadId);
    if (!existing) return null;
    const normalized = normalizeLead(existing as unknown as Record<string, unknown>);
    const now = new Date().toISOString();
    const entry: LeadActivity = {
      activityId: activity.activityId ?? randomUUID(),
      type: activity.type,
      description: activity.description,
      authorId: activity.authorId,
      authorName: activity.authorName,
      createdAt: activity.createdAt ?? now,
      metadata: activity.metadata,
    };
    const activities = [...(normalized.activities ?? []), entry];
    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { leadId },
        UpdateExpression:
          "SET activities = :activities, lastContactedAt = :lastContactedAt, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":activities": activities,
          ":lastContactedAt": now,
          ":updatedAt": now,
        },
        ConditionExpression: "attribute_exists(leadId)",
      }),
    );
    return this.getNormalized(leadId);
  }

  async deleteNote(leadId: string, noteId: string): Promise<SalesLeadCrmRecord | null> {
    const existing = await this.getById(leadId);
    if (!existing) return null;
    const normalized = normalizeLead(existing as unknown as Record<string, unknown>);
    const notes = (normalized.notes ?? []).filter((n) => n.noteId !== noteId);
    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { leadId },
        UpdateExpression: "SET notes = :notes, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":notes": notes,
          ":updatedAt": new Date().toISOString(),
        },
        ConditionExpression: "attribute_exists(leadId)",
      }),
    );
    return this.getNormalized(leadId);
  }

  buildPipelinePayload(leads: SalesLeadCrmRecord[]) {
    const stages: Record<PipelineStage, SalesLeadCrmRecord[]> = {
      NEW: [],
      CONTACTED: [],
      QUALIFIED: [],
      DISCOVERY: [],
      PROPOSAL: [],
      NEGOTIATION: [],
      PILOT: [],
      WON: [],
      LOST: [],
    };
    for (const lead of leads) {
      const s = lead.pipelineStage;
      if (stages[s]) stages[s].push(lead);
      else stages.NEW.push(lead);
    }
    const active = leads.filter((l) => l.pipelineStage !== "WON" && l.pipelineStage !== "LOST");
    const won = stages.WON;
    const lost = stages.LOST;
    const totalPipelineValue = active.reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0);
    const winRate =
      won.length + lost.length > 0
        ? Math.round((won.length / (won.length + lost.length)) * 100)
        : 0;

    let avgDaysToClose: number | null = null;
    const closed = [...won, ...lost].filter((l) => l.wonDate || l.stageUpdatedAt || l.updatedAt);
    if (closed.length > 0) {
      const days = closed.map((l) => {
        const end = Date.parse(l.wonDate ?? l.stageUpdatedAt ?? l.updatedAt ?? l.createdAt);
        const start = Date.parse(l.createdAt);
        return Math.max(0, (end - start) / 86_400_000);
      });
      avgDaysToClose = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
    }

    return {
      stages,
      metrics: {
        total: leads.length,
        totalPipelineValue,
        activeDeals: active.length,
        winRate,
        avgDaysToClose,
        byStage: Object.fromEntries(
          PIPELINE_STAGES.map((s) => [s, stages[s].length]),
        ) as Record<PipelineStage, number>,
      },
    };
  }

  buildAttributionSummary(leads: SalesLeadCrmRecord[]) {
    const byChannel: Record<string, { count: number; label: string; icon: string }> = {};
    const referrerCounts = new Map<string, number>();
    const byDevice = { mobile: 0, desktop: 0, tablet: 0 };
    const byState: Record<string, number> = {};

    for (const lead of leads) {
      const attr = lead.attribution;
      const channel = (attr?.channel ?? "other") as LeadChannel;
      const cfg = CHANNEL_CONFIG[channel] ?? CHANNEL_CONFIG.other;
      if (!byChannel[channel]) {
        byChannel[channel] = { count: 0, label: cfg.label, icon: cfg.icon };
      }
      byChannel[channel]!.count += 1;

      const domain = attr?.referrerDomain;
      if (domain) referrerCounts.set(domain, (referrerCounts.get(domain) ?? 0) + 1);

      const device = attr?.deviceType;
      if (device === "mobile" || device === "desktop" || device === "tablet") {
        byDevice[device] += 1;
      }

      const state =
        attr?.ipRegion ?? (typeof lead.requestedState === "string" ? lead.requestedState : null);
      if (state) byState[state] = (byState[state] ?? 0) + 1;
    }

    const topReferrers = [...referrerCounts.entries()]
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { byChannel, topReferrers, byDevice, byState };
  }
}