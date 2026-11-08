/**
 * On-demand / scheduled Apollo people search → marketing stores (email list + marketing leads).
 * Does not create SalesLead CRM rows (apolloLeadsIngest still owns that path).
 */

import {
  APOLLO_VERTICAL_SEARCH_TITLES,
  emailListPartitionsForVertical,
  emailListVerticalToLeadVertical,
  normalizeEmailListVertical,
  type EmailListVertical,
} from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";
import { upsertMarketingContact } from "./marketing-contacts-upsert.js";

const APOLLO_SEARCH_URLS = [
  "https://api.apollo.io/api/v1/mixed_people/api_search",
  "https://api.apollo.io/api/v1/mixed_people/search",
];

type ApolloPerson = {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  organization?: { name?: string };
  organization_name?: string;
};

export type ApolloMarketingSyncResult = {
  vertical: EmailListVertical;
  scanned: number;
  imported: number;
  skipped: number;
  errors: number;
};

async function resolveApolloApiKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.RAPID_IQ_APOLLO_API_KEY,
    process.env.RAPID_IQ_APOLLO_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
}

async function searchApolloPeople(titles: string[], page: number): Promise<ApolloPerson[]> {
  const apiKey = (await resolveApolloApiKey()).trim();
  if (!apiKey) return [];

  for (const url of APOLLO_SEARCH_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": apiKey,
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          person_titles: titles.slice(0, 8),
          page,
          per_page: 25,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404) continue;
        console.warn(JSON.stringify({ msg: "apollo_marketing_search_http", status: res.status }));
        return [];
      }
      const body = (await res.json()) as { people?: ApolloPerson[] };
      return Array.isArray(body.people) ? body.people : [];
    } catch (err) {
      console.warn(
        JSON.stringify({
          msg: "apollo_marketing_search_failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
  return [];
}

export async function syncApolloMarketingVertical(
  vertical: EmailListVertical,
  opts?: { maxPages?: number },
): Promise<ApolloMarketingSyncResult> {
  // Law / fire fold into PSAP; merge legacy partition title keywords for Apollo search.
  const uiVertical = normalizeEmailListVertical(vertical);
  const titleSet = new Set<string>();
  for (const part of emailListPartitionsForVertical(uiVertical)) {
    for (const t of APOLLO_VERTICAL_SEARCH_TITLES[part] ?? []) titleSet.add(t);
  }
  const titles = [...titleSet];
  const maxPages = opts?.maxPages ?? 2;
  let scanned = 0;
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const leadVertical = emailListVerticalToLeadVertical(uiVertical);

  for (let page = 1; page <= maxPages; page += 1) {
    const people = await searchApolloPeople(titles, page);
    if (people.length === 0) break;
    for (const person of people) {
      scanned += 1;
      const email = (person.email ?? "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        skipped += 1;
        continue;
      }
      try {
        const result = await upsertMarketingContact({
          email,
          vertical: leadVertical,
          firstName: person.first_name,
          lastName: person.last_name,
          name: person.name,
          title: person.title,
          agencyName: person.organization?.name ?? person.organization_name,
          source: "apollo",
          sourceId: person.id,
        });
        if (!result.ok) {
          skipped += 1;
          continue;
        }
        if (result.emailList === "created" || result.marketingLead === "created") {
          imported += 1;
        } else {
          skipped += 1;
        }
      } catch (err) {
        errors += 1;
        console.warn(
          JSON.stringify({
            msg: "apollo_marketing_upsert_failed",
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
  }

  return { vertical: uiVertical, scanned, imported, skipped, errors };
}
