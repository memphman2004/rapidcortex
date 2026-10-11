/**
 * Thin Apollo.io account helpers for NexiQ Signals push_to_crm.
 * Reuses the same API key / Secrets Manager wiring as apollo-enrichment.ts.
 * Not a second Apollo product — organization upsert + note + tags only.
 */
import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";
import { isExplicitCollectorsMockEnabled } from "./agenda-finder.js";

const APOLLO_BASE = "https://api.apollo.io/api/v1";

async function resolveApolloApiKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.RAPID_IQ_APOLLO_API_KEY,
    process.env.RAPID_IQ_APOLLO_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
}

export type UpsertApolloAccountInput = {
  agencyName: string;
  vertical: string;
  title: string;
  confidenceScore: number;
  sourceUrl: string;
  state?: string;
};

export type UpsertApolloAccountResult = {
  apolloAccountId: string;
  mocked: boolean;
};

async function apolloFetch(
  apiKey: string,
  path: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(`${APOLLO_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
      ...(init.headers ?? {}),
    },
  });
}

/**
 * Create or find an Apollo organization/account by agency name, attach a note + tags.
 */
export async function upsertApolloAccountFromSignal(
  input: UpsertApolloAccountInput,
): Promise<UpsertApolloAccountResult> {
  const mockUpsert = (): UpsertApolloAccountResult => {
    const mockId = `mock-apollo-${Buffer.from(input.agencyName).toString("hex").slice(0, 12)}`;
    console.log(
      JSON.stringify({
        msg: "apollo_account_upsert_mocked",
        agencyName: input.agencyName,
        apolloAccountId: mockId,
      }),
    );
    return { apolloAccountId: mockId, mocked: true };
  };

  if (isExplicitCollectorsMockEnabled()) {
    return mockUpsert();
  }

  const apiKey = await resolveApolloApiKey();
  if (!apiKey) {
    // Dev/CI without Secrets Manager — same mock path as RAPID_IQ_COLLECTORS_MOCK.
    return mockUpsert();
  }

  // Search existing organizations
  const searchRes = await apolloFetch(apiKey, "/mixed_companies/search", {
    method: "POST",
    body: JSON.stringify({
      q_organization_name: input.agencyName,
      page: 1,
      per_page: 5,
    }),
  });
  if (!searchRes.ok) {
    const text = await searchRes.text();
    throw new Error(`Apollo org search HTTP ${searchRes.status}: ${text.slice(0, 200)}`);
  }
  const searchJson = (await searchRes.json()) as {
    organizations?: Array<{ id?: string; name?: string }>;
    accounts?: Array<{ id?: string; name?: string }>;
  };
  const candidates = searchJson.organizations ?? searchJson.accounts ?? [];
  const exact = candidates.find(
    (o) => (o.name ?? "").trim().toLowerCase() === input.agencyName.trim().toLowerCase(),
  );
  let apolloAccountId = exact?.id?.trim() || candidates[0]?.id?.trim() || "";

  if (!apolloAccountId) {
    const createRes = await apolloFetch(apiKey, "/accounts", {
      method: "POST",
      body: JSON.stringify({
        name: input.agencyName,
        raw_address: input.state ? `${input.state}, USA` : undefined,
      }),
    });
    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`Apollo account create HTTP ${createRes.status}: ${text.slice(0, 200)}`);
    }
    const created = (await createRes.json()) as { account?: { id?: string }; id?: string };
    apolloAccountId = created.account?.id?.trim() || created.id?.trim() || "";
  }

  if (!apolloAccountId) {
    throw new Error("Apollo account id missing after upsert");
  }

  const note = `NexiQ Signal | ${input.vertical} | ${input.title} | Confidence: ${input.confidenceScore} | Source: ${input.sourceUrl || "n/a"}`;
  const noteRes = await apolloFetch(apiKey, "/notes", {
    method: "POST",
    body: JSON.stringify({
      content: note,
      account_id: apolloAccountId,
    }),
  });
  if (!noteRes.ok) {
    console.warn(
      JSON.stringify({
        msg: "apollo_note_failed",
        status: noteRes.status,
        apolloAccountId,
      }),
    );
  }

  const tags = ["nexiq-signal", input.vertical];
  const tagRes = await apolloFetch(apiKey, "/tags", {
    method: "POST",
    body: JSON.stringify({
      names: tags,
      account_ids: [apolloAccountId],
    }),
  });
  if (!tagRes.ok) {
    // Some Apollo plans use /labels — log and continue; account id is still valid.
    console.warn(
      JSON.stringify({
        msg: "apollo_tags_failed",
        status: tagRes.status,
        apolloAccountId,
      }),
    );
  }

  return { apolloAccountId, mocked: false };
}
