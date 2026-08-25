import { describe, expect, it } from "vitest";
import { extractReadableText } from "./refresh-conference.js";

describe("extractReadableText", () => {
  it("strips scripts, nav, and tags into readable text", () => {
    const html = `
      <html><head><script>alert(1)</script><style>.x{}</style></head>
      <body>
        <nav>Home About</nav>
        <h1>APCO 2026</h1>
        <p>August 16–19, 2026 &nbsp; Orlando, FL</p>
        <footer>Copyright</footer>
      </body></html>
    `;
    const text = extractReadableText(html);
    expect(text).toContain("APCO 2026");
    expect(text).toContain("August 16–19, 2026");
    expect(text).toContain("Orlando, FL");
    expect(text).not.toContain("alert(1)");
    expect(text).not.toContain("Home About");
    expect(text).not.toContain("Copyright");
  });
});
