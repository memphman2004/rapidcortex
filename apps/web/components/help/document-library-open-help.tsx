"use client";

import { useHelpPanel } from "@/components/help/help-panel-context";

/** Opens the in-app Help panel (avoids broken /help → /docs/help HTML redirect). */
export function DocumentLibraryOpenHelp() {
  const { openHelp } = useHelpPanel();
  return (
    <button
      type="button"
      onClick={() => openHelp("index")}
      className="rounded-xl border border-slate-800 bg-slate-900/35 p-4 text-left transition hover:border-slate-600 hover:bg-slate-900/55"
    >
      <div className="text-sm font-semibold text-white">Role help articles</div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
        Open the in-app Help &amp; Documentation panel for role-specific how-to guides.
      </p>
      <span className="mt-3 inline-block text-xs text-sky-400">Open →</span>
    </button>
  );
}
