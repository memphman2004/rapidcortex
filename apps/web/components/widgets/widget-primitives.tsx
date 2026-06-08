"use client";

import type { ElementType, ReactNode } from "react";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";

export type WidgetProps = {
  agencyId: string;
  accent: string;
};

export function WidgetShell({
  title,
  icon: Icon,
  count,
  children,
  className = "",
  action,
}: {
  title: string;
  icon?: ElementType;
  count?: number;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`flex h-full flex-col rounded-xl border border-slate-700/60 bg-slate-900 ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-slate-500" />}
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-xs font-medium text-slate-300">
              {count}
            </span>
          )}
        </div>
        {action}
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

export function WidgetSkeleton() {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50">
      <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
    </div>
  );
}

export function WidgetError({ message = "Failed to load" }: { message?: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-rose-900/30 bg-slate-900">
      <p className="text-xs text-rose-500">{message}</p>
    </div>
  );
}

export function Trend({ value, unit = "" }: { value: number; unit?: string }) {
  const isUp = value > 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-0.5 text-xs ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value)}
      {unit}
    </span>
  );
}

export function StatusDot({ ok }: { ok: boolean }) {
  return <div className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-500"}`} />;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  valueColor = "text-white",
}: {
  label: string;
  value: string | number;
  icon: ElementType;
  trend?: number;
  valueColor?: string;
}) {
  return (
    <div className="flex h-full items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900 px-4 py-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
        {trend !== undefined && (
          <div className="mt-1">
            <Trend value={trend} unit="%" />
          </div>
        )}
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800">
        <Icon className="h-5 w-5 text-slate-500" />
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center py-8">
      <p className="text-xs text-slate-600">{message}</p>
    </div>
  );
}

/** Safe JSON fetch via authenticated BFF. Returns null on non-OK. */
export async function backendGet<T = unknown>(path: string): Promise<T | null> {
  const r = await fetch(`/api/backend${path}`, { credentials: "include", cache: "no-store" });
  if (!r.ok) return null;
  try {
    return (await r.json()) as T;
  } catch {
    return null;
  }
}
