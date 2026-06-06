"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { isPilotTestModeEnabled } from "@/lib/pilot-test-mode";

/** Minimal shell for jurisdiction-scoped workspace routes until CAD/live APIs are wired. */
export function JurisdictionWorkspacePlaceholder({ title }: { title: string }) {
  const params = useParams();
  const jurisdiction =
    typeof params?.jurisdiction === "string" ? params.jurisdiction : undefined;
  const dashboardHref = jurisdiction ? `/${jurisdiction}/dashboard` : "/dispatcher/dashboard";

  if (isPilotTestModeEnabled()) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-400">
          In pilot test mode, live dispatcher tools (transcription, translation, caller media, AI
          summary, and related panels) run on the main live dashboard—not this stub route.
        </p>
        <Link
          href={dashboardHref}
          className="mt-4 inline-flex text-sm font-medium text-sky-400 hover:text-sky-300"
        >
          Open live dashboard →
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-400">
        This route is reserved for live operations data. Placeholder until CAD and incident services
        are connected.
      </p>
    </div>
  );
}
