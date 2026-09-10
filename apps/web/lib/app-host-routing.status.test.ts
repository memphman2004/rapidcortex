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

  it("keeps public Clery crime log on the app host", () => {
    expect(isMarketingPublicPath("/crime-log/uga")).toBe(false);
    expect(maybeRedirectAppHostAwayFromMarketing(appRequest("/crime-log/uga"))).toBeNull();
  });

  it("does not redirect app /status to www", () => {
    expect(maybeRedirectAppHostAwayFromMarketing(appRequest("/status"))).toBeNull();
  });

  it("keeps Call Assist SMS self-service on the app host", () => {
    expect(isMarketingPublicPath("/call-assist/report/tok")).toBe(false);
    expect(maybeRedirectAppHostAwayFromMarketing(appRequest("/call-assist/report/tok"))).toBeNull();
  });

  it("keeps RC Translate officer deep links on the app host", () => {
    expect(isMarketingPublicPath("/translate/xlat_abc")).toBe(false);
    expect(maybeRedirectAppHostAwayFromMarketing(appRequest("/translate/xlat_abc"))).toBeNull();
  });

  it("still redirects true marketing paths to www", () => {
    const res = maybeRedirectAppHostAwayFromMarketing(appRequest("/about"));
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("www.rapidcortex.us/about");
  });
});
