"use client";

import { ExternalLink } from "lucide-react";
import { SAFETY_SOURCE_LABEL, SAFETY_SOURCE_URL } from "@/lib/psap/safety-source";

type Props = {
  className?: string;
  /** Compact toolbar chip vs inline text link. */
  variant?: "chip" | "inline";
  /** Optional hint under the link (empty-state copy). */
  hint?: string;
};

/**
 * Opens the Safety Source national directory in a new tab.
 * Used when PSAP / admin / sales contacts are missing — does not embed or scrape.
 */
export function SafetySourceLookupLink({
  className = "",
  variant = "inline",
  hint,
}: Props) {
  if (variant === "chip") {
    return (
      <a
        href={SAFETY_SOURCE_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="National Public Safety Information Bureau — opens in a new tab"
        className={`inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:border-sky-500/40 hover:bg-slate-800 hover:text-sky-300 ${className}`.trim()}
      >
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
        {SAFETY_SOURCE_LABEL}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }

  return (
    <span className={`inline-flex flex-col gap-0.5 ${className}`.trim()}>
      <a
        href={SAFETY_SOURCE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400/90 hover:text-sky-300 hover:underline"
      >
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
        {SAFETY_SOURCE_LABEL}
        <span className="text-[10px] font-normal text-slate-500">(external)</span>
      </a>
      {hint ? <span className="text-[10px] text-slate-600">{hint}</span> : null}
    </span>
  );
}
