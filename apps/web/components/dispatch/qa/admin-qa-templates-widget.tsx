"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchQaTemplates, isApiConfigured } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";

export function AdminQaTemplatesWidget() {
  const to = useJurisdictionLink();
  const q = useQuery({
    queryKey: ["qa-templates", "admin-widget"],
    queryFn: fetchQaTemplates,
    enabled: isApiConfigured(),
    staleTime: 30_000,
  });

  const count = q.data?.length ?? 0;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">QA templates</h2>
          <p className="mt-1 max-w-xl text-xs text-slate-400">
            {q.isLoading
              ? "Loading template count…"
              : q.isError
                ? "Could not load templates from the API."
                : `${count} checklist template${count === 1 ? "" : "s"} available to dispatchers.`}
          </p>
        </div>
        <Link
          href={to("/admin/qa/templates")}
          className="shrink-0 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-amber-200/90 ring-1 ring-slate-700 hover:bg-slate-700"
        >
          Manage templates
        </Link>
      </div>
    </section>
  );
}
