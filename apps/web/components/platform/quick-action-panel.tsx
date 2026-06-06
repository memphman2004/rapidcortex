"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

export type QuickAction = {
  href: string;
  label: string;
  description: string;
  /** Optional; defaults to chevron */
  icon?: ReactNode;
};

export function QuickActionPanel({ title, actions }: { title: string; actions: QuickAction[] }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      <ul className="mt-3 space-y-2">
        {actions.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="group flex items-center justify-between gap-2 rounded-md border border-slate-800/80 bg-slate-950/30 px-3 py-2.5 text-left transition hover:border-rose-500/25 hover:bg-slate-900/60"
            >
              <div>
                <p className="text-sm font-medium text-white group-hover:text-sky-200">{a.label}</p>
                <p className="text-xs text-slate-500">{a.description}</p>
              </div>
              <span className="shrink-0 text-slate-500 group-hover:text-sky-400">
                {a.icon ?? <ArrowRight className="h-4 w-4" aria-hidden />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
