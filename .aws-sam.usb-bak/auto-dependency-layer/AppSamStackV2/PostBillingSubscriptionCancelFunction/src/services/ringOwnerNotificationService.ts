import { AdminGetUserCommand, CognitoIdentityProviderClient, ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { env } from "../lib/env.js";
import { sendSilentTextSms } from "../lib/silentTextSms.js";

const ses = new SESClient({ region: env.region });

function cognitoClient(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({ region: env.region });
}

function attr(attrs: { Name?: string; Value?: string }[] | undefined, name: string): string {
  return attrs?.find((a) => a.Name === name)?.Value?.trim() ?? "";
}

async function resolveOwnerContact(userId: string): Promise<{ phoneE164?: string; email?: string }> {
  const pool = env.cognitoUserPoolId;
  if (!pool) return {};

  const cip = cognitoClient();
  try {
    const out = await cip.send(new AdminGetUserCommand({ UserPoolId: pool, Username: userId }));
    const phone = attr(out.UserAttributes, "phone_number");
    const email = attr(out.UserAttributes, "email");
    return { phoneE164: phone || undefined, email: email || undefined };
  } catch {
    // continue
  }

  try {
    const out = await cip.send(
      new ListUsersCommand({
        UserPoolId: pool,
        Filter: `sub = "${userId}"`,
        Limit: 1,
      }),
    );
    const u = out.Users?.[0];
    if (!u) return {};
    return {
      phoneE164: attr(u.Attributes, "phone_number") || undefined,
      email: attr(u.Attributes, "email") || undefined,
    };
  } catch {
    return {};
  }
}

export type RingOwnerNotificationInput = {
  ownerUserId: string;
  agencyId: string;
  agencyName: string;
  incidentId: string;
  incidentCategoryLabel?: string;
  requestedDurationMinutes: number;
  approveUrl: string;
  declineUrl: string;
};

function buildMessageBody(input: RingOwnerNotificationInput): string {
  const incidentLine = input.incidentCategoryLabel
    ? `Incident type: ${input.incidentCategoryLabel}\n`
    : "";
  return [
    "Emergency responders are handling an active incident near your camera location.",
    "",
    `Agency: ${input.agencyName}`,
    incidentLine.replace(/\n$/, ""),
    `Requested sharing duration: ${input.requestedDurationMinutes} minutes`,
    "",
    "You may voluntarily share temporary live video with emergency responders",
    "to improve situational awareness during this incident.",
    "",
    "You remain in control and can stop sharing at any time.",
    "",
    `[Allow Temporary Access] → ${input.approveUrl}`,
    `[Decline]                → ${input.declineUrl}`,
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");
}

export async function notifyRingAccountOwner(
  input: RingOwnerNotificationInput,
): Promise<{ delivered: boolean; channel?: "sms" | "email" }> {
  const subject = "Rapid Cortex Emergency Video Request";
  const body = buildMessageBody(input);
  const contact = await resolveOwnerContact(input.ownerUserId);

  if (contact.phoneE164) {
    const sms = await sendSilentTextSms({
      phoneE164: contact.phoneE164,
      message: `${subject}\n\n${body}`,
      agencyId: input.agencyId,
      incidentId: input.incidentId,
    });
    if (sms.ok) return { delivered: true, channel: "sms" };
  }

  const fromEmail = env.contactFromEmail || "support@rapidcortex.us";
  if (contact.email) {
    try {
      await ses.send(
        new SendEmailCommand({
          Source: fromEmail,
          Destination: { ToAddresses: [contact.email] },
          Message: {
            Subject: { Data: subject },
            Body: { Text: { Data: body } },
          },
        }),
      );
      return { delivered: true, channel: "email" };
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "ring_owner_notification_email_failed",
          agencyId: input.agencyId,
          incidentId: input.incidentId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  console.error(
    JSON.stringify({
      msg: "ring_owner_notification_undelivered",
      agencyId: input.agencyId,
      incidentId: input.incidentId,
      hasPhone: Boolean(contact.phoneE164),
      hasEmail: Boolean(contact.email),
    }),
  );
  return { delivered: false };
}
