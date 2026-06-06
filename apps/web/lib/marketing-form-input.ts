import type { FocusEvent } from "react";

/** 16px+ inputs prevent iOS Safari auto-zoom on focus; h-12 meets touch-target guidance. */
export const MARKETING_FORM_INPUT_CLASS =
  "mt-2 h-12 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 text-base text-slate-100 placeholder:text-slate-600 disabled:opacity-60";

export const MARKETING_FORM_TEXTAREA_CLASS =
  "mt-2 min-h-[7rem] w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-600 disabled:opacity-60";

/** Scroll focused field above mobile keyboard (marketing forms only). */
export function scrollMarketingFieldIntoViewOnFocus(event: FocusEvent<HTMLElement>) {
  if (typeof window === "undefined") return;
  if (!window.matchMedia("(max-width: 767px)").matches) return;
  queueMicrotask(() => {
    event.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}
