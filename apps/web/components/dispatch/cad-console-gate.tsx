"use client";

import Link from "next/link";
import { useSession } from "@/components/auth/session-context";
import { CadEntryWorkspace } from "@/components/dispatch/cad-entry-workspace";
import { isApiConfigured } from "@/lib/api";
import { useCadModuleAccess } from "@/lib/hooks/use-cad-module";
import { useOptionalJurisdictionSlug } from "@/lib/jurisdiction-context";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";

const SCOPE_LABEL: Record<string, string> = {
  FULL: "Full — dispatch and assign units",
  READ_ONLY: "Read-only — view incidents and update unit status",
  ADMIN: "Admin — manage CAD configuration",
};

export function CadConsoleGate({ incidentId }: { incidentId: string | null }) {
  const { user, isLoading } = useSession();
  const jurisdiction = useOptionalJurisdictionSlug() ?? defaultJurisdictionSlug();
  const access = useCadModuleAccess(Boolean(user));
  const cadAppUrl = process.env.NEXT_PUBLIC_CAD_APP_URL?.trim();

  if (isLoading || (isApiConfigured() && access.isLoading)) {
    return <p className="p-6 text-sm text-slate-400">Checking CAD access…</p>;
  }

  const lookupFailed = access.isError && access.error instanceof Error ? access.error.message : "";
  const licenseApiMissing = !isApiConfigured() || /404|not found|not configured/i.test(lookupFailed);
  if (licenseApiMissing) {
    return <CadEntryWorkspace incidentId={incidentId} />;
  }

  if (!access.data?.visible) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <h1 className="text-lg font-semibold text-white">CAD</h1>
        <p className="mt-2 text-sm text-slate-400">CAD is not enabled for your account.</p>
        <Link href={`/${jurisdiction}/dashboard`} className="mt-4 inline-block text-sm text-sky-400 hover:text-sky-300">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const scope = access.data.grant?.cadScope;
  return (
    <div>
      <p className="px-4 pt-3 text-xs text-slate-500">
        CAD seat: {scope ? (SCOPE_LABEL[scope] ?? scope) : "assigned"}
        {cadAppUrl ? (
          <>
            {" "}
            ·{" "}
            <a href={cadAppUrl} className="text-sky-400 hover:text-sky-300">
              Open CAD application
            </a>
          </>
        ) : null}
      </p>
      <CadEntryWorkspace incidentId={incidentId} />
    </div>
  );
}
