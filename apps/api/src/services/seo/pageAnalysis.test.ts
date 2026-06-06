import { describe, expect, it } from "vitest";
import { analyzeHtml } from "./pageAnalysis.js";

describe("analyzeHtml", () => {
  it("extracts title, meta description, and first H1", () => {
    const html = `<!doctype html><html><head>
<title>Hello Page</title>
<meta name="description" content="Meta here" />
<link rel="canonical" href="https://example.com/a" />
<meta property="og:title" content="OG Title" />
<meta name="twitter:card" content="summary" />
</head><body>
<h1>Main heading</h1>
<h2>Sub</h2>
<p>Word content here repeated.</p>
</body></html>`;
    const a = analyzeHtml(html, "https://example.com/page");
    expect(a.title).toBe("Hello Page");
    expect(a.metaDescription).toBe("Meta here");
    expect(a.h1).toEqual(["Main heading"]);
    expect(a.canonicalHref).toBe("https://example.com/a");
    expect(a.openGraph["og:title"]).toBe("OG Title");
    expect(a.twitter["twitter:card"]).toBe("summary");
    expect(a.wordCount).toBeGreaterThan(2);
  });
});
