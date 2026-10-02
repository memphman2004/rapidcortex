import type { ScheduledHandler } from "aws-lambda";
import { RcsRepository } from "../features/rcs/rcs-repository.js";
import { buildFloorHealthSnapshot } from "../features/rcs/rcs-intelligence.js";
import { publishRcsEvent } from "../features/rcs/rcs-ws.js";
import { env } from "../lib/env.js";
import { WebSocketConnectionRepository } from "../repositories/websocketConnectionRepository.js";

const repo = new RcsRepository();
const connections = new WebSocketConnectionRepository();

/**
 * EventBridge rate(1 minute) — push floor health snapshots for agencies with
 * open RCS calls and at least one active WebSocket connection.
 */
export const handler: ScheduledHandler = async () => {
  if (!env.enableRcs) {
    console.info(JSON.stringify({ msg: "rcs_floor_health_push_skipped", reason: "ENABLE_RCS_off" }));
    return;
  }

  const byAgency = new Map<string, Awaited<ReturnType<RcsRepository["listCallsByAgency"]>>>();
  let lastKey: Record<string, unknown> | undefined;
  let pushed = 0;

  try {
    for (let page = 0; page < 20; page += 1) {
      const { items, lastKey: next } = await repo.scanOpenCalls({
        limit: 25,
        exclusiveStartKey: lastKey,
      });
      lastKey = next;
      for (const call of items) {
        const list = byAgency.get(call.agencyId) ?? [];
        list.push(call);
        byAgency.set(call.agencyId, list);
      }
      if (!lastKey) break;
    }

    for (const [agencyId, calls] of byAgency) {
      try {
        if (!env.websocketConnectionsTable?.trim()) continue;
        const conns = await connections.listByAgencyId(agencyId);
        if (conns.length === 0) continue;

        const rules = await repo.getEscalationRules(agencyId);
        const snapshot = buildFloorHealthSnapshot(
          agencyId,
          calls,
          rules.dispatchedWithoutArrivalSeconds,
        );
        await publishRcsEvent({ type: "rcs:floor:health", snapshot });
        pushed += 1;
      } catch (err) {
        console.error(
          JSON.stringify({
            msg: "rcs_floor_health_push_agency_failed",
            agencyId,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "rcs_floor_health_push_fatal",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  console.info(JSON.stringify({ msg: "rcs_floor_health_push_done", agencies: byAgency.size, pushed }));
};
