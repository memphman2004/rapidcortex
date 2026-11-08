/**
 * SES account-level suppression checks for marketing list writes.
 * Fail-open on API errors so a temporary SES outage does not block imports.
 */

import {
  GetSuppressedDestinationCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";

const sesv2 = new SESv2Client({
  region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
});

export async function isSuppressedInSES(email: string): Promise<boolean> {
  const address = email.trim().toLowerCase();
  if (!address || !address.includes("@")) return false;
  if (process.env.SES_MOCK === "1" || process.env.SES_MOCK === "true") return false;
  try {
    await sesv2.send(new GetSuppressedDestinationCommand({ EmailAddress: address }));
    return true;
  } catch (err: unknown) {
    const name = (err as { name?: string; Code?: string })?.name ?? (err as { Code?: string })?.Code;
    if (name === "NotFoundException" || name === "NotFound") return false;
    console.warn(
      JSON.stringify({
        msg: "ses_suppression_check_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return false;
  }
}
