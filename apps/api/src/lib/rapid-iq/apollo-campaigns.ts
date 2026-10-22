/**
 * Read Apollo email sequences for the Email Campaign page.
 * Uses the same API key as contact search. Does not enroll or send.
 */
import type { RapidIqApolloCampaign, RapidIqApolloCampaignRead } from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";

const APOLLO_BASE = "https://api.apollo.io/api/v1";
const MAX_PAGES = 5;

type ApolloCampaignRaw = {
  id?: unknown;
  name?: unknown;
  active?: unknown;
  archived?: unknown;
  num_steps?: unknown;
  unique_scheduled?: unknown;
  unique_delivered?: unknown;
  unique_opened?: unknown;
  unique_replied?: unknown;
  unique_clicked?: unknown;
};

function count(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function mapApolloEmailerCampaign(raw: ApolloCampaignRaw): RapidIqApolloCampaign | null {
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) return null;
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Untitled sequence";
  return {
    id,
    name,
    active: raw.active === true,
    archived: raw.archived === true,
    steps: count(raw.num_steps),
    scheduled: count(raw.unique_scheduled),
    delivered: count(raw.unique_delivered),
    opened: count(raw.unique_opened),
    replied: count(raw.unique_replied),
    clicked: count(raw.unique_clicked),
  };
}

async function resolveApolloApiKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.RAPID_IQ_APOLLO_API_KEY,
    process.env.RAPID_IQ_APOLLO_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
}

function disconnected(error: string): RapidIqApolloCampaignRead {
  return { connected: false, campaigns: [], error };
}

export async function listApolloEmailerCampaigns(): Promise<RapidIqApolloCampaignRead> {
  const apiKey = (await resolveApolloApiKey()).trim();
  if (!apiKey) return disconnected("Apollo API key is not configured");

  const campaigns: RapidIqApolloCampaignRead["campaigns"] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    let res: Response;
    try {
      res = await fetch(`${APOLLO_BASE}/emailer_campaigns/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({ page, per_page: 100 }),
      });
    } catch (err) {
      console.warn(
        JSON.stringify({
          msg: "apollo_campaigns_fetch_failed",
          error: err instanceof Error ? err.message : "fetch failed",
        }),
      );
      return disconnected("Could not reach Apollo");
    }

    const body = (await res.json().catch(() => ({}))) as {
      emailer_campaigns?: ApolloCampaignRaw[];
      pagination?: { total_pages?: number };
      error?: string;
    };

    if (res.status === 401 || res.status === 403) {
      return disconnected("Apollo rejected the API key");
    }
    if (!res.ok) {
      console.warn(
        JSON.stringify({
          msg: "apollo_campaigns_http_error",
          status: res.status,
        }),
      );
      return disconnected("Apollo sequence read failed");
    }

    for (const row of body.emailer_campaigns ?? []) {
      const mapped = mapApolloEmailerCampaign(row);
      if (mapped && !mapped.archived) campaigns.push(mapped);
    }
    const reported = body.pagination?.total_pages;
    totalPages = typeof reported === "number" && reported > 0 ? reported : page;
    page += 1;
  }

  campaigns.sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  return { connected: true, campaigns };
}
