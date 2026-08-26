"use client";

import type { ReactNode } from "react";
import { C } from "@/lib/theme/rc-theme-tokens";

export function MapIconButton({
  label,
  onClick,
  children,
  pressed,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded border p-1.5 text-slate-300 hover:border-orange-500/60 hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${
        pressed ? "border-orange-500/70 text-orange-200" : ""
      }`}
      style={{ borderColor: C.border, background: C.surface }}
    >
      {children}
    </button>
  );
}
