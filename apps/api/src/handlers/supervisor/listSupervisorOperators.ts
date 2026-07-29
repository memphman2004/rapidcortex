import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { forbidden, ok, serverError, unauthorized } from "../../lib/response.js";
import { ActiveCallRepository } from "../../repositories/activeCallRepository.js";
import { WebSocketConnectionRepository } from "../../repositories/websocketConnectionRepository.js";

const authz = new AuthorizationService();
const connections = new WebSocketConnectionRepository();
const activeCalls = new ActiveCallRepository();

const DISPATCH_ROLES = new Set([
  "dispatcher",
  "supervisor",
  "commsupervisor",
  "CAMPUS_DISPATCH",
  "CAMPUS_SUPERVISOR",
  "VENUE_OPERATOR",
  "VENUE_SUPERVISOR",
]);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    if (!authz.canAccessSupervisorRoutes(user)) return forbidden();

    let rows;
    try {
      rows = await connections.listByAgencyId(user.agencyId);
    } catch (e) {
      if (e instanceof Error && e.message === "WEBSOCKET_CONNECTIONS_UNAVAILABLE") {
        return ok({ items: [], warning: "websocket_connections_unavailable" });
      }
      throw e;
    }

    const byUser = new Map<
      string,
      {
        userId: string;
        displayName: string;
        role: string;
        connectedAt: string;
        connectionCount: number;
      }
    >();

    for (const row of rows) {
      if (!DISPATCH_ROLES.has(row.role) && row.role !== "dispatcher") {
        // Still show any connected agency staff who are not pure admins.
        if (row.role === "agencyadmin" || row.role === "agencyit" || row.role === "auditor") {
          continue;
        }
      }
      const existing = byUser.get(row.userId);
      if (!existing) {
        byUser.set(row.userId, {
          userId: row.userId,
          displayName: row.displayName || row.userId,
          role: row.role,
          connectedAt: row.connectedAt,
          connectionCount: 1,
        });
      } else {
        existing.connectionCount += 1;
        if (row.connectedAt < existing.connectedAt) existing.connectedAt = row.connectedAt;
      }
    }

    let calls: Awaited<ReturnType<ActiveCallRepository["listByAgency"]>> = [];
    try {
      calls = await activeCalls.listByAgency(user.agencyId);
    } catch {
      calls = [];
    }
    const activeByHandler = new Map<string, { callId: string; incidentId?: string; status: string }>();
    for (const c of calls) {
      if (c.status === "ended") continue;
      if (!c.currentHandlerUserId) continue;
      activeByHandler.set(c.currentHandlerUserId, {
        callId: c.callId,
        incidentId: c.incidentId,
        status: c.status,
      });
    }

    const items = [...byUser.values()]
      .map((op) => {
        const call = activeByHandler.get(op.userId);
        return {
          ...op,
          status: call ? "on_call" : "online",
          activeCallId: call?.callId ?? null,
          activeIncidentId: call?.incidentId ?? null,
          callStatus: call?.status ?? null,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return ok({ items });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden();
    console.error("listSupervisorOperators", e);
    return serverError();
  }
};
