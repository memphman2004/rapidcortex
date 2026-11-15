/**
 * Read-only Google Search Console + GA4 client for Marketing Dashboard SEO metrics.
 * Uses the marketing service-account secret (never Translate/multilingual SA).
 * Does not create properties/streams or call the Indexing API.
 */
import { JWT } from "google-auth-library";
import {
  MARKETING_GA4_SECRET_NAME,
  MARKETING_GA_MEASUREMENT_ID,
  MARKETING_GSC_SITE_URL,
  MARKETING_GTM_ID,
  MARKETING_LEAD_EVENT_NAMES,
  MARKETING_MONITORED_SEARCH_QUERIES,
  MARKETING_WEBSITE_ORIGIN,
  type MarketingSeoMetricsData,
  type MarketingSeoPageRow,
  type MarketingSeoQueryRow,
  type MarketingSeoSourceStatus,
} from "rapid-cortex-shared";
import { getSecret } from "../runtimeSecrets.js";

const GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"] as const;
const GA_SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"] as const;

type Ga4Secret = {
  type?: string;
  project_id?: string;
  private_key?: string;
  client_email?: string;
  client_id?: string;
  gsc_site_url?: string;
  ga_measurement_id?: string;
  ga4_property_id?: string;
  gtm_id?: string;
  website?: string;
};

type SearchAnalyticsRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(end.getUTCDate() - days);
  return { startDate: ymd(start), endDate: ymd(end) };
}

function asQueryRow(r: SearchAnalyticsRow): MarketingSeoQueryRow {
  return {
    query: String(r.keys?.[0] ?? ""),
    clicks: Number(r.clicks ?? 0),
    impressions: Number(r.impressions ?? 0),
    ctr: Number(r.ctr ?? 0),
    position: Number(r.position ?? 0),
  };
}

function asPageRow(r: SearchAnalyticsRow): MarketingSeoPageRow {
  return {
    page: String(r.keys?.[0] ?? ""),
    clicks: Number(r.clicks ?? 0),
    impressions: Number(r.impressions ?? 0),
    ctr: Number(r.ctr ?? 0),
    position: Number(r.position ?? 0),
  };
}

async function loadSecret(): Promise<Ga4Secret | null> {
  if (process.env.MARKETING_GA4_MOCK === "1") {
    return {
      client_email: "mock@rapidcortex-prod.iam.gserviceaccount.com",
      ga_measurement_id: MARKETING_GA_MEASUREMENT_ID,
      gsc_site_url: MARKETING_GSC_SITE_URL,
      ga4_property_id: process.env.MARKETING_GA4_PROPERTY_ID?.trim() || undefined,
    };
  }
  const name =
    process.env.MARKETING_GA4_SECRET_NAME?.trim() ||
    process.env.MARKETING_GA4_SECRET_ARN?.trim() ||
    MARKETING_GA4_SECRET_NAME;
  try {
    return await getSecret<Ga4Secret>(name);
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "ResourceNotFoundException") return null;
    throw err;
  }
}

function jwtFromSecret(secret: Ga4Secret, scopes: readonly string[]): JWT | null {
  const email = secret.client_email?.trim();
  const key = secret.private_key?.trim();
  if (!email || !key) return null;
  return new JWT({ email, key, scopes: [...scopes] });
}

async function googleFetch<T>(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: body.slice(0, 800) };
  try {
    return { ok: true, data: (body ? JSON.parse(body) : {}) as T };
  } catch {
    return { ok: false, status: res.status, body: "Invalid JSON from Google API" };
  }
}

function authRequiredMessage(email: string | undefined): string[] {
  const sa = email ?? "nexcortiq-gsc-ga4@rapidcortex-prod.iam.gserviceaccount.com";
  return [
    `Search Console → Users and permissions → add ${sa} (Full or Restricted)`,
    `GA4 Admin → Property access management → add ${sa} (Viewer)`,
    "Do not create a second GA4 property or web data stream for nexcortiq.us",
    "Do not use the Indexing API for ordinary product pages",
  ];
}

function classifyGoogleError(status: number, body: string): MarketingSeoSourceStatus {
  if (status === 403 || status === 401) return "authorization_required";
  if (status === 404) return "misconfigured";
  if (body.toLowerCase().includes("permission") || body.toLowerCase().includes("forbidden")) {
    return "authorization_required";
  }
  return "error";
}

async function discoverGa4PropertyId(
  accessToken: string,
  measurementId: string,
): Promise<string | undefined> {
  const summaries = await googleFetch<{
    accountSummaries?: Array<{
      propertySummaries?: Array<{ property?: string; displayName?: string }>;
    }>;
  }>(accessToken, "https://analyticsadmin.googleapis.com/v1beta/accountSummaries");
  if (!summaries.ok) return undefined;

  const propertyIds: string[] = [];
  for (const acct of summaries.data.accountSummaries ?? []) {
    for (const p of acct.propertySummaries ?? []) {
      const id = (p.property ?? "").replace(/^properties\//, "");
      if (id) propertyIds.push(id);
    }
  }

  for (const id of propertyIds) {
    const streams = await googleFetch<{
      dataStreams?: Array<{
        name?: string;
        webStreamData?: { measurementId?: string; defaultUri?: string };
      }>;
    }>(
      accessToken,
      `https://analyticsadmin.googleapis.com/v1beta/properties/${id}/dataStreams`,
    );
    if (!streams.ok) continue;
    for (const s of streams.data.dataStreams ?? []) {
      if (s.webStreamData?.measurementId === measurementId) return id;
    }
  }
  return propertyIds[0];
}

async function fetchSearchConsole(
  accessToken: string,
  siteUrl: string,
  days: number,
): Promise<NonNullable<MarketingSeoMetricsData["search"]>> {
  const now = new Date().toISOString();
  const { startDate, endDate } = dateRange(days);

  const sites = await googleFetch<{ siteEntry?: Array<{ siteUrl?: string }> }>(
    accessToken,
    "https://www.googleapis.com/webmasters/v3/sites",
  );
  if (!sites.ok) {
    return {
      status: classifyGoogleError(sites.status, sites.body),
      error: `sites.list ${sites.status}: ${sites.body}`,
      rangeDays: days,
      topQueries: [],
      monitoredQueries: [],
      lowCtrPages: [],
      sitemaps: [],
    };
  }
  const known = (sites.data.siteEntry ?? []).map((s) => s.siteUrl ?? "");
  if (known.length === 0) {
    return {
      status: "authorization_required",
      error: "Service account has no Search Console properties (grant access in GSC UI)",
      lastSyncAt: now,
      rangeDays: days,
      topQueries: [],
      monitoredQueries: [],
      lowCtrPages: [],
      sitemaps: [],
    };
  }

  const resolvedSite =
    known.find((u) => u === siteUrl) ??
    known.find((u) => u.includes("nexcortiq.us")) ??
    known[0]!;

  async function query(dimensions: string[], rowLimit: number, dimensionFilterGroups?: unknown) {
    return googleFetch<{ rows?: SearchAnalyticsRow[] }>(
      accessToken,
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(resolvedSite)}/searchAnalytics/query`,
      {
        method: "POST",
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions,
          rowLimit,
          ...(dimensionFilterGroups ? { dimensionFilterGroups } : {}),
        }),
      },
    );
  }

  const resolvedEncoded = encodeURIComponent(resolvedSite);
  const [totalsRes, queriesRes, pagesRes, sitemapsRes, monitoredRes] = await Promise.all([
    query([], 1),
    query(["query"], 25),
    query(["page"], 50),
    googleFetch<{ sitemap?: Array<Record<string, unknown>> }>(
      accessToken,
      `https://www.googleapis.com/webmasters/v3/sites/${resolvedEncoded}/sitemaps`,
    ),
    query(["query"], 50, [
      {
        filters: MARKETING_MONITORED_SEARCH_QUERIES.map((q) => ({
          dimension: "query",
          operator: "equals",
          expression: q,
        })),
        groupType: "or",
      },
    ]),
  ]);

  if (!totalsRes.ok) {
    return {
      status: classifyGoogleError(totalsRes.status, totalsRes.body),
      error: `searchAnalytics ${totalsRes.status}: ${totalsRes.body}`,
      lastSyncAt: now,
      rangeDays: days,
      topQueries: [],
      monitoredQueries: [],
      lowCtrPages: [],
      sitemaps: [],
    };
  }

  const totalRow = totalsRes.data.rows?.[0];
  const topQueries = (queriesRes.ok ? queriesRes.data.rows ?? [] : []).map(asQueryRow);
  const monitoredQueries = (monitoredRes.ok ? monitoredRes.data.rows ?? [] : []).map(asQueryRow);
  const pages = (pagesRes.ok ? pagesRes.data.rows ?? [] : []).map(asPageRow);
  const lowCtrPages = pages
    .filter((p) => p.impressions >= 20 && p.ctr < 0.02)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15);

  const sitemaps =
    sitemapsRes.ok
      ? (sitemapsRes.data.sitemap ?? []).map((s) => ({
          path: String(s.path ?? ""),
          lastSubmitted: typeof s.lastSubmitted === "string" ? s.lastSubmitted : undefined,
          isPending: Boolean(s.isPending),
          errors: typeof s.errors === "string" || typeof s.errors === "number" ? Number(s.errors) : undefined,
        }))
      : [];

  return {
    status: "ok",
    lastSyncAt: now,
    rangeDays: days,
    totals: {
      clicks: Number(totalRow?.clicks ?? 0),
      impressions: Number(totalRow?.impressions ?? 0),
      ctr: Number(totalRow?.ctr ?? 0),
      position: Number(totalRow?.position ?? 0),
    },
    topQueries,
    monitoredQueries,
    lowCtrPages,
    sitemaps,
  };
}

async function fetchGa4(
  accessToken: string,
  propertyId: string,
  days: number,
): Promise<NonNullable<MarketingSeoMetricsData["analytics"]>> {
  const now = new Date().toISOString();
  const { startDate, endDate } = dateRange(days);
  const base = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}`;

  const [summary, landings, referrals, events, streams] = await Promise.all([
    googleFetch<{ rows?: Array<{ metricValues?: Array<{ value?: string }> }> }>(
      accessToken,
      `${base}:runReport`,
      {
        method: "POST",
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        }),
      },
    ),
    googleFetch<{
      rows?: Array<{
        dimensionValues?: Array<{ value?: string }>;
        metricValues?: Array<{ value?: string }>;
      }>;
    }>(accessToken, `${base}:runReport`, {
      method: "POST",
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 15,
      }),
    }),
    googleFetch<{
      rows?: Array<{
        dimensionValues?: Array<{ value?: string }>;
        metricValues?: Array<{ value?: string }>;
      }>;
    }>(accessToken, `${base}:runReport`, {
      method: "POST",
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionSource" }],
        metrics: [{ name: "sessions" }],
        dimensionFilter: {
          filter: {
            fieldName: "sessionSource",
            stringFilter: { matchType: "PARTIAL", value: "chat", caseSensitive: false },
          },
        },
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 20,
      }),
    }),
    googleFetch<{
      rows?: Array<{
        dimensionValues?: Array<{ value?: string }>;
        metricValues?: Array<{ value?: string }>;
      }>;
    }>(accessToken, `${base}:runReport`, {
      method: "POST",
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: { values: [...MARKETING_LEAD_EVENT_NAMES] },
          },
        },
        limit: 20,
      }),
    }),
    googleFetch<{
      dataStreams?: Array<{
        displayName?: string;
        name?: string;
        webStreamData?: { measurementId?: string; defaultUri?: string };
      }>;
    }>(
      accessToken,
      `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/dataStreams`,
    ),
  ]);

  if (!summary.ok) {
    return {
      status: classifyGoogleError(summary.status, summary.body),
      error: `runReport ${summary.status}: ${summary.body}`,
      lastSyncAt: now,
      rangeDays: days,
      landingPages: [],
      aiReferrals: [],
      leadEvents: [],
      keyEventsConfigured: [],
      streams: [],
    };
  }

  const metric = summary.data.rows?.[0]?.metricValues ?? [];
  const landingPages = (landings.ok ? landings.data.rows ?? [] : []).map((r) => ({
    pagePath: String(r.dimensionValues?.[0]?.value ?? ""),
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    users: Number(r.metricValues?.[1]?.value ?? 0),
  }));

  // Broader AI referral pull: chatgpt / perplexity / claude / gemini / bing / copilot
  let aiReferrals = (referrals.ok ? referrals.data.rows ?? [] : []).map((r) => ({
    source: String(r.dimensionValues?.[0]?.value ?? ""),
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
  }));
  if (aiReferrals.length === 0 && referrals.ok) {
    const broad = await googleFetch<{
      rows?: Array<{
        dimensionValues?: Array<{ value?: string }>;
        metricValues?: Array<{ value?: string }>;
      }>;
    }>(accessToken, `${base}:runReport`, {
      method: "POST",
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionSource" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 50,
      }),
    });
    if (broad.ok) {
      const aiHints = /chatgpt|openai|perplexity|claude|anthropic|gemini|copilot|bing\.com\/chat|you\.com|phind/i;
      aiReferrals = (broad.data.rows ?? [])
        .map((r) => ({
          source: String(r.dimensionValues?.[0]?.value ?? ""),
          sessions: Number(r.metricValues?.[0]?.value ?? 0),
        }))
        .filter((r) => aiHints.test(r.source));
    }
  }

  const leadEvents = (events.ok ? events.data.rows ?? [] : []).map((r) => ({
    eventName: String(r.dimensionValues?.[0]?.value ?? ""),
    eventCount: Number(r.metricValues?.[0]?.value ?? 0),
  }));

  const streamList =
    streams.ok
      ? (streams.data.dataStreams ?? []).map((s) => ({
          name: String(s.displayName ?? s.name ?? ""),
          measurementId: s.webStreamData?.measurementId,
          defaultUri: s.webStreamData?.defaultUri,
        }))
      : [];

  return {
    status: "ok",
    lastSyncAt: now,
    rangeDays: days,
    sessions: Number(metric[0]?.value ?? 0),
    users: Number(metric[1]?.value ?? 0),
    landingPages,
    aiReferrals,
    leadEvents,
    keyEventsConfigured: [],
    streams: streamList,
  };
}

export type FetchMarketingSeoMetricsInput = {
  rangeDays?: number;
  crm?: MarketingSeoMetricsData["crm"];
};

/**
 * Aggregate GSC + GA4 read-only metrics. Never mutates Google configuration.
 */
export async function fetchMarketingSeoMetrics(
  input: FetchMarketingSeoMetricsInput = {},
): Promise<MarketingSeoMetricsData> {
  const days = Math.min(Math.max(input.rangeDays ?? 90, 1), 90);
  const syncedAt = new Date().toISOString();

  if (process.env.MARKETING_GA4_MOCK === "1") {
    return {
      syncedAt,
      website: MARKETING_WEBSITE_ORIGIN,
      measurementId: MARKETING_GA_MEASUREMENT_ID,
      gtmId: MARKETING_GTM_ID,
      gscSiteUrl: MARKETING_GSC_SITE_URL,
      search: {
        status: "mock",
        lastSyncAt: syncedAt,
        rangeDays: days,
        totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        topQueries: [],
        monitoredQueries: [],
        lowCtrPages: [],
        sitemaps: [],
      },
      analytics: {
        status: "mock",
        lastSyncAt: syncedAt,
        rangeDays: days,
        sessions: 0,
        users: 0,
        landingPages: [],
        aiReferrals: [],
        leadEvents: [],
        keyEventsConfigured: [],
        streams: [],
      },
      crm: input.crm,
      authorization: {
        serviceAccountEmail: "mock@rapidcortex-prod.iam.gserviceaccount.com",
        requiredGrants: [],
      },
    };
  }

  const secret = await loadSecret();
  if (!secret) {
    return {
      syncedAt,
      website: MARKETING_WEBSITE_ORIGIN,
      measurementId: MARKETING_GA_MEASUREMENT_ID,
      gtmId: MARKETING_GTM_ID,
      search: {
        status: "secret_missing",
        error: `Secret ${MARKETING_GA4_SECRET_NAME} not found`,
        rangeDays: days,
        topQueries: [],
        monitoredQueries: [],
        lowCtrPages: [],
        sitemaps: [],
      },
      analytics: {
        status: "secret_missing",
        error: `Secret ${MARKETING_GA4_SECRET_NAME} not found`,
        rangeDays: days,
        landingPages: [],
        aiReferrals: [],
        leadEvents: [],
        keyEventsConfigured: [],
        streams: [],
      },
      crm: input.crm,
      authorization: {
        requiredGrants: authRequiredMessage(undefined),
      },
    };
  }

  const measurementId = secret.ga_measurement_id?.trim() || MARKETING_GA_MEASUREMENT_ID;
  const gtmId = secret.gtm_id?.trim() || MARKETING_GTM_ID;
  const website = secret.website?.trim() || MARKETING_WEBSITE_ORIGIN;
  const gscSiteUrl = secret.gsc_site_url?.trim() || MARKETING_GSC_SITE_URL;
  const saEmail = secret.client_email?.trim();

  const gscJwt = jwtFromSecret(secret, GSC_SCOPES);
  const gaJwt = jwtFromSecret(secret, GA_SCOPES);

  let search: MarketingSeoMetricsData["search"];
  let analytics: MarketingSeoMetricsData["analytics"];
  let ga4PropertyId = secret.ga4_property_id?.trim() || process.env.MARKETING_GA4_PROPERTY_ID?.trim();

  if (!gscJwt || !gaJwt) {
    const mis = {
      status: "misconfigured" as const,
      error: "Service account JSON missing client_email or private_key",
      rangeDays: days,
    };
    search = { ...mis, topQueries: [], monitoredQueries: [], lowCtrPages: [], sitemaps: [] };
    analytics = {
      ...mis,
      landingPages: [],
      aiReferrals: [],
      leadEvents: [],
      keyEventsConfigured: [],
      streams: [],
    };
  } else {
    const [gscTok, gaTok] = await Promise.all([gscJwt.getAccessToken(), gaJwt.getAccessToken()]);
    const gscAccess = gscTok.token;
    const gaAccess = gaTok.token;

    if (gscAccess) {
      search = await fetchSearchConsole(gscAccess, gscSiteUrl, days);
    } else {
      search = {
        status: "error",
        error: "Failed to obtain GSC access token",
        rangeDays: days,
        topQueries: [],
        monitoredQueries: [],
        lowCtrPages: [],
        sitemaps: [],
      };
    }

    if (gaAccess) {
      if (!ga4PropertyId) {
        ga4PropertyId = await discoverGa4PropertyId(gaAccess, measurementId);
      }
      if (!ga4PropertyId) {
        analytics = {
          status: "authorization_required",
          error:
            "No GA4 properties visible to service account — grant Viewer on the property for G-NGT17QK1LW",
          rangeDays: days,
          landingPages: [],
          aiReferrals: [],
          leadEvents: [],
          keyEventsConfigured: [],
          streams: [],
        };
      } else {
        analytics = await fetchGa4(gaAccess, ga4PropertyId, days);
      }
    } else {
      analytics = {
        status: "error",
        error: "Failed to obtain GA4 access token",
        rangeDays: days,
        landingPages: [],
        aiReferrals: [],
        leadEvents: [],
        keyEventsConfigured: [],
        streams: [],
      };
    }
  }

  return {
    syncedAt,
    website,
    measurementId,
    gtmId,
    gscSiteUrl,
    ga4PropertyId,
    search,
    analytics,
    crm: input.crm,
    authorization: {
      serviceAccountEmail: saEmail,
      requiredGrants:
        search?.status === "authorization_required" ||
        analytics?.status === "authorization_required"
          ? authRequiredMessage(saEmail)
          : [],
    },
  };
}
