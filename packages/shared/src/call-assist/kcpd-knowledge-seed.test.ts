import { describe, expect, it } from "vitest";
import { topKnowledgeHit } from "./knowledge-retrieval.js";
import { KCPD_KNOWLEDGE_SEED } from "./kcpd-tenant-seed.js";

describe("KCPD knowledge seed", () => {
  it("grounds hours and online reporting questions", () => {
    const articles = KCPD_KNOWLEDGE_SEED.map((a) => ({ ...a, enabled: true }));
    expect(topKnowledgeHit("what are your hours of operation", articles)?.articleId).toBe("hours");
    expect(topKnowledgeHit("can I file a report online", articles)?.articleId).toBe("online-reporting");
    expect(topKnowledgeHit("where is the impound for a towed vehicle", articles)?.articleId).toBe("towed");
  });

  it("does not invent unpublished fines", () => {
    const articles = KCPD_KNOWLEDGE_SEED.map((a) => ({ ...a, enabled: true }));
    expect(articles.some((a) => /\$\d/.test(a.body))).toBe(false);
  });
});
