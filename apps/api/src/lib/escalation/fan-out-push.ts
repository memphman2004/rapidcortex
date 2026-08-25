import type { EscalationRecord } from "rapid-cortex-shared";
import {
  deletePushSubscription,
  listPushSubscriptions,
  type StoredPushSubscription,
} from "./push-subscriptions-db.js";

export type EscalationPushFanoutResult = {
  attempted: number;
  delivered: number;
  expired: number;
  mocked: boolean;
};

function subscriptionIdFromSk(sk: string): string {
  return sk.startsWith("SUB#") ? sk.slice(4) : sk;
}

/**
 * Fan-out Web Push to stored venue/PSAP subscriptions.
 * When VAPID is unset (local/CI), logs a mock delivery so Dynamo persistence
 * can be verified without a live push service.
 */
export async function fanOutEscalationPush(
  escalation: EscalationRecord,
): Promise<EscalationPushFanoutResult> {
  const agencyIds = [...new Set([escalation.targetAgencyId, escalation.sourceAgencyId].filter(Boolean))];
  const collected: StoredPushSubscription[] = [];
  for (const agencyId of agencyIds) {
    collected.push(...(await listPushSubscriptions(agencyId)));
  }

  const unique = new Map<string, StoredPushSubscription>();
  for (const sub of collected) {
    if (sub.endpoint) unique.set(sub.endpoint, sub);
  }
  const targets = [...unique.values()];
  const vapidPublic = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";

  if (!vapidPublic || targets.length === 0) {
    console.info(
      JSON.stringify({
        msg: "escalation_push_fanout_mock",
        escalationId: escalation.escalationId,
        attempted: targets.length,
        reason: targets.length === 0 ? "no_subscriptions" : "vapid_unset",
      }),
    );
    return { attempted: targets.length, delivered: 0, expired: 0, mocked: true };
  }

  const payload = JSON.stringify({
    title: "911 escalation",
    body: `${escalation.sourceAgencyName}: ${escalation.incidentType}`,
    url: `/e/${escalation.viewerToken}`,
    escalationId: escalation.escalationId,
  });

  let delivered = 0;
  let expired = 0;
  for (const sub of targets) {
    try {
      const res = await fetch(sub.endpoint, {
        method: "POST",
        headers: {
          TTL: "120",
          Urgency: "high",
          "Content-Type": "application/json",
        },
        body: payload,
      });
      if (res.status === 200 || res.status === 201 || res.status === 204) {
        delivered += 1;
        continue;
      }
      if (res.status === 404 || res.status === 410) {
        expired += 1;
        await deletePushSubscription({
          agencyId: sub.agencyId,
          subscriptionId: subscriptionIdFromSk(sub.sk),
        });
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "escalation_push_fanout_failed",
          escalationId: escalation.escalationId,
          agencyId: sub.agencyId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  console.info(
    JSON.stringify({
      msg: "escalation_push_fanout",
      escalationId: escalation.escalationId,
      attempted: targets.length,
      delivered,
      expired,
    }),
  );
  return { attempted: targets.length, delivered, expired, mocked: false };
}
