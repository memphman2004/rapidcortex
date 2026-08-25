/**
 * E2E probe: Hunter.io + Apollo.io for Rapid IQ contact enrichment.
 *
 *   AWS_PROFILE=rapid-cortex STAGE=dev npx tsx scripts/verify-rapid-iq-enrichment-e2e.ts
 *
 * Never prints API keys. Exits 0 only when both providers authenticate successfully.
 */
import { resolvePlainOrSecretArn } from "../apps/api/src/lib/runtimeSecrets";
import { findContactsViaApollo } from "../apps/api/src/lib/rapid-iq/apollo-enrichment";
import { findContactsViaHunter } from "../apps/api/src/lib/rapid-iq/hunter-enrichment";
import { findAgencyContacts } from "../apps/api/src/lib/rapid-iq/agency-contact-finder";

process.env.RAPID_IQ_COLLECTORS_MOCK = "0";
process.env.RAPID_IQ_HUNTER_API_KEY_SECRET_ARN ??=
  "arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/rapid-iq/hunter-api-key-LXEwMX";
process.env.RAPID_IQ_APOLLO_API_KEY_SECRET_ARN ??=
  "arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/rapid-iq/apollo-api-key-BDql0e";

const DOMAIN = process.env.RAPID_IQ_E2E_DOMAIN?.trim() || "franklincountyohio.gov";
const AGENCY = process.env.RAPID_IQ_E2E_AGENCY?.trim() || "Franklin County";
const STATE = process.env.RAPID_IQ_E2E_STATE?.trim() || "OH";
const CITY = process.env.RAPID_IQ_E2E_CITY?.trim() || "Columbus";

type StageResult = {
  provider: string;
  ok: boolean;
  httpStatus?: number;
  contacts: number;
  sample: Array<{ name: string | null; title: string; email: string | null; source: string | null }>;
  error?: string;
};

function summarize(
  provider: string,
  contacts: Awaited<ReturnType<typeof findContactsViaHunter>>,
): StageResult {
  return {
    provider,
    ok: true,
    contacts: contacts.length,
    sample: contacts.slice(0, 3).map((c) => ({
      name: c.name,
      title: c.title,
      email: c.email ? `${c.email.slice(0, 3)}…@${c.email.split("@")[1] ?? "?"}` : null,
      source: c.verificationSource,
    })),
  };
}

async function probeHunterRaw(apiKey: string): Promise<{ status: number; emailCount: number }> {
  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", DOMAIN);
  url.searchParams.set("limit", "5");
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return { status: res.status, emailCount: 0 };
  const body = (await res.json()) as { data?: { emails?: unknown[] } };
  return { status: res.status, emailCount: body.data?.emails?.length ?? 0 };
}

async function probeApolloRaw(apiKey: string): Promise<{ status: number; peopleCount: number }> {
  const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      q_organization_domains: [DOMAIN],
      person_titles: [
        "911 director",
        "emergency communications director",
        "procurement officer",
      ],
      page: 1,
      per_page: 5,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return { status: res.status, peopleCount: 0 };
  const body = (await res.json()) as { people?: unknown[] };
  return { status: res.status, peopleCount: body.people?.length ?? 0 };
}

async function main(): Promise<void> {
  const enrichInput = {
    agencyName: AGENCY,
    city: CITY,
    state: STATE,
    vertical: "911" as const,
    candidateUrls: [`https://www.${DOMAIN}/`, `https://${DOMAIN}/911`],
  };

  console.log(
    JSON.stringify({
      msg: "rapid_iq_enrichment_e2e_start",
      domain: DOMAIN,
      agency: AGENCY,
      state: STATE,
    }),
  );

  const hunterKey = await resolvePlainOrSecretArn(
    process.env.RAPID_IQ_HUNTER_API_KEY,
    process.env.RAPID_IQ_HUNTER_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
  const apolloKey = await resolvePlainOrSecretArn(
    process.env.RAPID_IQ_APOLLO_API_KEY,
    process.env.RAPID_IQ_APOLLO_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );

  if (!hunterKey) {
    console.error(JSON.stringify({ msg: "hunter_secret_missing" }));
    process.exit(1);
  }
  if (!apolloKey) {
    console.error(JSON.stringify({ msg: "apollo_secret_missing" }));
    process.exit(1);
  }

  const hunterRaw = await probeHunterRaw(hunterKey);
  const apolloRaw = await probeApolloRaw(apolloKey);

  console.log(
    JSON.stringify({
      msg: "raw_api_probes",
      hunter: { httpStatus: hunterRaw.status, emailsReturned: hunterRaw.emailCount },
      apollo: { httpStatus: apolloRaw.status, peopleReturned: apolloRaw.peopleCount },
    }),
  );

  const hunterAuthOk = hunterRaw.status >= 200 && hunterRaw.status < 300;
  const apolloAuthOk = apolloRaw.status >= 200 && apolloRaw.status < 300;

  let hunterLib: StageResult;
  let apolloLib: StageResult;
  let pipeline: StageResult;

  try {
    hunterLib = summarize("hunter_lib", (await findContactsViaHunter(enrichInput)).contacts);
  } catch (err) {
    hunterLib = {
      provider: "hunter_lib",
      ok: false,
      contacts: 0,
      sample: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    apolloLib = summarize("apollo_lib", (await findContactsViaApollo(enrichInput)).contacts);
  } catch (err) {
    apolloLib = {
      provider: "apollo_lib",
      ok: false,
      contacts: 0,
      sample: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    const all = await findAgencyContacts({
      agencyName: AGENCY,
      agencyType: "county",
      city: CITY,
      state: STATE,
      vertical: "911",
      priorityUrls: [`https://www.${DOMAIN}/`, `https://${DOMAIN}/911`],
    });
    pipeline = summarize("pipeline", all);
  } catch (err) {
    pipeline = {
      provider: "pipeline",
      ok: false,
      contacts: 0,
      sample: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const report = {
    msg: "rapid_iq_enrichment_e2e_result",
    hunterAuthOk,
    apolloAuthOk,
    apolloPlanBlocked: apolloRaw.status === 403,
    hunterRaw,
    apolloRaw,
    hunterLib,
    apolloLib,
    pipeline,
  };
  console.log(JSON.stringify(report, null, 2));

  if (!hunterAuthOk || !hunterLib.ok || !pipeline.ok) {
    process.exit(1);
  }

  if (!apolloAuthOk) {
    console.log(
      JSON.stringify({
        msg: "rapid_iq_enrichment_e2e_partial",
        hunter: "pass",
        apollo: apolloRaw.status === 403 ? "plan_blocked_free" : "auth_failed",
        note:
          apolloRaw.status === 403
            ? "Apollo API key is valid but Free plan cannot call mixed_people/search — upgrade Apollo to enable stage 2"
            : "Apollo authentication failed",
      }),
    );
    process.exit(2);
  }

  console.log(
    JSON.stringify({
      msg: "rapid_iq_enrichment_e2e_pass",
      note: "Both APIs authenticated; empty contact lists can still be valid for sparse domains",
    }),
  );
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      msg: "rapid_iq_enrichment_e2e_crash",
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});
