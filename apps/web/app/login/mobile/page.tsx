import { parseLoginSearchParams } from "@/lib/auth/login-query";
import { MobileLoginClient } from "../mobile-login-client";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function MobileLoginPage({ searchParams }: Props) {
  const loginQuery = parseLoginSearchParams(searchParams ? await searchParams : undefined);
  return <MobileLoginClient from={loginQuery.from ?? undefined} error={loginQuery.error ?? undefined} />;
}
