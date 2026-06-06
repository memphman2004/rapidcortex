import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  alert?: boolean;
  href?: string;
}

export function StatCard({ label, value, icon: Icon, trend = "neutral", alert = false, href }: StatCardProps) {
  const showAlert = alert && Number(value) > 0;
  const content = (
    <div
      className={`rounded-lg border border-slate-700/60 bg-slate-900/40 p-4 ${showAlert ? "ring-1 ring-red-500/40 bg-red-500/5" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-sm text-slate-400">{label}</p>
        </div>
        <div className="rounded-md border border-slate-700 bg-slate-950/60 p-2">
          <Icon className="h-4 w-4 text-sky-400" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs">
        {trend === "up" ? (
          <>
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-emerald-400">Trending up</span>
          </>
        ) : null}
        {trend === "down" ? (
          <>
            <ArrowDownRight className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-amber-400">Trending down</span>
          </>
        ) : null}
        {trend === "neutral" ? (
          <>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-400">Stable</span>
          </>
        ) : null}
      </div>
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block transition hover:opacity-95">
      {content}
    </Link>
  );
}
