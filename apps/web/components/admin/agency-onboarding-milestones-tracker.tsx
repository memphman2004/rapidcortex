"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AGENCY_MILESTONE_STORAGE_KEY,
  AGENCY_ONBOARDING_MILESTONES,
} from "@/lib/agency-onboarding-milestones";
import { DocumentationArticleLink } from "@/components/admin/documentation-article-link";

function useMilestoneStorage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(AGENCY_MILESTONE_STORAGE_KEY);
      setChecked(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch {
      setChecked({});
    }
    setHydrated(true);
  }, []);

  const setItem = useCallback((id: string, value: boolean) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: value };
      try {
        sessionStorage.setItem(AGENCY_MILESTONE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { checked, setItem, hydrated };
}

export function AgencyOnboardingMilestonesTracker({ to }: { to: (path: string) => string }) {
  const { checked, setItem, hydrated } = useMilestoneStorage();
  const ids = useMemo(() => AGENCY_ONBOARDING_MILESTONES.map((m) => m.id), []);
  const done = useMemo(() => ids.filter((id) => checked[id]).length, [checked, ids]);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Agency onboarding milestones</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Ordered from kickoff to support handoff. Matches{" "}
            <span className="font-mono text-slate-400">docs/AGENCY_ONBOARDING_RUNBOOK.md</span>. Progress
            is stored in this browser only.
          </p>
        </div>
        <p className="text-xs font-medium text-slate-400" aria-live="polite">
          {hydrated ? `${done} / ${ids.length}` : "—"}
        </p>
      </div>
      <ol className="mt-5 space-y-2">
        {AGENCY_ONBOARDING_MILESTONES.map((m, index) => (
          <li
            key={m.id}
            className="flex flex-wrap items-start gap-3 rounded-md border border-slate-800/80 bg-slate-950/40 px-3 py-2"
          >
            <span className="mt-0.5 w-5 shrink-0 text-center text-xs font-medium text-slate-500">
              {index + 1}
            </span>
            <input
              type="checkbox"
              id={`ms-${m.id}`}
              checked={Boolean(checked[m.id])}
              disabled={!hydrated}
              onChange={(e) => setItem(m.id, e.target.checked)}
              className="mt-0.5 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500"
            />
            <label
              htmlFor={`ms-${m.id}`}
              className="min-w-0 flex-1 cursor-pointer text-sm text-slate-300"
            >
              {m.text}
            </label>
            <span className="flex flex-wrap gap-2 text-xs">
              {m.adminPath ? (
                <Link
                  href={to(m.adminPath)}
                  className="text-sky-400 hover:text-sky-300 hover:underline"
                >
                  Open in app
                </Link>
              ) : null}
              {m.docFile ? (
                <DocumentationArticleLink file={m.docFile} label="Doc" />
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
