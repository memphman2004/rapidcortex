import type { LoginQuerySnapshot } from "@/lib/auth/login-query";
import { isHostedUiAuthConfigured } from "@/lib/auth/roles";
import { LoginPageClient } from "./login-page-client";

export function LoginPageView({
  loginQuery,
}: {
  /** Kept for callers (`/login`, `/{jurisdiction}/login`); layout no longer branches on it. */
  jurisdiction: string;
  loginQuery: LoginQuerySnapshot;
}) {
  /** true when ECS `COGNITO_*` and/or baked `NEXT_PUBLIC_COGNITO_*` are present (SSR reads runtime env when dynamic). */
  const signInConfigured = isHostedUiAuthConfigured();
  const year = new Date().getFullYear();

  return (
    <LoginPageClient
      loginQuery={loginQuery}
      signInConfigured={signInConfigured}
      year={year}
    />
  );
}
