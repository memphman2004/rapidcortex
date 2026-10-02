import { CreateScheduleCommand, DeleteScheduleCommand, SchedulerClient } from "@aws-sdk/client-scheduler";
import type { RcsEscalationLevel } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { RcsRepository } from "./rcs-repository.js";

const client = new SchedulerClient({ region: env.region });
const repo = new RcsRepository();

/** Escalation ladder — minutes after call start (or last reset) each tier fires. */
const ESCALATION_STEPS: { level: RcsEscalationLevel; delayMinutes: number }[] = [
  { level: "LEVEL_1", delayMinutes: 5 },
  { level: "LEVEL_2", delayMinutes: 10 },
  { level: "LEVEL_3", delayMinutes: 15 },
  { level: "CRITICAL", delayMinutes: 20 },
];

function scheduleNameFor(callId: string, level: RcsEscalationLevel): string {
  return `rcs-esc-${callId}-${level}`.replace(/[^A-Za-z0-9-_.]/g, "-").slice(0, 64);
}

/** `at()` expressions require literal local time with no trailing `Z`/milliseconds. */
function toSchedulerAtExpression(date: Date): string {
  return `at(${date.toISOString().replace(/\.\d{3}Z$/, "")})`;
}

function schedulerConfigured(): boolean {
  return Boolean(env.rcsSchedulerRoleArn && env.rcsEscalationFunctionArn);
}

/**
 * Creates one one-time EventBridge Schedule per escalation tier for a newly opened RCS call.
 * When `RCS_SCHEDULER_ROLE_ARN` / `RCS_ESCALATION_FUNCTION_ARN` are unset (local/CI), this
 * logs and no-ops so the rest of the RCS flow (start/state/close) keeps working.
 */
export async function scheduleEscalations(callId: string, agencyId: string): Promise<void> {
  if (!schedulerConfigured()) {
    console.warn(JSON.stringify({ msg: "rcs_scheduler_skip_unconfigured", callId, agencyId }));
    return;
  }

  for (const step of ESCALATION_STEPS) {
    const name = scheduleNameFor(callId, step.level);
    const firesAt = new Date(Date.now() + step.delayMinutes * 60_000);
    try {
      await client.send(
        new CreateScheduleCommand({
          Name: name,
          ScheduleExpression: toSchedulerAtExpression(firesAt),
          FlexibleTimeWindow: { Mode: "OFF" },
          ActionAfterCompletion: "DELETE",
          Target: {
            Arn: env.rcsEscalationFunctionArn,
            RoleArn: env.rcsSchedulerRoleArn,
            Input: JSON.stringify({ callId, agencyId, level: step.level }),
          },
        }),
      );
      await repo.recordEscalationSchedule({
        callId,
        agencyId,
        level: step.level,
        scheduleName: name,
        firesAt: firesAt.toISOString(),
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "rcs_scheduler_create_failed",
          callId,
          level: step.level,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}

/** Cancels all pending escalation schedules for a call (on UNIT_ARRIVED, close, or override). */
export async function cancelEscalations(callId: string): Promise<void> {
  const pending = await repo.listEscalationSchedules(callId);
  if (pending.length === 0) return;

  for (const item of pending) {
    if (schedulerConfigured()) {
      try {
        await client.send(new DeleteScheduleCommand({ Name: item.scheduleName }));
      } catch (err) {
        // Already fired / deleted — safe to ignore; still clear the tracking row below.
        console.warn(
          JSON.stringify({
            msg: "rcs_scheduler_delete_failed",
            callId,
            scheduleName: item.scheduleName,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
    await repo.deleteEscalationSchedule(callId, item.scheduleName);
  }
}
