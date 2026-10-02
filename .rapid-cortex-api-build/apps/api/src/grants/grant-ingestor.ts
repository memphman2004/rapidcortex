/**
 * Daily grant ingestion — grants.gov (public) + SAM.gov (API key).
 * Classifies with Bedrock Haiku (or BEDROCK_MOCK=1 fixture).
 * Publishes new grant IDs to SNS for grant-matcher.
 * Every grant stores `verticals[]` for CRM isolation.
 */
import { createHash } from "node:crypto";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import type {
  GrantCategory,
  GrantRecord,
  GrantSource,
  LeadVertical,
  NcqTierMatch,
} from "rapid-cortex-shared";
import { verticalsFromGrantCategories } from "rapid-cortex-shared";
import { computeGrantId, GrantRepository } from "../repositories/grantRepository.js";

const bedrock = new BedrockRuntimeClient({});
const sns = new SNSClient({});
const secrets = new SecretsManagerClient({});
const repo = new GrantRepository();

type ClassifierResult = {
  relevanceScore: number;
  ncqTierMatch: NcqTierMatch;
  categories: GrantCategory[];
  eligibility: string[];
  reason: string;
};

type RawGrant = {
  opportunityId: string;
  source: GrantSource;
  title: string;
  agency: string;
  description: string;
  awardFloor: number;
  awardCeiling: number;
  postedDate?: string;
  closeDate?: string;
  sourceUrl?: string;
};

function classifierPrompt(g: RawGrant): string {
  return `You are classifying a government grant for relevance to a public safety AI software company
called NexCortiQ that sells AI-powered 911 dispatch software to emergency communications centers,
law enforcement, fire rescue, EMS, campus safety, venue security, hospital routing, and transit.
NexCortiQ pricing:
- Small City Pilot: $65K (aligns to COPS Tech / CDS grants)
- County Professional: $170K (aligns to state CJ + federal grants)
- Command Center: $390K (aligns to PSAP tech + state grants)
- Enterprise: $2M+ (aligns to statewide PSAP programs)

Grant title: ${g.title}
Grant description: ${g.description.slice(0, 4000)}
Award range: ${g.awardFloor} to ${g.awardCeiling}
Federal agency: ${g.agency}

Return JSON only:
{
  "relevanceScore": 0-100,
  "ncqTierMatch": "essential"|"professional"|"command"|"enterprise"|"none",
  "categories": ["911_technology"|"public_safety_software"|"first_responder"|"campus_safety"|"venue_security"|"hospital_routing"|"transit_ops"],
  "eligibility": ["state_government"|"local_government"|"psap"|"university"|"tribal"],
  "reason": "one sentence"
}`;
}

async function classifyGrant(g: RawGrant): Promise<ClassifierResult> {
  if (process.env.BEDROCK_MOCK === "1" || !process.env.BEDROCK_MODEL_ID) {
    const lower = `${g.title} ${g.description}`.toLowerCase();
    const categories: GrantCategory[] = [];
    if (/campus|university|school|clery/.test(lower)) categories.push("campus_safety");
    if (/venue|stadium|arena|concert/.test(lower)) categories.push("venue_security");
    if (/hospital|ems|trauma/.test(lower)) categories.push("hospital_routing");
    if (/transit|rail|bus|metro/.test(lower)) categories.push("transit_ops");
    if (/911|psap|dispatch|cad|public safety/.test(lower) || categories.length === 0) {
      categories.push("911_technology");
    }
    return {
      relevanceScore: 55,
      ncqTierMatch: "professional",
      categories,
      eligibility: ["local_government", "psap"],
      reason: "Mock classifier (BEDROCK_MOCK or model unset)",
    };
  }

  const modelId = process.env.BEDROCK_MODEL_ID;
  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 512,
    temperature: 0,
    messages: [{ role: "user", content: classifierPrompt(g) }],
  };
  const res = await bedrock.send(
    new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: Buffer.from(JSON.stringify(body)),
    }),
  );
  const raw = JSON.parse(new TextDecoder().decode(res.body)) as {
    content?: Array<{ text?: string }>;
  };
  const text = raw.content?.[0]?.text ?? "{}";
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as ClassifierResult;
  return {
    relevanceScore: Number(parsed.relevanceScore) || 0,
    ncqTierMatch: parsed.ncqTierMatch || "none",
    categories: Array.isArray(parsed.categories) ? parsed.categories : ["911_technology"],
    eligibility: Array.isArray(parsed.eligibility) ? parsed.eligibility : [],
    reason: parsed.reason || "",
  };
}

async function fetchGrantsGov(): Promise<RawGrant[]> {
  try {
    const res = await fetch("https://api.grants.gov/v1/api/search2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: "911 public safety dispatch emergency communications campus venue",
        oppStatuses: "forecasted|posted",
        rows: 50,
        startRecordNum: 0,
      }),
    });
    if (!res.ok) {
      console.warn(JSON.stringify({ msg: "grants_gov_http", status: res.status }));
      return [];
    }
    const data = (await res.json()) as {
      data?: { oppHits?: Array<Record<string, unknown>> };
    };
    const hits = data.data?.oppHits ?? [];
    return hits.map((h) => {
      const id = String(h.id ?? h.number ?? createHash("sha1").update(JSON.stringify(h)).digest("hex"));
      return {
        opportunityId: id,
        source: "grants.gov" as const,
        title: String(h.title ?? "Untitled"),
        agency: String(h.agencyName ?? h.agencyCode ?? "Unknown"),
        description: String(h.synopsis ?? h.description ?? ""),
        awardFloor: Number(h.awardFloor ?? 0) || 0,
        awardCeiling: Number(h.awardCeiling ?? 0) || 0,
        postedDate: h.openDate ? String(h.openDate) : undefined,
        closeDate: h.closeDate ? String(h.closeDate) : undefined,
        sourceUrl: `https://www.grants.gov/search-results-detail/${id}`,
      };
    });
  } catch (err) {
    console.error(JSON.stringify({ msg: "grants_gov_error", error: String(err) }));
    return [];
  }
}

async function resolveSamApiKey(): Promise<string | null> {
  const arn = process.env.SAM_GOV_API_KEY_SECRET_ARN?.trim();
  if (!arn) return process.env.SAM_GOV_API_KEY?.trim() || null;
  try {
    const out = await secrets.send(new GetSecretValueCommand({ SecretId: arn }));
    const raw = out.SecretString?.trim() ?? "";
    if (!raw) return null;
    try {
      const j = JSON.parse(raw) as { apiKey?: string };
      return j.apiKey?.trim() || raw;
    } catch {
      return raw;
    }
  } catch (err) {
    console.warn(JSON.stringify({ msg: "sam_key_resolve_failed", error: String(err) }));
    return null;
  }
}

async function fetchSamGov(): Promise<RawGrant[]> {
  const apiKey = await resolveSamApiKey();
  if (!apiKey) {
    console.warn(JSON.stringify({ msg: "sam_gov_skipped_no_key" }));
    return [];
  }
  try {
    const postedFrom = new Date(Date.now() - 14 * 86400000).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
    const url = new URL("https://api.sam.gov/opportunities/v2/search");
    url.searchParams.set("keywords", "emergency communications dispatch PSAP 911");
    url.searchParams.set("postedFrom", postedFrom);
    url.searchParams.set("limit", "50");
    url.searchParams.set("api_key", apiKey);
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn(JSON.stringify({ msg: "sam_gov_http", status: res.status }));
      return [];
    }
    const data = (await res.json()) as {
      opportunitiesData?: Array<Record<string, unknown>>;
    };
    return (data.opportunitiesData ?? []).map((o) => {
      const id = String(o.noticeId ?? o.solicitationNumber ?? createHash("sha1").update(JSON.stringify(o)).digest("hex"));
      return {
        opportunityId: id,
        source: "sam.gov" as const,
        title: String(o.title ?? "Untitled"),
        agency: String(o.fullParentPathName ?? o.department ?? "Unknown"),
        description: String(o.description ?? ""),
        awardFloor: 0,
        awardCeiling: Number(
          (o.award as { amount?: unknown } | undefined)?.amount ?? 0,
        ) || 0,
        postedDate: o.postedDate ? String(o.postedDate) : undefined,
        closeDate: o.responseDeadLine ? String(o.responseDeadLine) : undefined,
        sourceUrl: o.uiLink ? String(o.uiLink) : undefined,
      };
    });
  } catch (err) {
    console.error(JSON.stringify({ msg: "sam_gov_error", error: String(err) }));
    return [];
  }
}

export const handler = async (): Promise<{ newGrantIds: string[]; processed: number }> => {
  const day = new Date().toISOString().slice(0, 10);
  const grantsGov = await fetchGrantsGov();
  const samGov = await fetchSamGov();
  const all = [...grantsGov, ...samGov];
  const newGrantIds: string[] = [];
  let processed = 0;

  for (const raw of all) {
    try {
      const grantId = computeGrantId(raw.opportunityId, raw.source);
      const existing = await repo.getGrant(grantId);
      const classified = await classifyGrant(raw);
      const verticals: LeadVertical[] = verticalsFromGrantCategories(classified.categories);
      const now = new Date().toISOString();
      const record: GrantRecord = {
        grantId,
        opportunityId: raw.opportunityId,
        source: raw.source,
        title: raw.title,
        agency: raw.agency,
        description: raw.description,
        awardFloor: raw.awardFloor,
        awardCeiling: raw.awardCeiling,
        postedDate: raw.postedDate,
        closeDate: raw.closeDate,
        eligibility: classified.eligibility,
        categories: classified.categories,
        verticals,
        relevanceScore: classified.relevanceScore,
        ncqTierMatch: classified.ncqTierMatch,
        states: [],
        status: "active",
        sourceUrl: raw.sourceUrl,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await repo.putGrant(record);
      if (!existing) newGrantIds.push(grantId);
      processed += 1;
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "grant_ingest_item_error",
          opportunityId: raw.opportunityId,
          error: String(err),
        }),
      );
    }
  }

  await repo.putRun(day, "all", {
    totalFetched: all.length,
    newGrants: newGrantIds.length,
    updatedGrants: processed - newGrantIds.length,
  });

  const topicArn = process.env.GRANT_MATCH_TOPIC_ARN?.trim();
  if (topicArn && newGrantIds.length > 0) {
    await sns.send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify({ newGrantIds }),
      }),
    );
  }

  console.log(JSON.stringify({ msg: "grant_ingest_complete", processed, newGrantIds: newGrantIds.length }));
  return { newGrantIds, processed };
};
