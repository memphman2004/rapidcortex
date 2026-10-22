import type { BusinessCardEventType, CardTheme } from "./types.js";

export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "c",
  "card",
  "revoked",
  "inactive",
  "public",
  "null",
]);

export const BUSINESS_CARD_ADMIN_ROLES = new Set([
  "agencyadmin",
  "agencyit",
  "rcadmin",
  "rcsuperadmin",
  "rcitadmin",
  "CAMPUS_ADMIN",
  "VENUE_ADMIN",
  "TRANSIT_ADMIN",
  "HOSPITAL_ADMIN",
  "CALL_ASSIST_ADMIN",
]);

/** Fields an employee can never change, even when an admin has not locked them. */
export const ALWAYS_LOCKED_FIELDS = ["companyName", "website", "primaryEmail"] as const;

export class BizCardError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BizCardError";
  }
}

export function isBusinessCardAdmin(role: string): boolean {
  return BUSINESS_CARD_ADMIN_ROLES.has(role.trim());
}

/**
 * Per-tenant config wins when it has an explicit boolean.
 * With no config row, the global flag applies. That flag defaults off.
 */
export function isBusinessCardsEnabled(
  globalEnabled: boolean,
  config: { enabled?: boolean } | null | undefined,
): boolean {
  if (config && typeof config.enabled === "boolean") return config.enabled;
  return globalEnabled;
}

export function slugifyName(first: string, last: string): string {
  const raw = `${first} ${last}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  const base = raw.length >= 3 ? raw : "card-user";
  if (RESERVED_SLUGS.has(base)) return `${base}-card`.slice(0, 60);
  return base;
}

export function assertSlug(slug: string): void {
  if (slug.length < 3 || slug.length > 60 || !/^[a-z0-9-]+$/.test(slug) || RESERVED_SLUGS.has(slug)) {
    throw new BizCardError(400, "invalid_slug", "Choose a public address using lowercase letters, numbers, and hyphens.");
  }
}

export function assertHttpsUrl(value: string, field: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BizCardError(400, "invalid_url", `${field} must be an https URL.`);
  }
  if (url.protocol === "javascript:" || url.protocol === "data:") {
    throw new BizCardError(400, "invalid_url", `${field} cannot use that URL scheme.`);
  }
  if (url.protocol !== "https:") {
    throw new BizCardError(400, "invalid_url", `${field} must start with https://.`);
  }
}

export function assertWebsite(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BizCardError(400, "invalid_url", "Website must be an http or https URL.");
  }
  if (url.protocol === "javascript:" || url.protocol === "data:") {
    throw new BizCardError(400, "invalid_url", "Website cannot use that URL scheme.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BizCardError(400, "invalid_url", "Website must be an http or https URL.");
  }
}

export function assertE164(value: string): void {
  if (!/^\+[1-9]\d{1,14}$/.test(value)) {
    throw new BizCardError(400, "invalid_phone", "Phone numbers must be in E.164 format, for example +14155552671.");
  }
}

export function monthKey(ms: number): string {
  const d = new Date(ms);
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${d.getUTCFullYear()}-${month}`;
}

export function auditTtlSeconds(occurredAtMs: number): number {
  return Math.floor(occurredAtMs / 1000) + 7 * 365 * 24 * 60 * 60;
}

export function counterAttribute(eventType: BusinessCardEventType): {
  field: "totalViews" | "totalVcfDownloads" | "totalCallClicks" | "totalEmailClicks" | "totalWebClicks";
  touchLastViewed: boolean;
} {
  switch (eventType) {
    case "page_view":
      return { field: "totalViews", touchLastViewed: true };
    case "vcf_download":
      return { field: "totalVcfDownloads", touchLastViewed: false };
    case "call_click":
      return { field: "totalCallClicks", touchLastViewed: false };
    case "email_click":
      return { field: "totalEmailClicks", touchLastViewed: false };
    case "web_click":
    case "linkedin_click":
    case "calendar_click":
    case "share_click":
      return { field: "totalWebClicks", touchLastViewed: false };
    default:
      return { field: "totalViews", touchLastViewed: false };
  }
}

export function isCardTheme(value: string): value is CardTheme {
  return value === "navy" || value === "gold" || value === "slate" || value === "midnight";
}

export function changedFieldNames(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changed.push(key);
  }
  return changed.sort();
}

const buckets = new Map<string, { count: number; reset: number }>();

/** Returns true when the caller has exceeded the per-minute limit. */
export function consumeRateLimit(key: string, limit: number, now = Date.now()): boolean {
  const current = buckets.get(key);
  if (!current || now >= current.reset) {
    buckets.set(key, { count: 1, reset: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}

export function resetRateLimits(): void {
  buckets.clear();
}
