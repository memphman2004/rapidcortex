"use client";

import type { OperationalViewMode } from "rapid-cortex-shared";
import { Layers, Maximize2, RefreshCw, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { C } from "@/lib/theme/rc-theme-tokens";

const MODES: Array<{ id: OperationalViewMode; label: string }> = [
  { id: "split", label: "SPLIT" },
  { id: "area", label: "AREA" },
  { id: "facility", label: "FACILITY" },
];

export function OperationalAwarenessHeader({
  viewMode,
  onViewMode,
  onResetLayout,
  onRefresh,
  onToggleLayers,
  onPopOut,
  layersOpen,
}: {
  viewMode: OperationalViewMode;
  onViewMode: (mode: OperationalViewMode) => void;
  onResetLayout: () => void;
  onRefresh: () => void;
  onToggleLayers: () => void;
  onPopOut: () => void;
  layersOpen: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
      style={{ borderBottom: `1px solid ${C.border}` }}
    >
      <div className="flex items-center gap-3">
        <h2
          className="text-[12px] font-bold tracking-[0.08em] text-slate-300"
        >
          OPERATIONAL AWARENESS
        </h2>
        <div
          className="inline-flex rounded-md border p-0.5"
          style={{ borderColor: C.border, background: C.surface }}
          role="tablist"
          aria-label="Map view mode"
        >
          {MODES.map((mode) => {
            const selected = mode.id === viewMode;
            return (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onViewMode(mode.id)}
                className={`rounded px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                  selected ? "text-black" : "text-slate-400 hover:text-slate-200"
                }`}
                style={selected ? { background: C.orange } : undefined}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <HeaderIcon label="Reset view" onClick={onResetLayout}>
          <RotateCcw size={13} />
        </HeaderIcon>
        <HeaderIcon label="Refresh" onClick={onRefresh}>
          <RefreshCw size={13} />
        </HeaderIcon>
        <HeaderIcon label="Layers" onClick={onToggleLayers} pressed={layersOpen}>
          <Layers size={13} />
        </HeaderIcon>
        <HeaderIcon label="Pop out active map" onClick={onPopOut}>
          <Maximize2 size={13} />
        </HeaderIcon>
        <span className="sr-only">
          Split view uses both maps. Area is exterior only. Facility is interior only.
        </span>
      </div>
    </div>
  );
}

function HeaderIcon({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
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
      style={{ borderColor: C.border }}
    >
      {children}
    </button>
  );
}
