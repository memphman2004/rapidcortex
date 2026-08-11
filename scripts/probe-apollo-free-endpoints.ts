/**
 * Probe Apollo endpoints available on the current plan.
 *   AWS_PROFILE=rapid-cortex npx tsx scripts/probe-apollo-free-endpoints.ts
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

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "X-Api-Key": apiKey,
  };

  const tests: Array<{ method: string; url: string; body?: Record<string, unknown> }> = [
    { method: "GET", url: "https://api.apollo.io/api/v1/auth/health" },
    {
      method: "POST",
      url: "https://api.apollo.io/api/v1/people/match",
      body: {
        name: "Juan Torres",
        organization_domain: "franklincountyohio.gov",
        reveal_personal_emails: false,
      },
    },
    {
      method: "POST",
      url: "https://api.apollo.io/v1/people/match",
      body: {
        name: "Juan Torres",
        organization_domain: "franklincountyohio.gov",
      },
    },
    {
      method: "POST",
      url: "https://api.apollo.io/api/v1/organizations/enrich",
      body: { domain: "franklincountyohio.gov" },
    },
    {
      method: "POST",
      url: "https://api.apollo.io/api/v1/mixed_companies/search",
      body: { q_organization_name: "Franklin County Ohio", page: 1, per_page: 1 },
    },
  ];

  let anyOk = false;
  for (const t of tests) {
    const res = await fetch(t.url, {
      method: t.method,
      headers,
      body: t.body ? JSON.stringify(t.body) : undefined,
      signal: AbortSignal.timeout(12_000),
    });
    const text = await res.text();
    let detail = text.slice(0, 180);
    try {
      const j = JSON.parse(text) as {
        error?: string;
        person?: { name?: string; title?: string; email?: string | null };
        organization?: { name?: string };
      };
      if (j.person) {
        detail = `person:${j.person.name ?? "?"} title:${j.person.title ?? "?"} email:${j.person.email ? "yes" : "no"}`;
      } else if (j.organization) {
        detail = `org:${j.organization.name ?? "?"}`;
      } else {
        detail = j.error || detail;
      }
    } catch {
      /* keep raw */
    }
    console.log(
      JSON.stringify({
        path: t.url.replace("https://api.apollo.io", ""),
        status: res.status,
        detail: String(detail).slice(0, 200),
      }),
    );
    if (res.ok) anyOk = true;
  }

  console.log(JSON.stringify({ msg: anyOk ? "apollo_key_valid_some_endpoints_ok" : "apollo_all_failed" }));
  process.exit(anyOk ? 0 : 1);
}

main().catch((e) => {
  console.error(JSON.stringify({ crash: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
