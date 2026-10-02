import { randomUUID } from "node:crypto";
import type { RapidIqContact } from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";
import { isExplicitCollectorsMockEnabled } from "./agenda-finder.js";
import {
  collectAgencyDomains,
  type ContactEnrichInput,
  type ContactProviderResult,
  type ContactProviderTrace,
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
 * Hunter domain-search. Prefer Authorization Bearer; fall back to api_key query param.
 * Best source for .gov / .edu agency directories.
 */
async function hunterDomainSearch(
  apiKey: string,
  domain: string,
): Promise<{ contacts: Omit<RapidIqContact, "opportunityId">[]; trace: ContactProviderTrace }> {
  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("limit", "10");

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  let res = await fetch(url.toString(), {
    headers,
    signal: AbortSignal.timeout(8_000),
  });
  // Some Hunter keys still only accept the legacy api_key query param.
  if (res.status === 401 || res.status === 403) {
    const fallback = new URL("https://api.hunter.io/v2/domain-search");
    fallback.searchParams.set("domain", domain);
    fallback.searchParams.set("limit", "10");
    fallback.searchParams.set("api_key", apiKey);
    res = await fetch(fallback.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
  }
  if (!res.ok) {
    console.log(JSON.stringify({ msg: "hunter_api_error", status: res.status, domain }));
    return {
      contacts: [],
      trace: {
        provider: "hunter",
        domain,
        httpStatus: res.status,
        rawHits: 0,
        kept: 0,
        error: res.status === 429 ? "rate_limited" : `http_${res.status}`,
      },
    };
  }
  const body = (await res.json()) as HunterDomainSearchResponse;
  const emails = body.data?.emails ?? [];
  let droppedByTitle = 0;
  let droppedByConfidence = 0;
  const out: Omit<RapidIqContact, "opportunityId">[] = [];
  for (const e of emails) {
    const confidence = e.confidence ?? 0;
    if (confidence > 0 && confidence < MIN_CONFIDENCE) {
      droppedByConfidence += 1;
      continue;
    }
    if (e.position && !isPublicSafetyRelevantTitle(e.position)) {
      droppedByTitle += 1;
      continue;
    }
    const mapped = mapHunterEmail(e, body.data?.domain ?? domain);
    if (mapped) out.push(mapped);
    if (out.length >= MAX_CONTACTS) break;
  }
  return {
    contacts: out,
    trace: {
      provider: "hunter",
      domain,
      httpStatus: res.status,
      rawHits: emails.length,
      kept: out.length,
      droppedByTitle,
      droppedByConfidence,
    },
  };
}

/**
 * Stage 1: Hunter.io domain search (.gov / .edu preferred).
 */
export async function hasHunterApiKey(): Promise<boolean> {
  if (isExplicitCollectorsMockEnabled()) return false;
  return Boolean(await resolveHunterApiKey());
}

export async function findContactsViaHunter(
  input: ContactEnrichInput,
): Promise<ContactProviderResult> {
  if (isExplicitCollectorsMockEnabled()) {
    return {
      contacts: [],
      traces: [{ provider: "hunter", domain: "", httpStatus: 0, rawHits: 0, kept: 0, error: "mock" }],
    };
  }

  const apiKey = await resolveHunterApiKey();
  if (!apiKey) {
    console.log(JSON.stringify({ msg: "hunter_enrichment_skipped", reason: "no_api_key" }));
    return {
      contacts: [],
      traces: [{ provider: "hunter", domain: "", httpStatus: 0, rawHits: 0, kept: 0, error: "no_api_key" }],
    };
  }

  const domains = collectAgencyDomains(input.candidateUrls ?? []);
  if (domains.length === 0) {
    console.log(JSON.stringify({ msg: "hunter_enrichment_skipped", reason: "no_domain" }));
    return {
      contacts: [],
      traces: [{ provider: "hunter", domain: "", httpStatus: 0, rawHits: 0, kept: 0, error: "no_domain" }],
    };
  }

  const found: Omit<RapidIqContact, "opportunityId">[] = [];
  const traces: ContactProviderTrace[] = [];
  try {
    for (const domain of domains) {
      if (found.length >= MAX_CONTACTS) break;
      const batch = await hunterDomainSearch(apiKey, domain);
      traces.push(batch.trace);
      found.push(...batch.contacts);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : "unknown";
    console.log(JSON.stringify({ msg: "hunter_domain_search_failed", error }));
    traces.push({
      provider: "hunter",
      domain: domains[0] ?? "",
      httpStatus: 0,
      rawHits: 0,
      kept: 0,
      error,
    });
  }

  return { contacts: found.slice(0, MAX_CONTACTS), traces };
}

/** @deprecated use findContactsViaHunter — kept for existing imports during transition */
export async function enrichContactsWithHunter(
  input: ContactEnrichInput,
  existing: Omit<RapidIqContact, "opportunityId">[],
): Promise<Omit<RapidIqContact, "opportunityId">[]> {
  const found = await findContactsViaHunter(input);
  return mergeContacts(existing, found.contacts);
}

export {
  collectAgencyDomains as collectHunterDomains,
  extractDomainFromUrl,
  inferRoleTier,
  isPublicSafetyRelevantTitle,
} from "./contact-enrichment-shared.js";
export type { ContactEnrichInput as HunterEnrichInput } from "./contact-enrichment-shared.js";
