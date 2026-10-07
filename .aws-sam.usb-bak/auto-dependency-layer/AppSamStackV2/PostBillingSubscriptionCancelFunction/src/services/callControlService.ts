import { AUDIT_EVENT_TYPES, AuthorizationService } from "rapid-cortex-security";
import type {
  ActiveCallRecord,
  TakeoverCallBody,
  TransferCallBody,
  TransferCallResponse,
  UserContext,
} from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { ActiveCallRepository } from "../repositories/activeCallRepository.js";
import { CallTransferRepository } from "../repositories/callTransferRepository.js";
import { WebSocketNotificationService } from "./websocketNotificationService.js";

const authz = new AuthorizationService();
const activeCalls = new ActiveCallRepository();
const transfers = new CallTransferRepository();
const auditRepo = new AuditRepository();
const wsNotify = new WebSocketNotificationService();

const NOTIFICATION_METHOD = "notification" as const;

function displayName(userId: string, username?: string): string {
  return username?.trim() || userId;
}

function assertSupervisor(user: UserContext): void {
  if (!authz.canAccessSupervisorRoutes(user)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function assertDispatcher(user: UserContext): void {
  if (!authz.canDispatch(user)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

export class CallControlService {
  async listAgencyActiveCalls(user: UserContext): Promise<ActiveCallRecord[]> {
    assertSupervisor(user);
    const rows = await activeCalls.listByAgency(user.agencyId);
    return rows.filter((r) => r.status !== "ended");
  }

  async listDispatcherActiveCalls(user: UserContext): Promise<ActiveCallRecord[]> {
    assertDispatcher(user);
    return activeCalls.listForHandler(user.agencyId, user.userId);
  }

  async transferCall(user: UserContext, body: TransferCallBody): Promise<TransferCallResponse> {
    assertSupervisor(user);
    const now = new Date().toISOString();
    const transferId = makeId("xfr");
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

    let call = await activeCalls.get(user.agencyId, body.callId);
    if (!call) {
      const fromUserId = body.fromUserId ?? user.userId;
      const fromUsername = displayName(fromUserId, body.fromUsername);
      if (!body.callerPhone) {
        const err = new Error("CALL_NOT_FOUND");
        (err as Error & { statusCode?: number }).statusCode = 404;
        throw err;
      }
      call = {
        callId: body.callId,
        agencyId: user.agencyId,
        incidentId: body.incidentId,
        callerPhone: body.callerPhone,
        status: "connected",
        currentHandlerUserId: fromUserId,
        currentHandlerUsername: fromUsername,
        startTime: now,
        updatedAt: now,
      };
      await activeCalls.put(call);
    }

    if (call.pendingTransfer?.status === "pending") {
      const err = new Error("TRANSFER_ALREADY_PENDING");
      (err as Error & { statusCode?: number }).statusCode = 409;
      throw err;
    }

    const targetUsername = displayName(body.targetUserId, body.targetUsername);
    const pendingTransfer = {
      transferId,
      targetUserId: body.targetUserId,
      targetUsername,
      fromUserId: call.currentHandlerUserId,
      fromUsername: call.currentHandlerUsername,
      initiatedBy: user.userId,
      initiatedAt: now,
      method: NOTIFICATION_METHOD,
      status: "pending" as const,
      reason: body.reason,
      expiresAt,
    };

    await activeCalls.updatePendingTransfer(user.agencyId, body.callId, pendingTransfer, {
      status: "transferring",
    });

    await transfers.create({
      transferId,
      agencyId: user.agencyId,
      callId: body.callId,
      method: NOTIFICATION_METHOD,
      action: "transfer",
      status: "pending",
      initiatedBy: user.userId,
      fromUserId: call.currentHandlerUserId,
      fromUsername: call.currentHandlerUsername,
      toUserId: body.targetUserId,
      toUsername: targetUsername,
      reason: body.reason,
      initiatedAt: now,
    });

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId: call.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.CALL_TRANSFER_INITIATED,
      details: {
        callId: body.callId,
        transferId,
        targetUserId: body.targetUserId,
        method: NOTIFICATION_METHOD,
      },
      createdAt: now,
      resourceType: "call",
      resourceId: body.callId,
    });

    void wsNotify
      .notifyIncomingTransfer({
        userId: body.targetUserId,
        callId: body.callId,
        fromUsername: call.currentHandlerUsername,
        method: NOTIFICATION_METHOD,
      })
      .catch((err) => console.error("WebSocket notifyIncomingTransfer failed:", err));

    return {
      success: true,
      transferId,
      method: NOTIFICATION_METHOD,
      message: "Notifications sent — target dispatcher must accept and complete transfer in CAD.",
      requiresManualAction: true,
    };
  }

  async takeoverCall(user: UserContext, body: TakeoverCallBody): Promise<TransferCallResponse> {
    return this.transferCall(user, {
      callId: body.callId,
      targetUserId: user.userId,
      targetUsername: user.email ?? user.userId,
      reason: body.reason ?? "supervisor_takeover",
      callerPhone: body.callerPhone,
      incidentId: body.incidentId,
      fromUserId: undefined,
    });
  }

  async acceptTransfer(user: UserContext, callId: string): Promise<ActiveCallRecord> {
    assertDispatcher(user);
    const call = await activeCalls.get(user.agencyId, callId);
    if (!call?.pendingTransfer) {
      const err = new Error("NO_PENDING_TRANSFER");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    if (call.pendingTransfer.targetUserId !== user.userId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    const now = new Date().toISOString();
    const updated = await activeCalls.updatePendingTransfer(user.agencyId, callId, null, {
      currentHandlerUserId: user.userId,
      currentHandlerUsername: displayName(user.userId, user.email),
      status: "connected",
    });
    if (!updated) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId: call.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.CALL_TRANSFER_ACCEPTED,
      details: { callId, transferId: call.pendingTransfer.transferId },
      createdAt: now,
      resourceType: "call",
      resourceId: callId,
    });

    return updated;
  }

  async declineTransfer(user: UserContext, callId: string): Promise<ActiveCallRecord> {
    assertDispatcher(user);
    const call = await activeCalls.get(user.agencyId, callId);
    if (!call?.pendingTransfer) {
      const err = new Error("NO_PENDING_TRANSFER");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    if (call.pendingTransfer.targetUserId !== user.userId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    const now = new Date().toISOString();
    const updated = await activeCalls.updatePendingTransfer(user.agencyId, callId, null, {
      status: "connected",
    });
    if (!updated) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId: call.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.CALL_TRANSFER_DECLINED,
      details: { callId, transferId: call.pendingTransfer.transferId },
      createdAt: now,
      resourceType: "call",
      resourceId: callId,
    });

    const targetName = displayName(user.userId, user.email);
    if (call.pendingTransfer.initiatedBy !== user.userId) {
      void wsNotify
        .notifyTransferStatus({
          userId: call.pendingTransfer.initiatedBy,
          callId,
          status: "declined",
          targetUsername: targetName,
        })
        .catch((err) => console.error("WebSocket notifyTransferStatus failed:", err));
    }

    return updated;
  }
}
