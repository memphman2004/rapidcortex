"use client";

import type { HelpType } from "../_lib/report-types";
import { HELP_TYPES } from "../_lib/report-types";
import { ReportProgress } from "./ReportProgress";

export function StepSelectType({
  onSelect,
  venueCode,
}: {
  onSelect: (type: HelpType) => void;
  venueCode: string;
}) {
  return (
    <section className="flex min-h-[70vh] flex-col justify-between">
      <div>
        <ReportProgress step={1} total={4} />
        <h1 className="text-2xl font-semibold text-slate-800">What do you need?</h1>
        <p className="mb-6 mt-2 text-sm text-slate-500">Tap to let us know how we can help.</p>

        <div className="grid grid-cols-2 gap-3">
          {HELP_TYPES.map((helpType) => (
            <button
              key={helpType.type}
              type="button"
              onClick={() => onSelect(helpType.type)}
              className="relative min-h-24 rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`${helpType.label} help type`}
            >
              {helpType.urgent ? (
                <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-400" />
              ) : null}
              <p className="mb-1 text-3xl">{helpType.emoji}</p>
              <p className="text-base font-semibold text-slate-800">{helpType.label}</p>
              <p className="mt-1 text-xs leading-snug text-slate-400">{helpType.description}</p>
            </button>
          ))}
        </div>
      </div>

      <p className="pt-4 text-xs text-slate-400">Reporting for venue {venueCode}</p>
    </section>
  );
}
