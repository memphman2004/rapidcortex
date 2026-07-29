import {
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { env } from "../lib/env.js";
import { sendSilentTextSms } from "../lib/silentTextSms.js";
import { sesConfigurationSetFields } from "../lib/ses/sesConfigurationSet.js";
import { RingCitizenOwnerRepository } from "../repositories/ringCitizenOwnerRepository.js";

const ses = new SESClient({ region: env.region });
const citizenOwners = new RingCitizenOwnerRepository();

function cognitoClient(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({ region: env.region });
}

function attr(attrs: { Name?: string; Value?: string }[] | undefined, name: string): string {
  return attrs?.find((a) => a.Name === name)?.Value?.trim() ?? "";
}

function normalizeE164(raw: string | undefined): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  if (t.startsWith("+") && t.length >= 10) return t;
  const digits = t.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return undefined;
}

async function resolveOwnerContact(
  userId: string,
  opts?: { phoneE164?: string; email?: string; ringAccountId?: string },
): Promise<{ phoneE164?: string; email?: string }> {
  let phoneE164 = normalizeE164(opts?.phoneE164);
  let email = opts?.email?.trim() || undefined;

  if ((!phoneE164 || !email) && opts?.ringAccountId && env.ringCitizenOwnersTable) {
    try {
      const owner = await citizenOwners.getByRingAccountId(opts.ringAccountId);
      phoneE164 = phoneE164 || normalizeE164(owner?.phone);
      email = email || owner?.email?.trim() || undefined;
    } catch {
      // table optional in some stages
    }
  }

  if (phoneE164 && email) return { phoneE164, email };

  const pool = env.cognitoUserPoolId;
  if (!pool) return { phoneE164, email };

  const cip = cognitoClient();
  try {
    const out = await cip.send(new AdminGetUserCommand({ UserPoolId: pool, Username: userId }));
    phoneE164 = phoneE164 || normalizeE164(attr(out.UserAttributes, "phone_number"));
    email = email || attr(out.UserAttributes, "email") || undefined;
    if (phoneE164 || email) return { phoneE164, email };
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
    if (!u) return { phoneE164, email };
    return {
      phoneE164: phoneE164 || normalizeE164(attr(u.Attributes, "phone_number")),
      email: email || attr(u.Attributes, "email") || undefined,
    };
  } catch {
    return { phoneE164, email };
  }
}

/** Best-effort: write Ring profile phone onto the Cognito user used for SMS consent. */
export async function syncCognitoPhoneFromRingProfile(
  username: string,
  phoneRaw: string | undefined,
): Promise<void> {
  const pool = env.cognitoUserPoolId;
  const phone = normalizeE164(phoneRaw);
  if (!pool || !phone || !username.trim()) return;
  try {
    await cognitoClient().send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: pool,
        Username: username,
        UserAttributes: [
          { Name: "phone_number", Value: phone },
          { Name: "phone_number_verified", Value: "true" },
        ],
      }),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_cognito_phone_sync_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

export type RingOwnerNotificationInput = {
  ownerUserId: string;
  agencyId: string;
  agencyName: string;
  incidentId: string;
  incidentCategoryLabel?: string;
  deviceName?: string;
  requestedDurationMinutes: number;
  approveUrl: string;
  declineUrl: string;
  /** Owner stop/revoke link (same SMS as Allow/Decline). */
  stopUrl?: string;
  /** Prefer when known (Ring profile / citizen owner row). */
  ownerPhoneE164?: string;
  ownerEmail?: string;
  ringAccountId?: string;
};

function buildMessageBody(input: RingOwnerNotificationInput): string {
  const device = input.deviceName?.trim() || "camera";
  const incidentType = input.incidentCategoryLabel?.trim() || "active emergency";
  const lines = [
    "RAPID CORTEX EMERGENCY REQUEST",
    `${input.agencyName} is requesting temporary access to your ${device}`,
    `for an active emergency near your address.`,
    `Incident type: ${incidentType}`,
    `Duration: ${input.requestedDurationMinutes} minutes`,
    "",
    `ALLOW: ${input.approveUrl}`,
    `DECLINE: ${input.declineUrl}`,
  ];
  if (input.stopUrl) {
    lines.push(`STOP SHARING: ${input.stopUrl}`);
  }
  lines.push(
    "",
    "Every request requires your approval. You can disconnect anytime.",
  );
  return lines.join("\n");
}

export async function notifyRingAccountOwner(
  input: RingOwnerNotificationInput,
): Promise<{ delivered: boolean; channel?: "sms" | "email" }> {
  const subject = "RAPID CORTEX EMERGENCY REQUEST";
  const body = buildMessageBody(input);
  const contact = await resolveOwnerContact(input.ownerUserId, {
    phoneE164: input.ownerPhoneE164,
    email: input.ownerEmail,
    ringAccountId: input.ringAccountId,
  });

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
          ...sesConfigurationSetFields(),
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
