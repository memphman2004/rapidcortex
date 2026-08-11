import { randomUUID } from "node:crypto";
import type { RapidIqContact } from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";
import { isCollectorsMockEnabled } from "./agenda-finder.js";
import {
  collectAgencyDomains,
  type ContactEnrichInput,
  inferRoleTier,
  isPublicSafetyRelevantTitle,
  MAX_CONTACTS,
  mergeContacts,
} from "./contact-enrichment-shared.js";

type HunterEmail = {
  value?: string;
  confidence?: number;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  linkedin?: string | null;
  phone_number?: string | null;
  verification?: { status?: string | null } | null;
};

type HunterDomainSearchResponse = {
  data?: {
    domain?: string;
    emails?: HunterEmail[];
  };
};

const MIN_CONFIDENCE = 70;

async function resolveHunterApiKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.RAPID_IQ_HUNTER_API_KEY,
    process.env.RAPID_IQ_HUNTER_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
}

function fullName(first?: string | null, last?: string | null): string | null {
  const name = [first?.trim(), last?.trim()].filter(Boolean).join(" ").trim();
  return name || null;
}

function mapHunterEmail(
  email: HunterEmail,
  domain: string | null,
): Omit<RapidIqContact, "opportunityId"> | null {
  const address = email.value?.trim().toLowerCase() ?? "";
  if (!address || !address.includes("@")) return null;
  const confidence = email.confidence ?? 0;
  if (confidence > 0 && confidence < MIN_CONFIDENCE) return null;

  const title = (email.position?.trim() || "Public safety contact").slice(0, 120);
  // Prefer decision-maker titles; skip unrelated roles even at high Hunter confidence.
  if (email.position && !isPublicSafetyRelevantTitle(email.position)) {
    return null;
  }

  const name = fullName(email.first_name, email.last_name);
  const verified =
    email.verification?.status === "valid" || confidence >= 90 || Boolean(name && address);

  return {
    contactId: randomUUID(),
    name,
    title,
    roleTier: inferRoleTier(title),
    matchType: name ? "exact" : "related",
    matchedOn: title,
    verificationStatus: verified ? "verified" : "predicted",
    verificationSource: "Hunter.io",
    sourceCount: 1,
    verifiedAt: verified ? new Date().toISOString() : null,
    sourceUrl: domain ? `https://${domain}` : "https://hunter.io",
    email: address,
    emailVerified: email.verification?.status === "valid" || confidence >= 85,
    phone: email.phone_number?.trim() || null,
    linkedInUrl: email.linkedin?.trim() || null,
  };
}

/**
 * Hunter domain-search. Auth via Authorization Bearer (never api_key query param).
 * Best source for .gov / .edu agency directories.
 */
async function hunterDomainSearch(
  apiKey: string,
  domain: string,
): Promise<Omit<RapidIqContact, "opportunityId">[]> {
  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("limit", "10");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    console.log(JSON.stringify({ msg: "hunter_api_error", status: res.status, domain }));
    return [];
  }
  const body = (await res.json()) as HunterDomainSearchResponse;
  const out: Omit<RapidIqContact, "opportunityId">[] = [];
  for (const e of body.data?.emails ?? []) {
    const mapped = mapHunterEmail(e, body.data?.domain ?? domain);
    if (mapped) out.push(mapped);
    if (out.length >= MAX_CONTACTS) break;
  }
  return out;
}

/**
 * Stage 1: Hunter.io domain search (.gov / .edu preferred).
 */
export async function findContactsViaHunter(
  input: ContactEnrichInput,
): Promise<Omit<RapidIqContact, "opportunityId">[]> {
  if (isCollectorsMockEnabled()) return [];

  const apiKey = await resolveHunterApiKey();
  if (!apiKey) {
    console.log(JSON.stringify({ msg: "hunter_enrichment_skipped", reason: "no_api_key" }));
    return [];
  }

  const domains = collectAgencyDomains(input.candidateUrls ?? []);
  if (domains.length === 0) {
    console.log(JSON.stringify({ msg: "hunter_enrichment_skipped", reason: "no_domain" }));
    return [];
  }

  const found: Omit<RapidIqContact, "opportunityId">[] = [];
  try {
    for (const domain of domains) {
      if (found.length >= MAX_CONTACTS) break;
      const batch = await hunterDomainSearch(apiKey, domain);
      found.push(...batch);
    }
  } catch (err) {
    console.log(
      JSON.stringify({
        msg: "hunter_domain_search_failed",
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
  }

  return found.slice(0, MAX_CONTACTS);
}

/** @deprecated use findContactsViaHunter — kept for existing imports during transition */
export async function enrichContactsWithHunter(
  input: ContactEnrichInput,
  existing: Omit<RapidIqContact, "opportunityId">[],
): Promise<Omit<RapidIqContact, "opportunityId">[]> {
  const found = await findContactsViaHunter(input);
  return mergeContacts(existing, found);
}

export {
  collectAgencyDomains as collectHunterDomains,
  extractDomainFromUrl,
  inferRoleTier,
  isPublicSafetyRelevantTitle,
} from "./contact-enrichment-shared.js";
export type { ContactEnrichInput as HunterEnrichInput } from "./contact-enrichment-shared.js";
