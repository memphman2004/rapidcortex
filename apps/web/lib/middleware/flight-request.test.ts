import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isNextFlightOrPrefetchRequest } from "./flight-request";

function req(url: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest(new URL(url, "https://app.rapidcortex.us"), { headers });
}

describe("isNextFlightOrPrefetchRequest (Next.js 16.2+)", () => {
  it("detects _rsc query param", () => {
    expect(
      isNextFlightOrPrefetchRequest(
        req("https://app.rapidcortex.us/rc-admin/dashboard?_rsc=abc"),
      ),
    ).toBe(true);
  });

  it("detects Accept: text/x-component", () => {
    expect(
      isNextFlightOrPrefetchRequest(
        req("https://app.rapidcortex.us/rc-admin/dashboard", {
          Accept: "text/x-component",
        }),
      ),
    ).toBe(true);
  });

  it("detects Purpose: prefetch", () => {
    expect(
      isNextFlightOrPrefetchRequest(
        req("https://app.rapidcortex.us/rc-admin/dashboard", {
          Purpose: "prefetch",
        }),
      ),
    ).toBe(true);
  });

  it("does not treat stripped Flight headers as signals (Next 16 adapter removes them)", () => {
    expect(
      isNextFlightOrPrefetchRequest(
        req("https://app.rapidcortex.us/rc-admin/dashboard", {
          rsc: "1",
          "next-router-state-tree": '["",{"children":["rc-admin",{"children":["dashboard",{}]}]}]',
          "next-router-prefetch": "1",
          RSC: "1",
          "Next-Router-Prefetch": "1",
          "Next-Router-State-Tree": "x",
        }),
      ),
    ).toBe(false);
  });

  it("returns false for normal document navigation", () => {
    expect(
      isNextFlightOrPrefetchRequest(
        req("https://app.rapidcortex.us/rc-admin/dashboard", {
          Accept: "text/html,application/xhtml+xml",
        }),
      ),
    ).toBe(false);
  });
});
