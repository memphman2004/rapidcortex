/**
 * Emergency staff broadcast SMS. Mock when Twilio is unset.
 */
export async function broadcastSmsToStaff(opts: {
  agencyId: string;
  message: string;
  phones: string[];
}): Promise<{ sent: number; mocked: boolean }> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!sid || !token || !from || opts.phones.length === 0) {
    console.info(
      JSON.stringify({
        msg: "venue_broadcast_sms_mock",
        agencyId: opts.agencyId,
        recipients: opts.phones.length,
      }),
    );
    return { sent: 0, mocked: true };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  let sent = 0;
  for (const to of opts.phones) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: opts.message }),
    });
    if (res.ok) sent += 1;
  }
  return { sent, mocked: false };
}
