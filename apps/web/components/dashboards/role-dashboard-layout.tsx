import { Suspense } from "react";
import { redirect } from "next/navigation";
import { resolvePostAuthenticationHomeHref } from "@/lib/auth/post-login-redirect";
import type { DashboardPrefix } from "@/lib/dashboards/dashboard-access";
import { evaluateDashboardGate } from "@/lib/dashboards/dashboard-access";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { JurisdictionProvider } from "@/lib/jurisdiction-context";
import { defaultJurisdictionSlug, marketingLoginPath } from "@/lib/marketing-links";
import { DashboardShell } from "./dashboard-shell";

function DashboardShellFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030712] text-sm text-slate-400">
      Loading workspace…
    </div>
  );
}

export async function RoleDashboardLayout({
  prefix,
  children,
}: {
  prefix: DashboardPrefix;
  children: React.ReactNode;
}) {
  const user = await getDashboardSessionUser();
  const slug = defaultJurisdictionSlug();

  if (!user) {
    redirect(`${marketingLoginPath()}?from=/${prefix}/dashboard`);
  }

  const gate = evaluateDashboardGate(user, prefix);
  if (gate === "forbidden") {
    redirect(resolvePostAuthenticationHomeHref(user, slug));
  }

  return (
    <JurisdictionProvider slug={slug}>
      <Suspense fallback={<DashboardShellFallback />}>
        <DashboardShell prefix={prefix} user={user}>
          {children}
        </DashboardShell>
      </Suspense>
    </JurisdictionProvider>
  );
}
