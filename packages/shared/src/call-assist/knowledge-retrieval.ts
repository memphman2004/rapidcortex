export type KnowledgeArticleLike = {
  articleId: string;
  title: string;
  body: string;
  tags?: string[];
  enabled?: boolean;
};

export type KnowledgeHit = {
  articleId: string;
  title: string;
  excerpt: string;
  score: number;
};

const STOP = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "what",
  "when",
  "where",
  "how",
  "do",
  "does",
  "i",
  "you",
  "we",
  "to",
  "of",
  "and",
  "or",
  "for",
  "in",
  "on",
  "at",
  "my",
  "me",
  "please",
  "need",
  "know",
  "tell",
  "about",
]);

export function tokenizeKnowledgeQuery(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function excerptAround(body: string, tokens: string[]): string {
  const lower = body.toLowerCase();
  let idx = 0;
  for (const t of tokens) {
    const found = lower.indexOf(t);
    if (found >= 0) {
      idx = found;
      break;
    }
  }
  const start = Math.max(0, idx - 80);
  const slice = body.slice(start, start + 280).trim();
  return slice.length < body.length ? `${start > 0 ? "…" : ""}${slice}…` : slice;
}

/**
 * Rank enabled agency knowledge articles against a caller utterance.
 * Deterministic token overlap — no LLM, no cross-tenant data.
 */
export function rankKnowledgeArticles(
  query: string,
  articles: KnowledgeArticleLike[],
  opts?: { minScore?: number; limit?: number },
): KnowledgeHit[] {
  const minScore = opts?.minScore ?? 0.22;
  const limit = opts?.limit ?? 3;
  const tokens = tokenizeKnowledgeQuery(query);
  if (tokens.length === 0) return [];

  const hits: KnowledgeHit[] = [];
  for (const article of articles) {
    if (article.enabled === false) continue;
    const hay = `${article.title} ${article.body} ${(article.tags ?? []).join(" ")}`.toLowerCase();
    let matched = 0;
    for (const t of tokens) {
      if (hay.includes(t)) matched += 1;
    }
    const score = matched / tokens.length;
    if (score < minScore) continue;
    hits.push({
      articleId: article.articleId,
      title: article.title,
      excerpt: excerptAround(article.body, tokens),
      score: Math.round(score * 1000) / 1000,
    });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function topKnowledgeHit(
  query: string,
  articles: KnowledgeArticleLike[],
): KnowledgeHit | null {
  return rankKnowledgeArticles(query, articles, { limit: 1 })[0] ?? null;
}
