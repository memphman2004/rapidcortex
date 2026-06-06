import { parseLoginSearchParams } from "@/lib/auth/login-query";
import { LoginPageView } from "./login-page-view";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ jurisdiction: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ params, searchParams }: Props) {
  const { jurisdiction } = await params;
  const raw = searchParams !== undefined ? await searchParams : undefined;
  const loginQuery = parseLoginSearchParams(raw);
  return <LoginPageView jurisdiction={jurisdiction} loginQuery={loginQuery} />;
}
