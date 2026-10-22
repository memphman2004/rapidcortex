import { describe, expect, it } from "vitest";
import { htmlToArticleText, latestRssItem, scrubSalesBrand } from "./blog-article.js";

describe("blog article for email campaigns", () => {
  it("strips the old product name from outbound copy", () => {
    expect(scrubSalesBrand("— The Rapid Cortex team")).toBe("— The NexCort iQ team");
    expect(scrubSalesBrand("Inside the Cortex — 2026-10-19")).toBe("Inside iQ — 2026-10-19");
    expect(scrubSalesBrand("See rapidcortex.us")).toBe("See nexcortiq.us");
    expect(scrubSalesBrand("https://www.rapidcortex.us/blog")).toBe("https://www.nexcortiq.us/blog");
  });

  it("reads the newest post from the blog RSS feed", () => {
    const item = latestRssItem(`<?xml version="1.0"?>
      <rss><channel>
        <item><title>Fan safety</title><link>https://www.nexcortiq.us/blog/fan-safety</link></item>
        <item><title>Older</title><link>https://www.nexcortiq.us/blog/older</link></item>
      </channel></rss>`);
    expect(item).toEqual({ title: "Fan safety", url: "https://www.nexcortiq.us/blog/fan-safety" });
  });

  it("keeps the full article and drops the rest of the page", () => {
    const html = `<html><body>
      <p>Short nav</p>
      <h1>What Happens When a Fan Needs Security?</h1>
      <p>${"A".repeat(80)} Rapid Cortex helps venues.</p>
      <h2>Where the report gets stuck</h2>
      <li>A guest has no direct path to security.</li>
      <h2>Related reading</h2>
      <p>${"Z".repeat(80)}</p>
    </body></html>`;
    const text = htmlToArticleText(html);
    expect(text).toContain("What Happens When a Fan Needs Security?");
    expect(text).toContain("Where the report gets stuck");
    expect(text).toContain("A guest has no direct path to security.");
    expect(text).not.toContain("Related reading");
    expect(text).not.toContain("Z".repeat(40));
    expect(scrubSalesBrand(text)).not.toMatch(/rapid cortex/i);
    expect(scrubSalesBrand(text)).toContain("NexCort iQ helps venues.");
  });
});
