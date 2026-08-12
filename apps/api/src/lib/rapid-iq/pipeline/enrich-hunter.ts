/**
 * Hunter.io contact enrichment — fallback when Apollo misses.
 * Domain search: 1 credit. Email finder: 1 credit per lookup.
 * canSpend() before every credit-costing API call.
 */

import { resolvePlainOrSecretArn } from "../../runtimeSecrets.js";
import { isCollectorsMockEnabled } from "../agenda-finder.js";
import { canSpend } from "./credit-guard.js";

const HUNTER_BASE = "https://api.hunter.io/v2";

export interface HunterContact {
  name: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  email: string;
  confidence: number;
  source: "hunter";
  creditsUsed: number;
}

interface HunterEmail {
  value: string;
  type?: string;
  confidence: number;
  first_name?: string;
  last_name?: string;
  position?: string;
  linkedin?: string;
  phone_number?: string;
}

interface HunterDomainResult {
  domain: string;
  pattern?: string;
  emails: HunterEmail[];
}

interface HunterFinderResult {
  email: string;
  score: number;
  first_name?: string;
  last_name?: string;
  position?: string;
}

const STATE_ABBREVIATIONS: Record<string, string> = {
  AL: "al",
  AK: "ak",
  AZ: "az",
  AR: "ar",
  CA: "ca",
  CO: "co",
  CT: "ct",
  DE: "de",
  FL: "fl",
  GA: "ga",
  HI: "hi",
  ID: "id",
  IL: "il",
  IN: "in",
  IA: "ia",
  KS: "ks",
  KY: "ky",
  LA: "la",
  ME: "me",
  MD: "md",
  MA: "ma",
  MI: "mi",
  MN: "mn",
  MS: "ms",
  MO: "mo",
  MT: "mt",
  NE: "ne",
  NV: "nv",
  NH: "nh",
  NJ: "nj",
  NM: "nm",
  NY: "ny",
  NC: "nc",
  ND: "nd",
  OH: "oh",
  OK: "ok",
  OR: "or",
  PA: "pa",
  RI: "ri",
  SC: "sc",
  SD: "sd",
  TN: "tn",
  TX: "tx",
  UT: "ut",
  VT: "vt",
  VA: "va",
  WA: "wa",
  WV: "wv",
  WI: "wi",
  WY: "wy",
};

const TARGET_ROLE_KEYWORDS = [
  "911",
  "dispatch",
  "emergency communications",
  "emergency services",
  "sheriff",
  "police chief",
  "chief of police",
  "it director",
  "information technology",
  "chief information",
  "emergency management",
  "communications director",
];

export function inferGovDomain(
  agencyName: string,
  jurisdiction?: string,
  state?: string,
): string[] {
  const candidates: string[] = [];
  const st = state
    ? (STATE_ABBREVIATIONS[state.toUpperCase()] ?? state.toLowerCase())
    : "";

  const base = (jurisdiction ?? agencyName)
    .toLowerCase()
    .replace(/county/gi, "county")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);

  if (base && st) {
    candidates.push(`${base}.${st}.gov`);
    candidates.push(`${base}county.${st}.gov`);
    candidates.push(`co.${base}.${st}.us`);
    candidates.push(`${base}co.${st}.gov`);
  }

  if (base) {
    candidates.push(`${base}.gov`);
  }

  return candidates;
}

function isTargetRole(position: string): boolean {
  const lower = position.toLowerCase();
  return TARGET_ROLE_KEYWORDS.some((kw) => lower.includes(kw));
}

async function resolveHunterApiKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.RAPID_IQ_HUNTER_API_KEY,
    process.env.RAPID_IQ_HUNTER_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
}

async function domainSearch(apiKey: string, domain: string): Promise<HunterDomainResult | null> {
  const params = new URLSearchParams({
    domain,
    api_key: apiKey,
    limit: "10",
    type: "personal",
  });

  const res = await fetch(`${HUNTER_BASE}/domain-search?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 404 || res.status === 422) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hunter domain search HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { data: HunterDomainResult };
  return data.data;
}

async function emailFinder(
  apiKey: string,
  domain: string,
  firstName: string,
  lastName: string,
): Promise<HunterFinderResult | null> {
  const params = new URLSearchParams({
    domain,
    first_name: firstName,
    last_name: lastName,
    api_key: apiKey,
  });

  const res = await fetch(`${HUNTER_BASE}/email-finder?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 404 || res.status === 422) return null;
  if (!res.ok) return null;

  const data = (await res.json()) as { data: HunterFinderResult };
  if (!data.data?.email) return null;
  return data.data;
}

/**
 * Find contacts via Hunter domain search + optional email finder.
 * maxCredits caps total credits this call may consume.
 */
export async function enrichViaHunter(
  agencyName: string,
  jurisdiction: string | undefined,
  state: string | undefined,
  nlpContactHints: Array<{ name: string; title?: string }>,
  maxCredits: number = 2,
): Promise<{ contacts: HunterContact[]; creditsUsed: number }> {
  if (isCollectorsMockEnabled()) {
    console.log(JSON.stringify({ msg: "hunter_pipeline_enrich_skipped", reason: "mock" }));
    return { contacts: [], creditsUsed: 0 };
  }

  const apiKey = await resolveHunterApiKey();
  if (!apiKey) {
    console.log(JSON.stringify({ msg: "hunter_pipeline_enrich_skipped", reason: "no_api_key" }));
    return { contacts: [], creditsUsed: 0 };
  }

  const domains = inferGovDomain(agencyName, jurisdiction, state);
  let creditsUsed = 0;
  const contacts: HunterContact[] = [];
  let successDomain: string | null = null;

  for (const domain of domains) {
    if (creditsUsed >= maxCredits) break;

    const check = await canSpend("hunter", 1);
    if (!check.allowed) break;

    try {
      const result = await domainSearch(apiKey, domain);
      if (!result || result.emails.length === 0) continue;

      creditsUsed += 1;
      successDomain = domain;

      const targetEmails = result.emails.filter((e) =>
        e.position ? isTargetRole(e.position) : false,
      );

      for (const email of targetEmails.slice(0, 2)) {
        contacts.push({
          name: [email.first_name, email.last_name].filter(Boolean).join(" ") || "Unknown",
          firstName: email.first_name,
          lastName: email.last_name,
          title: email.position,
          email: email.value,
          confidence: email.confidence,
          source: "hunter",
          creditsUsed: 0,
        });
      }

      break;
    } catch (err) {
      console.warn(
        JSON.stringify({
          msg: "hunter_domain_search_failed",
          domain,
          error: err instanceof Error ? err.message : "unknown",
        }),
      );
    }
  }

  if (successDomain && nlpContactHints.length > 0 && creditsUsed < maxCredits) {
    for (const hint of nlpContactHints.slice(0, 1)) {
      if (creditsUsed >= maxCredits) break;

      const nameParts = hint.name.trim().split(/\s+/);
      if (nameParts.length < 2) continue;

      const firstName = nameParts[0]!;
      const lastName = nameParts[nameParts.length - 1]!;

      const check = await canSpend("hunter", 1);
      if (!check.allowed) break;

      try {
        const found = await emailFinder(apiKey, successDomain, firstName, lastName);
        if (found?.email && found.score >= 70) {
          creditsUsed += 1;
          const alreadyFound = contacts.some((c) => c.email === found.email);
          if (!alreadyFound) {
            contacts.push({
              name: hint.name,
              firstName,
              lastName,
              title: hint.title ?? found.position,
              email: found.email,
              confidence: found.score,
              source: "hunter",
              creditsUsed: 1,
            });
          }
        }
      } catch (err) {
        console.warn(
          JSON.stringify({
            msg: "hunter_email_finder_failed",
            error: err instanceof Error ? err.message : "unknown",
          }),
        );
      }
    }
  }

  console.log(
    JSON.stringify({
      msg: "hunter_pipeline_enrich_ok",
      contacts: contacts.length,
      creditsUsed,
    }),
  );
  return { contacts, creditsUsed };
}
