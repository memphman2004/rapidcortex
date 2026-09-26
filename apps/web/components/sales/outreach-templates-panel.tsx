"use client";

import { useMemo, useState } from "react";
import {
  SALES_OUTREACH_TEMPLATES,
  type SalesTemplateVertical,
} from "@/lib/sales/sales-templates-data";

const FILTERS: { id: SalesTemplateVertical | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "rc911", label: "911" },
  { id: "campus", label: "Campus" },
  { id: "venue", label: "Venue" },
  { id: "hospital", label: "Hospital" },
  { id: "transit", label: "Transit" },
  { id: "general", label: "General" },
];

export function OutreachTemplatesPanel() {
  const [filter, setFilter] = useState<SalesTemplateVertical | "all">("all");
  const [copied, setCopied] = useState<string | null>(null);

  const list = useMemo(
    () =>
      filter === "all"
        ? [...SALES_OUTREACH_TEMPLATES]
        : SALES_OUTREACH_TEMPLATES.filter((t) => t.vertical === filter),
    [filter],
  );

  async function copyTemplate(id: string, subject: string, body: string) {
    const text = subject ? `Subject: ${subject}\n\n${body}` : body;
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={[
              "rounded-full border px-3 py-1.5 text-[11px] font-semibold",
              filter === f.id
                ? "border-sky-500 bg-sky-500/10 text-sky-300"
                : "border-white/10 text-slate-500",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {list.map((t) => (
          <article key={t.id} className="rounded-xl border border-white/5 bg-[#0a1628] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">{t.title}</h3>
              <button
                type="button"
                onClick={() => void copyTemplate(t.id, t.subject, t.body)}
                className="text-[11px] font-bold text-sky-400"
              >
                {copied === t.id ? "Copied" : "Copy"}
              </button>
            </div>
            {t.subject && (
              <p className="mt-2 text-xs text-slate-400">
                Subject: <span className="text-amber-300/90">{t.subject}</span>
              </p>
            )}
            <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
              {t.body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => `{{${key}}}`)}
            </pre>
          </article>
        ))}
      </div>
    </div>
  );
}
