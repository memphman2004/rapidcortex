import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import type {
  PatchSupportTicketBody,
  SupportTicketRecord,
  TicketActivity,
  TicketBoardData,
  TicketBoardMetrics,
  TicketNote,
  TicketStatus,
} from "rapid-cortex-shared";
import {
  ACTIVE_TICKET_STATUSES,
  TICKET_STATUSES,
  TICKET_STATUS_TRANSITIONS,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

const STATUS_GSI = "status-createdAt-index";
const SEVEN_YEARS_SECONDS = 7 * 365 * 86400;
/** Sentinel PK for the atomic sequence; not a ticket and not on the status GSI. */
const TICKET_COUNTER_ID = "COUNTER";
/** First issued id is SUP-1001 so operators get a short, speakable number. */
const TICKET_SEQ_OFFSET = 1000;

export function formatTicketId(sequence: number): string {
  return `SUP-${String(sequence).padStart(4, "0")}`;
}

function table(): string {
  const t = env.ticketsTable?.trim();
  if (!t) throw new Error("TICKETS_TABLE_NOT_CONFIGURED");
  return t;
}

export function emptyColumns(): Record<TicketStatus, SupportTicketRecord[]> {
  return Object.fromEntries(TICKET_STATUSES.map((s) => [s, [] as SupportTicketRecord[]])) as Record<
    TicketStatus,
    SupportTicketRecord[]
  >;
}

export function computeTicketBoardMetrics(tickets: SupportTicketRecord[]): TicketBoardMetrics {
  const openTickets = tickets.filter((t) => ACTIVE_TICKET_STATUSES.includes(t.status));
  const thisMonth = new Date().toISOString().slice(0, 7);
  const resolvedThisMonth = tickets.filter(
    (t) =>
      (t.status === "RESOLVED" || t.status === "CLOSED") && (t.resolvedAt ?? "").startsWith(thisMonth),
  ).length;
  const resolutionTimes = tickets
    .filter((t) => t.resolvedAt && t.createdAt)
    .map((t) => (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / 3_600_000);
  const avgResolutionHours =
    resolutionTimes.length > 0
      ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
      : null;
  const nowMs = Date.now();
  const oldestOpenMs =
    openTickets.length > 0
      ? nowMs - Math.min(...openTickets.map((t) => new Date(t.createdAt).getTime()))
      : null;
  return {
    totalOpen: openTickets.length,
    sev1Active: openTickets.filter((t) => t.severity === "SEV1").length,
    sev2Active: openTickets.filter((t) => t.severity === "SEV2").length,
    resolvedThisMonth,
    avgResolutionHours,
    oldestOpenHours: oldestOpenMs !== null ? Math.round(oldestOpenMs / 3_600_000) : null,
  };
}

export class SupportTicketRepository {
  async nextTicketId(): Promise<string> {
    const out = await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { ticketId: TICKET_COUNTER_ID },
        UpdateExpression: "ADD nextNumber :one",
        ExpressionAttributeValues: { ":one": 1 },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    const sequence = Number(out.Attributes?.nextNumber ?? 0);
    return formatTicketId(TICKET_SEQ_OFFSET + sequence);
  }

  async put(ticket: SupportTicketRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: ticket,
        ConditionExpression: "attribute_not_exists(ticketId)",
      }),
    );
  }

  async save(ticket: SupportTicketRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: ticket,
        ConditionExpression: "attribute_exists(ticketId) AND agencyId = :a",
        ExpressionAttributeValues: { ":a": ticket.agencyId },
      }),
    );
  }

  async get(ticketId: string): Promise<SupportTicketRecord | null> {
    const out = await ddb.send(new GetCommand({ TableName: table(), Key: { ticketId } }));
    return (out.Item as SupportTicketRecord | undefined) ?? null;
  }

  async listBoard(filters?: {
    channel?: string;
    severity?: string;
    agencyId?: string;
  }): Promise<TicketBoardData> {
    const columns = emptyColumns();
    const all: SupportTicketRecord[] = [];
    for (const status of TICKET_STATUSES) {
      let exclusiveStartKey: Record<string, unknown> | undefined;
      do {
        const out = await ddb.send(
          new QueryCommand({
            TableName: table(),
            IndexName: STATUS_GSI,
            KeyConditionExpression: "#st = :st",
            ExpressionAttributeNames: { "#st": "status" },
            ExpressionAttributeValues: { ":st": status },
            ScanIndexForward: false,
            ExclusiveStartKey: exclusiveStartKey,
          }),
        );
        for (const item of out.Items ?? []) {
          const ticket = item as SupportTicketRecord;
          if (!ticket.agencyId || ticket.ticketId === TICKET_COUNTER_ID) continue;
          if (filters?.channel && ticket.channel !== filters.channel) continue;
          if (filters?.severity && ticket.severity !== filters.severity) continue;
          if (filters?.agencyId && ticket.agencyId !== filters.agencyId) continue;
          columns[status].push(ticket);
          all.push(ticket);
        }
        exclusiveStartKey = out.LastEvaluatedKey as Record<string, unknown> | undefined;
      } while (exclusiveStartKey);
    }
    return { columns, metrics: computeTicketBoardMetrics(all) };
  }

  async update(ticketId: string, patch: PatchSupportTicketBody, actor: { userId: string; name: string }): Promise<SupportTicketRecord | null> {
    const current = await this.get(ticketId);
    if (!current) return null;
    if (current.agencyId == null || current.agencyId === "") return null;

    const now = new Date().toISOString();
    const activities = [...(current.activities ?? [])];
    const notes = [...(current.notes ?? [])];
    const next: SupportTicketRecord = { ...current, updatedAt: now };

    if (patch.status && patch.status !== current.status) {
      const allowed = TICKET_STATUS_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(patch.status)) {
        throw new Error(`Invalid status transition from ${current.status} to ${patch.status}`);
      }
      if ((patch.status === "RESOLVED" || patch.status === "CLOSED") && !patch.resolutionNotes?.trim() && !patch.note?.trim()) {
        throw new Error("resolutionNotes is required when moving to RESOLVED or CLOSED");
      }
      if ((current.status === "RESOLVED" || current.status === "CLOSED") && patch.status === "OPEN" && !patch.reopenReason?.trim()) {
        throw new Error("reopenReason is required when reopening a ticket");
      }
      next.status = patch.status;
      if (patch.status === "RESOLVED" && !next.resolvedAt) next.resolvedAt = now;
      if (patch.status === "CLOSED") {
        next.closedAt = now;
        if (!next.resolvedAt) next.resolvedAt = now;
      }
      activities.push({
        activityId: randomUUID(),
        type: patch.status === "ESCALATED" ? "escalated" : "status_changed",
        label: `Status changed from ${current.status} to ${patch.status}`,
        authorId: actor.userId,
        authorName: actor.name,
        createdAt: now,
      });
    }

    if (patch.severity && patch.severity !== current.severity) {
      next.severity = patch.severity;
      activities.push({
        activityId: randomUUID(),
        type: "severity_changed",
        label: `Severity changed from ${current.severity} to ${patch.severity}`,
        authorId: actor.userId,
        authorName: actor.name,
        createdAt: now,
      });
    }

    if (patch.category) next.category = patch.category;
    if (patch.subject) next.subject = patch.subject;
    if (patch.assignedToUserId !== undefined) {
      next.assignedToUserId = patch.assignedToUserId;
      next.assignedToName = patch.assignedToName ?? next.assignedToName;
      activities.push({
        activityId: randomUUID(),
        type: "assigned",
        label: `Assigned to ${next.assignedToName || next.assignedToUserId || "unassigned"}`,
        authorId: actor.userId,
        authorName: actor.name,
        createdAt: now,
      });
    }

    const extraNote = patch.note?.trim() || patch.resolutionNotes?.trim() || patch.reopenReason?.trim();
    if (extraNote) {
      const note: TicketNote = {
        noteId: randomUUID(),
        text: extraNote,
        authorId: actor.userId,
        authorName: actor.name,
        createdAt: now,
      };
      notes.push(note);
      activities.push({
        activityId: randomUUID(),
        type: "note_added",
        label: extraNote.slice(0, 120),
        authorId: actor.userId,
        authorName: actor.name,
        createdAt: now,
      });
    }

    next.notes = notes;
    next.activities = activities;

    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: next,
        ConditionExpression: "attribute_exists(ticketId) AND agencyId = :a",
        ExpressionAttributeValues: { ":a": current.agencyId },
      }),
    );
    return next;
  }

  async addNote(
    ticketId: string,
    text: string,
    actor: { userId: string; name: string },
  ): Promise<SupportTicketRecord | null> {
    const current = await this.get(ticketId);
    if (!current?.agencyId) return null;
    const now = new Date().toISOString();
    const note: TicketNote = {
      noteId: randomUUID(),
      text,
      authorId: actor.userId,
      authorName: actor.name,
      createdAt: now,
    };
    const activity: TicketActivity = {
      activityId: randomUUID(),
      type: "note_added",
      label: text.slice(0, 120),
      authorId: actor.userId,
      authorName: actor.name,
      createdAt: now,
    };
    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { ticketId },
        ConditionExpression: "attribute_exists(ticketId) AND agencyId = :a",
        UpdateExpression:
          "SET notes = list_append(if_not_exists(notes, :empty), :n), activities = list_append(if_not_exists(activities, :empty), :act), updatedAt = :u",
        ExpressionAttributeValues: {
          ":a": current.agencyId,
          ":n": [note],
          ":act": [activity],
          ":empty": [],
          ":u": now,
        },
      }),
    );
    return {
      ...current,
      notes: [...(current.notes ?? []), note],
      activities: [...(current.activities ?? []), activity],
      updatedAt: now,
    };
  }

  ttlFromNow(): number {
    return Math.floor(Date.now() / 1000) + SEVEN_YEARS_SECONDS;
  }
}
