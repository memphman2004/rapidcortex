import { describe, expect, it } from "vitest";
import { rankKnowledgeArticles, topKnowledgeHit } from "./knowledge-retrieval.js";

const ARTICLES = [
  {
    articleId: "hours",
    title: "Non-emergency hours",
    body: "The non-emergency line is open 24 hours. Records window is 8am to 5pm weekdays.",
    tags: ["hours", "records"],
    enabled: true,
  },
  {
    articleId: "towed",
    title: "Towed vehicles",
    body: "Impound lots are listed on the agency website. Bring photo ID to retrieve a vehicle.",
    tags: ["tow", "impound"],
    enabled: true,
  },
  {
    articleId: "off",
    title: "Disabled article",
    body: "Secret after-hours number 555-0100",
    enabled: false,
  },
];

describe("knowledge retrieval", () => {
  it("ranks enabled articles by token overlap", () => {
    const hits = rankKnowledgeArticles("what are your hours of operation", ARTICLES);
    expect(hits[0]?.articleId).toBe("hours");
    expect(hits[0]?.score).toBeGreaterThan(0.2);
  });

  it("ignores disabled articles so the model cannot ground on them", () => {
    const hit = topKnowledgeHit("555-0100", ARTICLES);
    expect(hit).toBeNull();
  });

  it("returns no hit when the query does not match the knowledge base", () => {
    expect(topKnowledgeHit("what is the fine for jaywalking", ARTICLES)).toBeNull();
  });
});
