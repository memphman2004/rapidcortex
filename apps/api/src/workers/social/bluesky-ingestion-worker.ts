/**
 * bluesky-ingestion-worker.ts
 * Polls Bluesky (AT Protocol) public posts for emergency-relevant signals.
 *
 * Bluesky API is free/public — no enterprise access required.
 * Rate limit: ~3,000 requests / 5 min — keep search term fan-out modest.
 *
 * Scheduled: every 2 minutes via EventBridge.
 * Twitter/X is intentionally excluded.
 *
 * When SOCIAL_BLUESKY_ENABLED=false or the public API is unreachable, this
 * worker no-ops (logs and continues) — BEDROCK_MOCK is honored inside
 * ingestSocialSignal classification.
 */

import { createHash } from "node:crypto";
import type { ScheduledHandler } from "aws-lambda";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  ddb,
  FeatureTables,
  SocialKeys,
  isFeaturesSuiteEnabled,
} from "../../feature-suite/tables.js";
import { ingestSocialSignal } from "../../feature-suite/training-predictive-safety.js";
import {
  isSocialBlueskyEnabled,
  resolveAgencySocialConfigs,
  type AgencySocialConfig,
} from "./agency-social-config.js";

const BSKY_SEARCH =
  "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts";

const EMERGENCY_SEARCH_TERMS = [
  "shooting",
  "shots fired",
  "fire",
  "accident",
  "crash",
  "flooding",
  "gas leak",
  "power outage",
  "emergency",
  "help needed",
  "trapped",
  "911",
  "first responders",
  "police",
  "ambulance",
  "fire truck",
] as const;

/** Cap terms per poll cycle to stay under Bluesky rate limits. */
const TERMS_PER_CYCLE = 4;

type BskyPost = {
  uri: string;
  cid?: string;
  author?: { handle?: string; did?: string };
  record?: { text?: string; createdAt?: string };
  indexedAt?: string;
};

type BskySearchResponse = {
  posts?: BskyPost[];
};

function hashSourceUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

function postSourceUrl(post: BskyPost): string | undefined {
  const handle = post.author?.handle?.trim();
  const rkey = post.uri?.split("/").pop();
  if (!handle || !rkey) return undefined;
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

function postMentionsJurisdiction(text: string, config: AgencySocialConfig): boolean {
  if (config.cityHints.length === 0) {
    // No hints configured — accept all emergency-term matches (agency ops must
    // set cityHints in SOCIAL_AGENCY_CONFIGS for production precision).
    return true;
  }
  const lower = text.toLowerCase();
  return config.cityHints.some((hint) => lower.includes(hint.toLowerCase()));
}

async function claimDedup(
  agencyId: string,
  sourceUrl: string,
): Promise<boolean> {
  const key = SocialKeys.sourceDedup(agencyId, "bluesky", hashSourceUrl(sourceUrl));
  try {
    await ddb.send(
      new PutCommand({
        TableName: FeatureTables.social(),
        Item: {
          ...key,
          agencyId,
          sourceUrl,
          createdAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 172800,
        },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
    return true;
  } catch (err) {
    if ((err as { name?: string })?.name === "ConditionalCheckFailedException") {
      return false;
    }
    throw err;
  }
}

async function loadLastPolledAt(agencyId: string): Promise<string | undefined> {
  const res = await ddb.send(
    new GetCommand({
      TableName: FeatureTables.social(),
      Key: SocialKeys.blueskyMeta(agencyId),
    }),
  );
  const item = res.Item as { lastPolledAt?: string } | undefined;
  return item?.lastPolledAt;
}

async function saveLastPolledAt(agencyId: string, lastPolledAt: string): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.social(),
      Key: SocialKeys.blueskyMeta(agencyId),
      UpdateExpression: "SET agencyId = :a, lastPolledAt = :t, updatedAt = :t",
      ExpressionAttributeValues: {
        ":a": agencyId,
        ":t": lastPolledAt,
      },
    }),
  );
}

async function searchBluesky(term: string): Promise<BskyPost[]> {
  const url = new URL(BSKY_SEARCH);
  url.searchParams.set("q", term);
  url.searchParams.set("limit", "25");
  url.searchParams.set("sort", "latest");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn("[bluesky] search HTTP", res.status, term);
      return [];
    }
    const body = (await res.json()) as BskySearchResponse;
    return Array.isArray(body.posts) ? body.posts : [];
  } catch (err) {
    console.warn("[bluesky] search failed (no-op cycle)", term, err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function termsForThisCycle(): string[] {
  // Rotate term window by minute-of-day so every term is covered over time.
  const slot = Math.floor(Date.now() / 120_000) % Math.ceil(EMERGENCY_SEARCH_TERMS.length / TERMS_PER_CYCLE);
  const start = slot * TERMS_PER_CYCLE;
  return EMERGENCY_SEARCH_TERMS.slice(start, start + TERMS_PER_CYCLE) as string[];
}

async function ingestForAgency(config: AgencySocialConfig): Promise<number> {
  if (config.blueskyEnabled === false) return 0;

  const lastPolledAt = await loadLastPolledAt(config.agencyId);
  const terms = termsForThisCycle();
  let ingested = 0;

  for (const term of terms) {
    const posts = await searchBluesky(term);
    for (const post of posts) {
      const text = post.record?.text?.trim();
      if (!text) continue;

      const createdAt = post.record?.createdAt ?? post.indexedAt;
      if (lastPolledAt && createdAt && createdAt <= lastPolledAt) continue;
      if (!postMentionsJurisdiction(text, config)) continue;

      const sourceUrl = postSourceUrl(post);
      if (!sourceUrl) continue;

      const claimed = await claimDedup(config.agencyId, sourceUrl);
      if (!claimed) continue;

      try {
        const result = await ingestSocialSignal({
          agencyId: config.agencyId,
          actorId: "system:bluesky-ingestion",
          source: "bluesky",
          rawText: text.slice(0, 8000),
          sourceUrl,
        });
        if (result.signalId) ingested += 1;
      } catch (err) {
        console.warn("[bluesky] ingestSocialSignal failed", config.agencyId, err);
      }
    }
  }

  await saveLastPolledAt(config.agencyId, new Date().toISOString());
  return ingested;
}

export const handler: ScheduledHandler = async () => {
  if (!isFeaturesSuiteEnabled()) {
    console.info("[bluesky] features suite disabled — skipping");
    return;
  }
  if (!isSocialBlueskyEnabled()) {
    console.info("[bluesky] SOCIAL_BLUESKY_ENABLED off — skipping");
    return;
  }

  const configs = resolveAgencySocialConfigs();
  if (configs.length === 0) {
    console.warn("[bluesky] no agencies configured (ACTIVE_AGENCY_IDS / SOCIAL_AGENCY_CONFIGS)");
    return;
  }

  let total = 0;
  for (const config of configs) {
    try {
      total += await ingestForAgency(config);
    } catch (err) {
      console.warn("[bluesky] agency cycle failed", config.agencyId, err);
    }
  }
  console.info("[bluesky] poll complete", { agencies: configs.length, ingested: total });
};
