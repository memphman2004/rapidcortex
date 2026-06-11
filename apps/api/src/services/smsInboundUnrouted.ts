import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { hashPhoneSha256, normalizePhoneE164 } from "../lib/phone-hash.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";

const auditRepo = new AuditRepository();
const sqs = new SQSClient({ region: env.region });

/** Log unrouted inbound SMS for investigation and enqueue for ops review. */
export async function logUnroutedInboundSms(params: {
  toPhone: string;
  fromPhone: string;
  rawBody: string;
}): Promise<void> {
  const toPhone = normalizePhoneE164(params.toPhone);
  const fromPhone = normalizePhoneE164(params.fromPhone);
  const phoneHash = hashPhoneSha256(params.fromPhone);
  const now = new Date().toISOString();

  console.info(
    JSON.stringify({
      type: "sms.inbound",
      event: "unrouted",
      toPhone,
      phoneHash,
      bodyLength: params.rawBody.length,
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: "unrouted",
    actorId: "sms-inbound",
    type: AUDIT_EVENT_TYPES.SMS_INBOUND_UNROUTED,
    details: { toPhone, phoneHash, bodyLength: params.rawBody.length },
    createdAt: now,
    resourceType: "sms_inbound",
    resourceId: toPhone,
  });

  const queueUrl = env.unroutedSmsDlqUrl;
  if (!queueUrl) return;

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        to: toPhone,
        from: fromPhone,
        body: params.rawBody,
        receivedAt: now,
      }),
    }),
  );
}
