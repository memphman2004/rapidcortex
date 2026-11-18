"use client";

import { DEMO_MODE_BANNER_TEXT } from "../types";

/** Fixed, non-dismissible strip. Present on every route while Demo Mode is active. */
export function DemoIndicatorBanner() {
  return (
    <div
      data-demo-banner="true"
      role="status"
      className="fixed inset-x-0 top-0 z-[80] flex h-9 items-center justify-center gap-2 border-b border-amber-300/40 bg-amber-500 px-3 text-center text-[12px] font-semibold tracking-wide text-amber-950"
    >
      <span aria-hidden="true">⚠</span>
      <span>{DEMO_MODE_BANNER_TEXT}</span>
    </div>
  );
}
