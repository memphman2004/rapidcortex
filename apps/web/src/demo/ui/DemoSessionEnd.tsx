"use client";

import { useEffect } from "react";
import { deactivateDemoSession } from "../engine/demo-mode-gate";

export function DemoSessionEnd() {
  useEffect(() => {
    deactivateDemoSession();
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-slate-100">
      <div className="max-w-md">
        <h1 className="text-xl font-semibold">Demo session ended</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Fictional Maplewood County data has been cleared from this browser tab. Nothing was written to a live
          communications center.
        </p>
      </div>
    </main>
  );
}
