"use client";

import Link from "next/link";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";

interface DashboardCardProps {
  title: string;
  description: string;
  href: string;
  status: "active" | "coming_soon";
}

export function DashboardCard({ title, description, href, status }: DashboardCardProps) {
  const to = useJurisdictionLink();

  if (status === "coming_soon") {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 opacity-60">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
          <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Coming soon
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
    );
  }

  return (
    <Link
      href={to(href)}
      className="group rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 transition-colors hover:border-slate-600 hover:bg-slate-900"
    >
      <h3 className="text-sm font-semibold text-white transition-colors group-hover:text-sky-300">
        {title}
      </h3>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
      <p className="mt-3 text-[11px] font-semibold text-sky-500 group-hover:text-sky-400">
        Open →
      </p>
    </Link>
  );
}
