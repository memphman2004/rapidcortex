"use client";

import Link from "next/link";
import { useSession } from "@/components/auth/session-context";
import { NonEmergencyQueuePanel } from "@/components/triage/non-emergency-queue-panel";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isNonEmergencyTriageEnabled } from "@/lib/runtime-flags";

type NonEmergencyWorkspaceProps = {
  variant: "triage" | "non-emergency";
};

function isTriageAdmin(role: string | undefined): boolean {
  return role === "agencyadmin" || role === "agencyit" || role === "rcsuperadmin";
}

export function NonEmergencyWorkspace({ variant }: NonEmergencyWorkspaceProps) {
  const { user } = useSession();
  const to = useJurisdictionLink();
  const triageEnabled = isNonEmergencyTriageEnabled();

  const title =
    variant === "non-emergency" ? "Non-emergency intake queue" : "Call triage workspace";
  const summary =
    variant === "non-emergency"
      ? "Claim, resolve, or escalate AI-routed non-emergency calls."
      : "Review AI triage classifications and manage the non-emergency backlog.";

  if (!triageEnabled) {
    return (
      <div className="m-4 max-w-2xl space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <p className="text-sm text-slate-400">
          Non-emergency triage isn’t enabled for this agency. Contact Rapid Cortex support.
        </p>
        <Link href={to("/dashboard")} className="text-sm text-sky-400 hover:underline">
          ← Dispatcher dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-400/90">
            Call handling
          </p>
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${to("/dashboard")}?queue=non_emergency`}
            className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/20"
          >
            Open in dispatcher console
          </Link>
          {isTriageAdmin(user?.role) ? (
            <Link
              href={to("/admin/triage/config")}
              className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Triage settings
            </Link>
          ) : null}
        </div>
      </div>

      <NonEmergencyQueuePanel enabled />

    </div>
  );
}
