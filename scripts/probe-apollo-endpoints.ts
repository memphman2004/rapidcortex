/**
 * Probe which Apollo people-search URL/body shape works with our secret.
 * Does not print API keys.
 *
 *   AWS_PROFILE=rapid-cortex npx tsx scripts/probe-apollo-endpoints.ts
 */
import { resolvePlainOrSecretArn } from "../apps/api/src/lib/runtimeSecrets";

async function main(): Promise<void> {
  const apiKey = await resolvePlainOrSecretArn(
    process.env.RAPID_IQ_APOLLO_API_KEY,
    process.env.RAPID_IQ_APOLLO_API_KEY_SECRET_ARN ??
      "arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/rapid-iq/apollo-api-key-BDql0e",
    { preferredField: "apiKey" },
  );
  if (!apiKey) {
    console.log(JSON.stringify({ err: "no_key" }));
    process.exit(1);
  }
  console.log(JSON.stringify({ msg: "apollo_probe_start", keyLen: apiKey.length }));

  const bodies: Array<Record<string, unknown>> = [
    {
      q_organization_domains: ["franklincountyohio.gov"],
      person_titles: ["911 director", "emergency communications director", "procurement officer"],
      page: 1,
      per_page: 5,
    },
    {
      q_organization_domains_list: ["franklincountyohio.gov"],
      person_titles: ["911 director", "emergency communications director", "procurement officer"],
      page: 1,
      per_page: 5,
    },
  ];

  const urls = [
    "https://api.apollo.io/v1/mixed_people/search",
    "https://api.apollo.io/api/v1/mixed_people/search",
    "https://api.apollo.io/api/v1/mixed_people/api_search",
    "https://api.apollo.io/v1/mixed_people/api_search",
  ];

  for (const url of urls) {
    for (const [bi, body] of bodies.entries()) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12_000),
      });
      const text = await res.text();
      let err = text.slice(0, 220);
      try {
        const j = JSON.parse(text) as { error?: string; error_code?: string; people?: unknown[] };
        err = j.error || j.error_code || err;
        console.log(
          JSON.stringify({
            path: url.replace("https://api.apollo.io", ""),
            bodyIndex: bi,
            status: res.status,
            people: j.people?.length ?? 0,
            err: res.ok ? undefined : String(err).slice(0, 200),
          }),
        );
        if (res.ok) {
          console.log(JSON.stringify({ msg: "apollo_probe_success", path: url }));
          return;
        }
      } catch {
        console.log(
          JSON.stringify({
            path: url.replace("https://api.apollo.io", ""),
            bodyIndex: bi,
            status: res.status,
            err: String(err).slice(0, 200),
          }),
        );
      }
    }
  }
  console.log(JSON.stringify({ msg: "apollo_probe_no_success" }));
  process.exit(1);
}

main().catch((e) => {
  console.error(JSON.stringify({ crash: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
