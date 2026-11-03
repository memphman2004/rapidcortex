"use client";

import { useState } from "react";
import { CallTranscriptCoach } from "@/components/sales/CallTranscriptCoach";
import { SalesEmailComposer } from "@/components/sales/SalesEmailComposer";

type SubTab = "email" | "coach";

export function SalesTools() {
  const [tab, setTab] = useState<SubTab>("email");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: "email", label: "Email Composer" },
            { id: "coach", label: "Call Coach" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
              tab === t.id
                ? "border-sky-500 bg-sky-500/10 text-sky-300"
                : "border-white/10 text-slate-500 hover:text-slate-300",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "email" ? <SalesEmailComposer /> : <CallTranscriptCoach />}
    </div>
  );
}

export default SalesTools;
