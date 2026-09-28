"use client";

import { useState } from "react";
import { useDemoMode } from "@/hooks/useDemoMode";

type Props = {
  userEmail: string;
};

export function DemoModeToggle({ userEmail }: Props) {
  const { isDemoActive, demoSession, startDemo, stopDemo } = useDemoMode(userEmail);
  const [confirming, setConfirming] = useState(false);

  if (isDemoActive) {
    return (
      <button
        type="button"
        onClick={() => void stopDemo()}
        className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-[13px] font-semibold text-amber-300"
      >
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        DEMO {demoSession?.remainingLabel ?? ""} — Stop
      </button>
    );
  }

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-sky-500/40 bg-sky-500/15 px-2.5 py-1.5 text-[13px]">
        <span className="text-sky-300">Start demo? (2hr)</span>
        <button
          type="button"
          onClick={() => {
            void startDemo();
            setConfirming(false);
          }}
          className="rounded bg-sky-600 px-2.5 py-0.5 text-[12px] font-semibold text-white"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded border border-white/20 px-2 py-0.5 text-[12px] text-slate-400"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-[13px] font-medium text-slate-400 hover:text-slate-200"
      title="Allow screen sharing for demos/training (copy/print stay blocked)"
    >
      Start Demo
    </button>
  );
}
