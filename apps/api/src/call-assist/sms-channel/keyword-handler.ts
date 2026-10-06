import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { RESERVED_COMPLIANCE_KEYWORDS } from "./compliance.js";
import type { AgencyKeyword } from "./types.js";

const CACHE_TTL_MS = 300_000;

type KeywordCacheEntry = {
  fetchedAt: number;
  byKeyword: Map<string, AgencyKeyword>;
};

const keywordCache = new Map<string, KeywordCacheEntry>();

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function keywordTableName(): string | null {
  const name = process.env.KEYWORD_TABLE?.trim();
  return name || null;
}

async function loadAgencyKeywords(agencyId: string): Promise<Map<string, AgencyKeyword>> {
  const table = keywordTableName();
  if (!table) return new Map();

  const cached = keywordCache.get(agencyId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.byKeyword;
  }

  const byKeyword = new Map<string, AgencyKeyword>();
  let exclusiveStartKey: Record<string, unknown> | undefined;

  try {
    do {
      const page = await ddb.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          ExpressionAttributeValues: {
            ":pk": `AGENCY#${agencyId}`,
            ":sk": "KEYWORD#",
          },
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      for (const raw of page.Items ?? []) {
        const item = raw as AgencyKeyword;
        const key = (item.keyword ?? "").trim().toUpperCase();
        if (!key) continue;
        byKeyword.set(key, item);
      }
      exclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey);
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        event: "sms_keyword_query_failed",
        agencyId,
        name: err instanceof Error ? err.name : "Error",
      }),
    );
    return cached?.byKeyword ?? new Map();
  }

  keywordCache.set(agencyId, { fetchedAt: Date.now(), byKeyword });
  return byKeyword;
}

/**
 * Exact keyword match (trim + uppercase). Reserved compliance keywords never match.
 * Fail-open: Dynamo errors return null so Lex/compliance can still handle the message.
 */
export async function matchKeyword(
  messageBody: string,
  agencyId: string,
): Promise<string | null> {
  const normalized = messageBody.trim().toUpperCase();
  if (!normalized || !agencyId.trim()) return null;
  if (RESERVED_COMPLIANCE_KEYWORDS.has(normalized)) return null;

  try {
    const keywords = await loadAgencyKeywords(agencyId.trim());
    const hit = keywords.get(normalized);
    if (!hit || hit.isActive === false) return null;
    const response = hit.response?.trim();
    return response || null;
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        event: "sms_keyword_match_failed",
        agencyId,
        name: err instanceof Error ? err.name : "Error",
      }),
    );
    return null;
  }
}

/** Test helper — clears the in-memory keyword cache. */
export function clearKeywordCacheForTests(): void {
  keywordCache.clear();
}
