"use client";

import type { ReactNode } from "react";

type Props = {
  count: number;
  children: ReactNode;
};

export function ActNowSection({ count, children }: Props) {
  return (
    <>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-4 py-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <span className="text-[11px] font-bold tracking-wide text-slate-300">ACT NOW</span>
        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
          {count}
        </span>
      </div>
      {children}
      <div className="mx-4 my-1 border-b border-slate-800" />
    </>
  );
}
