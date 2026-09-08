import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { env } from "../lib/env.js";
import { sesConfigurationSetFields } from "../lib/ses/sesConfigurationSet.js";
import type { FieldAccessRequestRecord } from "./store.js";

const sns = new SNSClient({});
const ses = new SESClient({});
const OPS_TO = "support@rapidcortex.us";

function bodyText(row: FieldAccessRequestRecord): string {
  return [
    "Field app workspace access request",
    "",
    `Request ID: ${row.requestId}`,
    `Submitted: ${row.createdAt}`,
    `User: ${row.userEmail} (${row.userId})`,
    `Role: ${row.role}`,
    `Agency: ${row.agencyId}`,
    `Workspace: ${row.requestedWorkspaceTitle} (${row.requestedWorkspace})`,
    "",
    "Reason:",
    row.reason.trim() ? row.reason.trim() : "(none)",
    "",
    "Access, if granted, must stay inside this agencyId. Do not add cross-agency roles.",
  ].join("\n");
}

/** Notify RC ops. Failures are swallowed so the persisted request still succeeds. */
export async function notifyAccessRequest(row: FieldAccessRequestRecord): Promise<{ notified: boolean }> {
  let notified = false;
  const topicArn = env.opsSnsTopicArn.trim();
  if (topicArn) {
    try {
      await sns.send(
        new PublishCommand({
          TopicArn: topicArn,
          Subject: `Field access request: ${row.requestedWorkspace} / ${row.agencyId}`,
          Message: bodyText(row),
        }),
      );
      notified = true;
    } catch (err) {
      console.error("field access-request SNS failed", err);
    }
  }

  const from = env.contactFromEmail.trim();
  if (from) {
    try {
      await ses.send(
        new SendEmailCommand({
          ...sesConfigurationSetFields(),
          Source: from,
          Destination: { ToAddresses: [OPS_TO] },
          Message: {
            Subject: {
              Charset: "UTF-8",
              Data: `Field access request: ${row.requestedWorkspaceTitle} (${row.agencyId})`,
            },
            Body: { Text: { Charset: "UTF-8", Data: bodyText(row) } },
          },
        }),
      );
      notified = true;
    } catch (err) {
      console.error("field access-request SES failed", err);
    }
  }

  return { notified };
}
