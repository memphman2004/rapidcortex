import Link from "next/link";
import { defaultJurisdictionSlug, marketingLoginPath } from "@/lib/marketing-links";
import { defaultDashboardHrefForRole } from "@/lib/dashboards/dashboard-access";
import type { UserContext } from "rapid-cortex-shared";

export function AccessDenied({ user }: { user: UserContext | null }) {
  const slug = defaultJurisdictionSlug();
  const home =
    user != null ? defaultDashboardHrefForRole(user.role, slug) : marketingLoginPath();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-slate-950 px-4 text-center">
      <div className="max-w-md rounded-xl border border-red-900/40 bg-slate-900/80 p-8 shadow-lg ring-1 ring-red-500/20">
        <h1 className="text-lg font-semibold text-white">Access restricted</h1>
        <p className="mt-3 text-sm text-slate-400">
          This command dashboard is not available for your role. If you believe this is an error,
          contact your agency administrator.
        </p>
        <Link
          href={home}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
        >
          Go to your workspace
        </Link>
      </div>
    </div>
  );
}
