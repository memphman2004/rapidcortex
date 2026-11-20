/**
 * MTA-STS policy file — served at /.well-known/mta-sts.txt
 *
 * Live URL: https://mta-sts.nexcortiq.us/.well-known/mta-sts.txt
 * DNS side: _mta-sts.nexcortiq.us TXT "v=STSv1; id=20261119T000000"
 *           mta-sts.nexcortiq.us CNAME d1ttic1ctidkor.cloudfront.net
 *
 * To escalate from testing → enforce:
 *   1. Verify zero TLS failures in TLS-RPT reports (rua=mailto:tls-reports@nexcortiq.us)
 *   2. Change mode: testing → mode: enforce below
 *   3. Set max_age: 604800 (7 days) or 86400 (1 day)
 *   4. IMPORTANT: bump the _mta-sts TXT id= in Route53 (triggers re-fetch by receivers)
 *      e.g. "v=STSv1; id=20261119T000000" → "v=STSv1; id=YYYYMMDDTHHMMSS"
 */
export function GET(): Response {
  const policy = [
    "version: STSv1",
    "mode: testing",
    // Primary MX — Microsoft 365 / Exchange Online
    "mx: nexcortiq-us.mail.protection.outlook.com",
    // SES bounce-handling MX (custom MailFrom: mail.nexcortiq.us)
    "mx: feedback-smtp.us-east-1.amazonses.com",
    // 24-hour TTL — short while in testing mode; increase to 604800 on enforce
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
