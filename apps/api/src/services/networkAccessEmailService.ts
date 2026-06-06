import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import type { AgencyTenant } from "rapid-cortex-shared";
import { env } from "../lib/env.js";

const ses = new SESClient({ region: env.region });

function senderEmail(): string | null {
  return (
    env.billingSesSenderEmail?.trim() ||
    process.env.SES_SENDER_EMAIL?.trim() ||
    null
  );
}

function brandedHtml(content: string): string {
  const origin = env.publicMarketingSiteOrigin.replace(/\/$/, "");
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172b4d;padding:24px;">
    <p><strong>Rapid Cortex</strong> — network access</p>
    ${content}
    <p style="font-size:12px;color:#64748b;margin-top:24px;">Manage policies at ${origin}</p>
  </body></html>`;
}

function agencyNotifyEmails(agency: AgencyTenant): string[] {
  const emails = new Set<string>();
  if (agency.primaryContactEmail?.trim()) emails.add(agency.primaryContactEmail.trim());
  if (agency.billingContactEmail?.trim()) emails.add(agency.billingContactEmail.trim());
  return [...emails];
}

export async function sendEmergencyOverrideRequestEmail(input: {
  agency: AgencyTenant;
  requesterName: string;
  requesterEmail?: string;
  reason: string;
  requestId: string;
}): Promise<void> {
  const from = senderEmail();
  if (!from) return;

  const to = agencyNotifyEmails(input.agency);
  if (to.length === 0) return;

  const approveHint = `${env.publicMarketingSiteOrigin.replace(/\/$/, "")}/agency-admin/network`;
  const body = brandedHtml(`
    <p>An emergency network access request was submitted for <strong>${input.agency.name}</strong>.</p>
    <ul>
      <li>Requester: ${input.requesterName}${input.requesterEmail ? ` (${input.requesterEmail})` : ""}</li>
      <li>Reason: ${input.reason}</li>
      <li>Request ID: ${input.requestId}</li>
      <li>Time: ${new Date().toISOString()}</li>
    </ul>
    <p>Review and grant a 4-hour override from <a href="${approveHint}">Network access settings</a> if appropriate.</p>
  `);

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: to },
      Message: {
        Subject: {
          Data: `Emergency access request — ${input.agency.name}`,
        },
        Body: { Html: { Data: body } },
      },
    }),
  );
}

export async function sendEmergencyOverrideGrantedEmail(input: {
  agency: AgencyTenant;
  targetEmail: string;
  reason: string;
  expiresAt: string;
}): Promise<void> {
  const from = senderEmail();
  if (!from || !input.targetEmail.trim()) return;

  const body = brandedHtml(`
    <p>Emergency network access was approved for <strong>${input.agency.name}</strong>.</p>
    <p>Reason: ${input.reason}</p>
    <p>Access is available until ${input.expiresAt} (single sign-in). Refresh the app after approval.</p>
  `);

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [input.targetEmail.trim()] },
      Message: {
        Subject: { Data: `Emergency access approved — ${input.agency.name}` },
        Body: { Html: { Data: body } },
      },
    }),
  );
}
