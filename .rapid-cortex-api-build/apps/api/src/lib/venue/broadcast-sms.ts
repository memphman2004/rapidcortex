import { sendIncidentMediaLinkSms } from "../../services/sms/smsProviderFactory.js";
import { buildSmsFactoryEnvForAgency } from "../smsFactoryEnv.js";

/**
 * Emergency staff broadcast SMS via AWS End User Messaging (mock when SMS_PROVIDER=mock).
 */
export async function broadcastSmsToStaff(opts: {
  agencyId: string;
  message: string;
  phones: string[];
}): Promise<{ sent: number; mocked: boolean }> {
  if (opts.phones.length === 0) {
    return { sent: 0, mocked: true };
  }

  const factoryEnv = await buildSmsFactoryEnvForAgency(opts.agencyId);
  let sent = 0;
  let mocked = false;
  for (const to of opts.phones) {
    const result = await sendIncidentMediaLinkSms(factoryEnv, {
      toPhoneE164: to,
      messageBody: opts.message,
      agencyId: opts.agencyId,
      incidentId: `broadcast-${opts.agencyId}`,
      messageType: "silent_text",
    });
    if (result.provider === "mock") mocked = true;
    if (result.status === "sent") sent += 1;
  }
  if (mocked && sent === 0) {
    console.info(
      JSON.stringify({
        msg: "venue_broadcast_sms_mock",
        agencyId: opts.agencyId,
        recipients: opts.phones.length,
      }),
    );
  }
  return { sent, mocked };
}
