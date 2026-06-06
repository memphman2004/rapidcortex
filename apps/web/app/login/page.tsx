import { parseLoginSearchParams } from "@/lib/auth/login-query";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";
import { LoginPageView } from "../[jurisdiction]/login/login-page-view";

/** Avoid CDN / static shell caching stale `signInConfigured` from older builds. */
export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: Props) {
  const raw = searchParams !== undefined ? await searchParams : undefined;
  const loginQuery = parseLoginSearchParams(raw);
  return <LoginPageView jurisdiction={defaultJurisdictionSlug()} loginQuery={loginQuery} />;
}
