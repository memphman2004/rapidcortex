import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { RcsEscalationTriggerEvent } from "rapid-cortex-shared";
import { RCS_CLOSED_STATES } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { RcsRepository } from "../features/rcs/rcs-repository.js";

const repo = new RcsRepository();
const auditRepo = new AuditRepository();
const sns = new SNSClient({});

/**
 * EventBridge Scheduler target (no HTTP route). One-off schedule created by
 * `scheduleEscalations` for each escalation tier at RCS call start; self-deletes on fire
 * (`ActionAfterCompletion: DELETE`). Bumps the call's escalation tier when the call has not
 * already progressed to UNIT_ARRIVED, SUPERVISOR_ACKNOWLEDGED, or a closed state.
 */
export const handler = async (event: RcsEscalationTriggerEvent): Promise<void> => {
  const { callId, agencyId, level } = event;
  if (!callId || !agencyId || !level) {
    console.error(JSON.stringify({ msg: "rcs_escalation_trigger_invalid_event", event }));
    return;
  }

  try {
    const call = await repo.getCall(agencyId, callId);
    if (!call) {
      console.warn(JSON.stringify({ msg: "rcs_escalation_trigger_call_not_found", callId, agencyId }));
      return;
    }

    const alreadyResolved =
      RCS_CLOSED_STATES.includes(call.state) ||
      call.state === "UNIT_ARRIVED" ||
      call.state === "SUPERVISOR_ACKNOWLEDGED";
    if (alreadyResolved) {
      return;
    }

    const now = new Date().toISOString();
    const updated = {
      ...call,
      state: "ESCALATED" as const,
      escalationLevel: level,
      updatedAt: now,
    };
    await repo.putCall(updated);

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: "system:rcs-escalation-scheduler",
      type: AUDIT_EVENT_TYPES.RCS_CALL_ESCALATED,
      details: { fromState: call.state, level, automated: true },
      createdAt: now,
      resourceType: "rcs_call",
      resourceId: callId,
    });

    const topicArn = env.rcsEscalationSnsTopicArn.trim();
    if (topicArn) {
      await sns
        .send(
          new PublishCommand({
            TopicArn: topicArn,
            Subject: `RCS escalation: ${level}`,
            Message: `RCS call ${callId} (agency ${agencyId}) escalated to ${level} without unit arrival confirmation.`,
          }),
        )
        .catch((err) =>
          console.error(
            JSON.stringify({ msg: "rcs_escalation_sns_publish_failed", callId, error: err instanceof Error ? err.message : String(err) }),
          ),
        );
    }
  } catch (err) {
    console.error(
      JSON.stringify({ msg: "rcs_escalation_trigger_failed", callId, agencyId, level, error: err instanceof Error ? err.message : String(err) }),
    );
  }
};
