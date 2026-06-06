"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PILOT_CHECKLIST_STORAGE_KEY,
  PILOT_ONBOARDING_PHASES,
} from "@/lib/pilot-onboarding-steps";
import { DocumentationArticleLink } from "@/components/admin/documentation-article-link";
import Link from "next/link";

function usePilotChecklistStorage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PILOT_CHECKLIST_STORAGE_KEY);
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
        sessionStorage.setItem(PILOT_CHECKLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      return next;
    });
  }, []);

  return { checked, setItem, hydrated };
}

export function PilotOnboardingTracker({ to }: { to: (path: string) => string }) {
  const { checked, setItem, hydrated } = usePilotChecklistStorage();

  const allIds = useMemo(
    () => PILOT_ONBOARDING_PHASES.flatMap((p) => p.items.map((i) => i.id)),
    [],
  );
  const doneCount = useMemo(
    () => allIds.filter((id) => checked[id]).length,
    [allIds, checked],
  );

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Onboarding tracker</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Progress is stored in this browser tab only (sessionStorage, non-sensitive UI state). Use it for working sessions;
            keep authoritative sign-off in your agency playbook or ticket system.
          </p>
        </div>
        <p className="text-xs font-medium text-slate-400" aria-live="polite">
          {hydrated ? `${doneCount} / ${allIds.length}` : "—"}
        </p>
      </div>

      <div className="mt-6 space-y-8">
        {PILOT_ONBOARDING_PHASES.map((phase) => (
          <div key={phase.id}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-200/90">
              {phase.title}
            </h3>
            <p className="mt-1 text-xs text-slate-500">{phase.description}</p>
            <ul className="mt-3 space-y-2">
              {phase.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start gap-3 rounded-md border border-slate-800/80 bg-slate-950/40 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    id={`pilot-${item.id}`}
                    checked={Boolean(checked[item.id])}
                    disabled={!hydrated}
                    onChange={(e) => setItem(item.id, e.target.checked)}
                    className="mt-0.5 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500"
                  />
                  <label
                    htmlFor={`pilot-${item.id}`}
                    className="min-w-0 flex-1 cursor-pointer text-sm text-slate-300"
                  >
                    {item.text}
                  </label>
                  <span className="flex flex-wrap gap-2 text-xs">
                    {item.adminPath ? (
                      <Link
                        href={to(item.adminPath)}
                        className="text-sky-400 hover:text-sky-300 hover:underline"
                      >
                        Open in app
                      </Link>
                    ) : null}
                    {item.docFile ? (
                      <DocumentationArticleLink file={item.docFile} label="Doc" />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
