/**
 * MTA-STS policy file — served at /.well-known/mta-sts.txt
 *
 * Required at https://mta-sts.nexcortiq.us/.well-known/mta-sts.txt
 * DNS side: _mta-sts.nexcortiq.us TXT "v=STSv1; id=20261119T000000"
 *           mta-sts.nexcortiq.us CNAME d1ttic1ctidkor.cloudfront.net
 *
 * To escalate from testing → enforce after verifying TLS-RPT reports show
 * zero failures, change mode to "enforce". Update the id= timestamp in the
 * DNS record whenever this policy changes (triggers re-fetch by receivers).
 *
 * Receivers: bump _mta-sts TXT id= after any change to this file.
 */
export function GET(): Response {
  const policy = [
    "version: STSv1",
    "mode: testing",
    // Outlook (primary MX)
    "mx: nexcortiq-us.mail.protection.outlook.com",
    // SES custom MailFrom MX (bounce handling)
    "mx: feedback-smtp.us-east-1.amazonses.com",
    // 24-hour TTL — short while in testing mode
    "max_age: 86400",
  ].join("\n") + "\n";

  return new Response(policy, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
