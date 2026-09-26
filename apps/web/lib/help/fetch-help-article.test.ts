import { describe, expect, it } from "vitest";
import { markdownToHtml } from "./fetch-help-article";

describe("markdownToHtml", () => {
  it("renders headings, numbered steps, and bullets as real lists", () => {
    const html = markdownToHtml(
      [
        "# Title",
        "",
        "Open **QR Codes** from the sidebar.",
        "",
        "## Steps",
        "",
        "1. Sign in.",
        "2. Select Deactivate.",
        "",
        "- Do not call this 911 Help",
        "- Keep the physical sign",
      ].join("\n"),
    );
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<h2>Steps</h2>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>Sign in.</li>");
    expect(html).toContain("<li>Select Deactivate.</li>");
    expect(html).toContain("</ol>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<strong>QR Codes</strong>");
    expect(html.match(/<ul>/g)?.length).toBe(1);
  });
});
