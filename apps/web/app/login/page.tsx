import { headers } from "next/headers";
import { parseLoginSearchParams } from "@/lib/auth/login-query";
import { isMobileUserAgent, isTabletUserAgent } from "@/lib/device/isMobileRequest";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";
import { LoginPageView } from "../[jurisdiction]/login/login-page-view";
import { MobileLoginClient } from "./mobile-login-client";

/** Avoid CDN / static shell caching stale `signInConfigured` from older builds. */
export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: Props) {
  const raw = searchParams !== undefined ? await searchParams : undefined;
  const loginQuery = parseLoginSearchParams(raw);
  const ua = (await headers()).get("user-agent");
  if (isMobileUserAgent(ua) || isTabletUserAgent(ua)) {
    return <MobileLoginClient from={loginQuery.from ?? undefined} error={loginQuery.error ?? undefined} />;
  }
  return <LoginPageView jurisdiction={defaultJurisdictionSlug()} loginQuery={loginQuery} />;
}
