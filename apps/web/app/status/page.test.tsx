import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import StatusPage from "@/app/status/page";

describe("/status page", () => {
  it("renders publicly without auth gate copy", () => {
    const html = renderToStaticMarkup(<StatusPage />);
    expect(html).toContain("RAPID CORTEX STATUS");
    expect(html).toContain("System Status");
    expect(html).toContain("Public operational status for Rapid Cortex services.");
    expect(html).toContain("No active incidents.");
    expect(html).toContain("No incidents reported in the past 90 days.");
    expect(html.toLowerCase()).toContain("last status refresh:");
    expect(html.toLowerCase()).toContain("current utc time:");
    expect(html).toContain("Core Services");
    expect(html).toContain("Operational Console");
    expect(html).toMatch(/Field (&amp;|&) Caller Workflows/);
    expect(html).toContain("Integrations");
    expect(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC/.test(html)).toBe(true);
  });

  it("does not expose sensitive implementation markers in markup", () => {
    const html = renderToStaticMarkup(<StatusPage />);
    expect(html).not.toMatch(/arn:aws:ssm/i);
    expect(html).not.toMatch(/cloudwatch/i);
    expect(html).not.toMatch(/cognito/i);
    expect(html).not.toMatch(/NEXT_PUBLIC_/i);
    expect(html).not.toMatch(/process\.env/i);
  });
});
