"use client";

import { useCallback, useId, useState } from "react";
import { Check, Copy, Download, ImageIcon } from "lucide-react";

export const PRESS_BOILERPLATE =
  "Rapid Cortex is a real-time AI intelligence platform for public safety agencies. The platform provides 911 dispatchers and supervisors with live transcription, AI-generated incident summaries, and CAD system integration — designed to CJIS security standards. Rapid Cortex is available as a web platform, desktop application, and API. For more information, visit rapidcortex.us.";

export function PressBoilerplateCopy() {
  const [state, setState] = useState<"idle" | "copied">("idle");
  const statusId = useId();

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(PRESS_BOILERPLATE);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2200);
    } catch {
      setState("idle");
    }
  }, []);

  return (
    <div className="rounded-xl border border-slate-700/80 bg-[#0f172a] p-5 sm:p-6">
      <p className="text-sm leading-relaxed text-slate-200 sm:text-base">{PRESS_BOILERPLATE}</p>
      <button
        type="button"
        onClick={copy}
        className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-900/80 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-sky-500/50 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
      >
        {state === "copied" ? (
          <>
            <Check className="h-4 w-4 text-emerald-400" aria-hidden />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" aria-hidden />
            Copy to clipboard
          </>
        )}
      </button>
      <p id={statusId} className="sr-only" role="status" aria-live="polite">
        {state === "copied" ? "Boilerplate copied to clipboard." : ""}
      </p>
    </div>
  );
}

export type PressAssetItem = {
  id: string;
  title: string;
  formats: string;
  /** When set, primary download works. */
  href?: string;
  /** Optional second format (e.g. SVG) — shows coming soon if no href. */
  secondaryLabel?: string;
  secondaryHref?: string;
  /** Primary button label (default: Download). */
  downloadLabel?: string;
};

export function PressMediaAssetCard({ item }: { item: PressAssetItem }) {
  const [toast, setToast] = useState<string | null>(null);
  const primaryLabel = item.downloadLabel ?? "Download";

  const showSoon = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  return (
    <div className="flex flex-col rounded-xl border border-slate-700/80 bg-[#111827] shadow-sm shadow-black/30">
      <div className="flex aspect-[16/10] items-center justify-center rounded-t-xl bg-slate-900/80">
        <ImageIcon className="h-12 w-12 text-slate-600" aria-hidden />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div>
          <h3 className="text-sm font-semibold text-white">{item.title}</h3>
          <p className="mt-1 text-xs text-slate-500">{item.formats}</p>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          {item.href ? (
            <a
              href={item.href}
              download
              className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 sm:flex-initial sm:px-4 sm:text-sm"
            >
              <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {primaryLabel}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => showSoon("This asset is not available yet.")}
              className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-600 sm:flex-initial sm:px-4 sm:text-sm"
            >
              <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {primaryLabel}
            </button>
          )}
          {item.secondaryLabel ? (
            item.secondaryHref ? (
              <a
                href={item.secondaryHref}
                download
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 sm:text-sm"
              >
                {item.secondaryLabel}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => showSoon(`${item.secondaryLabel} — coming soon.`)}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 sm:text-sm"
              >
                {item.secondaryLabel}
              </button>
            )
          ) : null}
        </div>
        <p className="text-[11px] text-slate-500">For editorial use only.</p>
        {toast ? (
          <p className="text-xs font-medium text-amber-200/95" role="status" aria-live="polite">
            {toast}
          </p>
        ) : null}
      </div>
    </div>
  );
}
