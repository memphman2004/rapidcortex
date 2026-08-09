import { describe, expect, it } from "vitest";
import {
  isMarketingPublicPath,
  maybeRedirectAppHostAwayFromMarketing,
} from "@/lib/app-host-routing";
import { NextRequest } from "next/server";

function appRequest(path: string): NextRequest {
  return new NextRequest(new URL(`https://app.rapidcortex.us${path}`), {
    headers: { host: "app.rapidcortex.us" },
  });
}

describe("app-host-routing — public status", () => {
  it("keeps /status on the app host (not marketing www)", () => {
    expect(isMarketingPublicPath("/status")).toBe(false);
    expect(isMarketingPublicPath("/status/agency-slug")).toBe(false);
  });

  it("does not redirect app /status to www", () => {
    expect(maybeRedirectAppHostAwayFromMarketing(appRequest("/status"))).toBeNull();
  });

  it("still redirects true marketing paths to www", () => {
    const res = maybeRedirectAppHostAwayFromMarketing(appRequest("/about"));
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("www.rapidcortex.us/about");
  });
});
