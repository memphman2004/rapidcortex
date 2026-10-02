/**
 * Apollo.io contact enrichment for pipeline push-to-crm.
 * Step 1: mixed_people/search (free) → Step 2: people/bulk_match reveal (1 credit/contact).
 * Never reveal without credit-guard.canSpend().
 */

import { resolvePlainOrSecretArn } from "../../runtimeSecrets.js";
import { isCollectorsMockEnabled } from "../agenda-finder.js";
import { canSpend } from "./credit-guard.js";

const APOLLO_BASE = "https://api.apollo.io/api/v1";

const TARGET_TITLES = [
  "911 Director",
  "Communications Director",
  "Emergency Communications Director",
  "Director of Emergency Communications",
  "Emergency Services Director",
  "Sheriff",
  "Chief of Police",
  "IT Director",
  "Chief Information Officer",
  "Emergency Management Director",
];

export interface ApolloContact {
  name: string;
  firstName: string;
  lastName: string;
  title: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  source: "apollo";
  creditsUsed: number;
}

interface ApolloPerson {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  sanitized_phone?: string;
  linkedin_url?: string;
  contact?: {
    email?: string;
    sanitized_phone?: string;
  };
}

async function resolveApolloApiKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.RAPID_IQ_APOLLO_API_KEY,
    process.env.RAPID_IQ_APOLLO_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
}

async function searchPeople(
  apiKey: string,
  organizationName: string,
  titles: string[],
  maxResults: number,
): Promise<ApolloPerson[]> {
  const res = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      person_titles: titles,
      organization_names: [organizationName],
      page: 1,
      per_page: maxResults,
      contact_email_status: ["verified", "likely to engage"],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo search HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { people?: ApolloPerson[]; contacts?: ApolloPerson[] };
  return data.people ?? data.contacts ?? [];
}

async function revealContacts(apiKey: string, personIds: string[]): Promise<ApolloPerson[]> {
  if (personIds.length === 0) return [];

  const res = await fetch(`${APOLLO_BASE}/people/bulk_match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      details: personIds.map((id) => ({ id })),
      reveal_personal_emails: false,
      reveal_phone_number: true,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo bulk_match HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { matches?: ApolloPerson[] };
  return data.matches ?? [];
}

/**
 * Search for and reveal up to `maxContacts` contacts at the given agency.
 * Search is free; reveal is gated by canSpend. Returns 0 credits when mock/no key/no reveal.
 */
export async function enrichViaApollo(
  agencyName: string,
  jurisdiction: string | undefined,
  maxContacts: number = 3,
): Promise<{ contacts: ApolloContact[]; creditsUsed: number }> {
  if (isCollectorsMockEnabled()) {
    console.log(JSON.stringify({ msg: "apollo_pipeline_enrich_skipped", reason: "mock" }));
    return { contacts: [], creditsUsed: 0 };
  }

  const apiKey = await resolveApolloApiKey();
  if (!apiKey) {
    console.log(JSON.stringify({ msg: "apollo_pipeline_enrich_skipped", reason: "no_api_key" }));
    return { contacts: [], creditsUsed: 0 };
  }

  const searchNames = [agencyName, jurisdiction].filter(
    (n): n is string => Boolean(n?.trim()),
  );
  let candidates: ApolloPerson[] = [];

  for (const name of searchNames) {
    try {
      candidates = await searchPeople(apiKey, name, TARGET_TITLES, Math.max(1, maxContacts * 2));
      if (candidates.length > 0) break;
    } catch (err) {
      console.warn(
        JSON.stringify({
          msg: "apollo_pipeline_search_failed",
          name,
          error: err instanceof Error ? err.message : "unknown",
        }),
      );
    }
  }

  if (candidates.length === 0) {
    return { contacts: [], creditsUsed: 0 };
  }

  const toReveal = candidates.slice(0, Math.max(0, maxContacts));
  const ids = toReveal.map((p) => p.id).filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return { contacts: [], creditsUsed: 0 };
  }

  // Reveal costs credits — skip if none remaining (search was free).
  // Probe with 1 credit so partial remaining still allows a smaller reveal batch.
  const revealCheck = await canSpend("apollo", 1);
  if (!revealCheck.allowed || revealCheck.remaining <= 0) {
    console.log(
      JSON.stringify({
        msg: "apollo_pipeline_reveal_skipped",
        reason: "credits_exhausted",
        candidates: candidates.length,
        remaining: revealCheck.remaining,
      }),
    );
    return { contacts: [], creditsUsed: 0 };
  }

  const revealCount = Math.min(ids.length, revealCheck.remaining, maxContacts);
  const idsToReveal = ids.slice(0, revealCount);

  let revealed: ApolloPerson[] = [];
  try {
    revealed = await revealContacts(apiKey, idsToReveal);
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "apollo_pipeline_reveal_failed",
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
    return { contacts: [], creditsUsed: 0 };
  }

  const withEmail = revealed.filter((p) => Boolean(p.email || p.contact?.email));

  const contacts: ApolloContact[] = withEmail.map((p) => ({
    name: p.name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
    firstName: p.first_name ?? "",
    lastName: p.last_name ?? "",
    title: p.title ?? "",
    email: p.email ?? p.contact?.email,
    phone: p.sanitized_phone ?? p.contact?.sanitized_phone,
    linkedinUrl: p.linkedin_url,
    source: "apollo" as const,
    creditsUsed: 1,
  }));

  const creditsUsed = withEmail.length;
  console.log(
    JSON.stringify({
      msg: "apollo_pipeline_enrich_ok",
      candidates: candidates.length,
      revealed: creditsUsed,
    }),
  );
  return { contacts, creditsUsed };
}
