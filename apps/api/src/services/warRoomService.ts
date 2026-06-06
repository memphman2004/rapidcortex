import {
  AUDIT_EVENT_TYPES,
  isAdminRole,
  isSupervisorOrAdmin,
} from "rapid-cortex-security";
import type {
  CreateWarRoomBody,
  PostWarRoomMessageBody,
  UserContext,
  WarRoom,
  WarRoomMessage,
  WarRoomParticipant,
} from "rapid-cortex-shared";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { resolveIncidentRead } from "../lib/incidentReadAccess.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { WarRoomMessageRepository } from "../repositories/warRoomMessageRepository.js";
import { WarRoomRepository } from "../repositories/warRoomRepository.js";

const rooms = new WarRoomRepository();
const messages = new WarRoomMessageRepository();
const auditRepo = new AuditRepository();

function nowIso(): string {
  return new Date().toISOString();
}

function assertInfra(): void {
  if (!env.warRoomsTable || !env.warRoomMessagesTable) {
    const err = new Error("WAR_ROOMS_DISABLED");
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
}

function assertSupervisor(user: UserContext): void {
  if (!isSupervisorOrAdmin(user.role)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function assertAgency(user: UserContext, agencyId: string): void {
  if (isRcsuperadmin(user)) return;
  if (user.agencyId !== agencyId) {
    const err = new Error("TENANT_MISMATCH");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

async function assertIncidentInAgency(user: UserContext, incidentId: string): Promise<string> {
  const resolved = await resolveIncidentRead(incidentId, user);
  if (!resolved) {
    const err = new Error("NOT_FOUND");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const agencyId = resolved.incident.agencyId;
  assertAgency(user, agencyId);
  return agencyId;
}

function activeParticipantCount(room: WarRoom): number {
  return room.participants.filter((p) => p.active).length;
}

export class WarRoomService {
  async create(user: UserContext, body: CreateWarRoomBody): Promise<WarRoom> {
    assertInfra();
    assertSupervisor(user);
    const agencyId = await assertIncidentInAgency(user, body.incidentId);
    const ts = nowIso();
    const roomId = makeId("wr");
    const participant: WarRoomParticipant = {
      userId: user.userId,
      role: user.role,
      joinedAt: ts,
      active: true,
    };
    const room: WarRoom = {
      roomId,
      agencyId,
      incidentId: body.incidentId,
      name: body.name,
      status: "active",
      createdBy: user.userId,
      participants: [participant],
      pinnedNotes: [],
      createdAt: ts,
      updatedAt: ts,
    };
    await rooms.put(room);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      incidentId: body.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.WAR_ROOM_CREATED,
      details: { roomId, name: body.name },
      createdAt: ts,
      resourceType: "incident",
      resourceId: roomId,
    });
    return room;
  }

  async list(user: UserContext, incidentId?: string): Promise<{ items: WarRoom[] }> {
    assertInfra();
    assertSupervisor(user);
    if (!user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const items = incidentId
      ? await rooms.listByIncident(user.agencyId, incidentId)
      : await rooms.listForAgency(user.agencyId);
    return { items };
  }

  async get(user: UserContext, roomId: string): Promise<WarRoom> {
    assertInfra();
    assertSupervisor(user);
    if (!user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const room = await rooms.get(user.agencyId, roomId);
    if (!room) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    assertAgency(user, room.agencyId);
    return room;
  }

  async join(user: UserContext, roomId: string): Promise<WarRoom> {
    assertInfra();
    assertSupervisor(user);
    const room = await this.get(user, roomId);
    if (room.status === "closed") {
      const err = new Error("ROOM_CLOSED");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    const ts = nowIso();
    const existing = room.participants.find((p) => p.userId === user.userId);
    let participants: WarRoomParticipant[];
    if (existing) {
      participants = room.participants.map((p) =>
        p.userId === user.userId ? { ...p, active: true, leftAt: undefined, joinedAt: ts } : p,
      );
    } else {
      participants = [
        ...room.participants,
        { userId: user.userId, role: user.role, joinedAt: ts, active: true },
      ];
    }
    const updated = await rooms.update(room.agencyId, roomId, {
      participants,
      status: room.status === "standby" ? "active" : room.status,
      updatedAt: ts,
    });
    if (!updated) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: room.agencyId,
      incidentId: room.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.WAR_ROOM_JOINED,
      details: { roomId, activeCount: activeParticipantCount(updated) },
      createdAt: ts,
      resourceType: "incident",
      resourceId: roomId,
    });
    return updated;
  }

  async leave(user: UserContext, roomId: string): Promise<WarRoom> {
    assertInfra();
    assertSupervisor(user);
    const room = await this.get(user, roomId);
    const ts = nowIso();
    const participants = room.participants.map((p) =>
      p.userId === user.userId ? { ...p, active: false, leftAt: ts } : p,
    );
    const updated = await rooms.update(room.agencyId, roomId, { participants, updatedAt: ts });
    if (!updated) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: room.agencyId,
      incidentId: room.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.WAR_ROOM_LEFT,
      details: { roomId, activeCount: activeParticipantCount(updated) },
      createdAt: ts,
      resourceType: "incident",
      resourceId: roomId,
    });
    return updated;
  }

  async postMessage(user: UserContext, roomId: string, body: PostWarRoomMessageBody): Promise<WarRoomMessage> {
    assertInfra();
    assertSupervisor(user);
    const room = await this.get(user, roomId);
    if (room.status === "closed") {
      const err = new Error("ROOM_CLOSED");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    const ts = nowIso();
    const msg: WarRoomMessage = {
      messageId: makeId("wrm"),
      roomId,
      agencyId: room.agencyId,
      userId: user.userId,
      userRole: user.role,
      content: body.content.trim(),
      pinned: false,
      createdAt: ts,
    };
    await messages.put(msg);
    await rooms.update(room.agencyId, roomId, { updatedAt: ts });
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: room.agencyId,
      incidentId: room.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.WAR_ROOM_MESSAGE_POSTED,
      details: { roomId, messageId: msg.messageId, contentLength: msg.content.length },
      createdAt: ts,
      resourceType: "incident",
      resourceId: roomId,
    });
    return msg;
  }

  async listMessages(user: UserContext, roomId: string): Promise<{ items: WarRoomMessage[] }> {
    assertInfra();
    assertSupervisor(user);
    await this.get(user, roomId);
    const items = await messages.listByRoom(roomId);
    return { items };
  }

  async pinMessage(user: UserContext, roomId: string, messageId: string): Promise<WarRoomMessage> {
    assertInfra();
    assertSupervisor(user);
    const room = await this.get(user, roomId);
    const all = await messages.listByRoom(roomId);
    const target = all.find((m) => m.messageId === messageId);
    if (!target) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const updated = await messages.setPinned(roomId, target.createdAt, messageId, true);
    if (!updated) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const ts = nowIso();
    const pinnedNotes = [...new Set([...room.pinnedNotes, target.content])];
    await rooms.update(room.agencyId, roomId, { pinnedNotes, updatedAt: ts });
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: room.agencyId,
      incidentId: room.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.WAR_ROOM_MESSAGE_PINNED,
      details: { roomId, messageId, pinnedByUserId: user.userId },
      createdAt: ts,
      resourceType: "incident",
      resourceId: roomId,
    });
    return updated;
  }

  async close(user: UserContext, roomId: string): Promise<WarRoom> {
    assertInfra();
    if (!isAdminRole(user.role) && user.role !== "rcsuperadmin") {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const room = await this.get(user, roomId);
    const ts = nowIso();
    const participants = room.participants.map((p) =>
      p.active ? { ...p, active: false, leftAt: ts } : p,
    );
    const updated = await rooms.update(room.agencyId, roomId, {
      status: "closed",
      participants,
      closedAt: ts,
      updatedAt: ts,
    });
    if (!updated) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: room.agencyId,
      incidentId: room.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.WAR_ROOM_CLOSED,
      details: { roomId },
      createdAt: ts,
      resourceType: "incident",
      resourceId: roomId,
    });
    return updated;
  }
}
