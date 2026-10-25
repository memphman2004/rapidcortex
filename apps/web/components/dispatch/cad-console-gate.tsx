"use client";

import Link from "next/link";
import { useSession } from "@/components/auth/session-context";
import { useCadModuleAccess } from "@/lib/hooks/use-cad-module";
import { useOptionalJurisdictionSlug } from "@/lib/jurisdiction-context";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";

const SCOPE_LABEL: Record<string, string> = {
  FULL: "Full — dispatch and assign units",
  READ_ONLY: "Read-only — view incidents and update unit status",
  ADMIN: "Admin — manage CAD configuration",
};

export function CadConsoleGate() {
  const { user, isLoading } = useSession();
  const jurisdiction = useOptionalJurisdictionSlug() ?? defaultJurisdictionSlug();
  const access = useCadModuleAccess(Boolean(user));
  const cadAppUrl = process.env.NEXT_PUBLIC_CAD_APP_URL?.trim();

  if (isLoading || access.isLoading) {
    return <p className="p-6 text-sm text-slate-400">Checking CAD access…</p>;
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
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-lg font-semibold text-white">CAD</h1>
      <p className="mt-2 text-sm text-slate-300">
        CAD is on for your account
        {scope ? ` — ${SCOPE_LABEL[scope] ?? scope}` : ""}.
      </p>
      <p className="mt-2 text-sm text-slate-400">
        This is the licensed dispatch console. Call-taking in NexCort iQ stays on the Dispatcher workspace.
      </p>
      {cadAppUrl ? (
        <a
          href={cadAppUrl}
          className="mt-4 inline-flex rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600"
        >
          Open CAD
        </a>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          The CAD application opens here once that connection is configured for this environment.
        </p>
      )}
    </div>
  );
}
