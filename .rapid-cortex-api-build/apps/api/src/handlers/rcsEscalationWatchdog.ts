import type { ScheduledHandler } from "aws-lambda";
import type { RcsEscalationLevel } from "rapid-cortex-shared";
import { RcsRepository } from "../features/rcs/rcs-repository.js";
import { secondsSince } from "../features/rcs/rcs-intelligence.js";
import { publishRcsEvent } from "../features/rcs/rcs-ws.js";
import { env } from "../lib/env.js";

const repo = new RcsRepository();

type EscalationReason =
  | "dispatched_timeout"
  | "level1_unacked"
  | "level2_unacked"
  | "audio_silence";

/**
 * EventBridge every 60s — threshold-based escalation watchdog.
 * Uses conditional writes on updatedAt to avoid races with dispatcher mutations.
 */
export const handler: ScheduledHandler = async () => {
  if (!env.enableRcs) {
    console.info(JSON.stringify({ msg: "rcs_watchdog_skipped", reason: "ENABLE_RCS_off" }));
    return;
  }

  let escalated = 0;
  let errors = 0;
  let lastKey: Record<string, unknown> | undefined;
  const rulesCache = new Map<string, Awaited<ReturnType<RcsRepository["getEscalationRules"]>>>();

  async function rulesFor(agencyId: string) {
    const cached = rulesCache.get(agencyId);
    if (cached) return cached;
    const r = await repo.getEscalationRules(agencyId);
    rulesCache.set(agencyId, r);
    return r;
  }

  try {
    for (let page = 0; page < 20; page += 1) {
      const { items, lastKey: next } = await repo.scanOpenCalls({
        limit: 25,
        exclusiveStartKey: lastKey,
      });
      lastKey = next;

      for (const call of items) {
        try {
          const rules = await rulesFor(call.agencyId);
          const stateEntered = call.stateEnteredAt ?? call.updatedAt;
          const timeInState = secondsSince(stateEntered);
          const hasOnScene = call.units.some((u) => u.onScene);
          const ackMissing = !call.supervisorAckAt;
          const audioSilentFor = secondsSince(
            call.audioSilentSince ??
              (call.audioStatus === "SILENT" ? call.updatedAt : undefined),
          );

          let nextLevel: RcsEscalationLevel | null = null;
          let reason: EscalationReason | null = null;
          let setAudioAlert = false;

          if (
            (call.state === "UNIT_DISPATCHED" || call.state === "UNIT_EN_ROUTE") &&
            !hasOnScene &&
            timeInState > rules.dispatchedWithoutArrivalSeconds &&
            call.escalationLevel === "NONE"
          ) {
            nextLevel = "LEVEL_1";
            reason = "dispatched_timeout";
          } else if (
            call.escalationLevel === "LEVEL_1" &&
            ackMissing &&
            timeInState > rules.level1UnackedSeconds
          ) {
            nextLevel = "LEVEL_2";
            reason = "level1_unacked";
          } else if (
            call.escalationLevel === "LEVEL_2" &&
            ackMissing &&
            timeInState > rules.level2UnackedSeconds
          ) {
            nextLevel = "LEVEL_3";
            reason = "level2_unacked";
          } else if (
            call.audioStatus === "SILENT" &&
            audioSilentFor > rules.audioSilenceAlertSeconds &&
            !hasOnScene &&
            call.state !== "AUDIO_ALERT"
          ) {
            setAudioAlert = true;
            reason = "audio_silence";
          }

          if (!reason) continue;

          const now = new Date().toISOString();
          const previousLevel = call.escalationLevel;
          const attrs: Record<string, unknown> = {
            updatedAt: now,
          };
          if (nextLevel) {
            attrs.escalationLevel = nextLevel;
            attrs.stateEnteredAt = now;
          }
          if (setAudioAlert) {
            attrs.state = "AUDIO_ALERT";
            attrs.stateEnteredAt = now;
            if (call.escalationLevel === "NONE") {
              attrs.escalationLevel = "LEVEL_1";
              nextLevel = "LEVEL_1";
            } else {
              nextLevel = call.escalationLevel;
            }
          }

          const updated = await repo.updateCallAttributes(
            call.agencyId,
            call.callId,
            attrs,
            { expectedUpdatedAt: call.updatedAt },
          );
          if (!updated) continue;

          escalated += 1;
          if (rules.supervisorPushOnEscalation && nextLevel) {
            await publishRcsEvent({
              type: "rcs:escalation:triggered",
              callId: call.callId,
              agencyId: call.agencyId,
              previousLevel,
              newLevel: nextLevel,
              reason,
            });
          }

          console.info(
            JSON.stringify({
              msg: "rcs_watchdog_escalated",
              callId: call.callId,
              agencyId: call.agencyId,
              reason,
              previousLevel,
              newLevel: nextLevel,
            }),
          );
        } catch (err) {
          errors += 1;
          console.error(
            JSON.stringify({
              msg: "rcs_watchdog_call_failed",
              callId: call.callId,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      }

      if (!lastKey) break;
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "rcs_watchdog_fatal",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  console.info(JSON.stringify({ msg: "rcs_watchdog_done", escalated, errors }));
};
