"use client";

import type { ReactNode } from "react";
import type { WorkstationPanelName } from "@/lib/dispatcher/workstation-prefs";

const MAXIMIZABLE = new Set<WorkstationPanelName>([
  "transcript",
  "map",
  "intelligence",
  "cad_entry",
]);

export function WorkstationPanel({
  name,
  title,
  badge,
  secondary,
  collapsed,
  maximized,
  onToggleCollapse,
  onToggleMaximize,
  children,
  className,
  bodyClassName,
}: {
  name: WorkstationPanelName;
  title: string;
  badge?: string;
  secondary?: boolean;
  collapsed: boolean;
  maximized: boolean;
  onToggleCollapse: () => void;
  onToggleMaximize?: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const canMax = MAXIMIZABLE.has(name);
  return (
    <section
      className={`ws-panel ${className ?? ""}`}
      data-panel={name}
      data-maximized={maximized ? "1" : "0"}
    >
      <header
        className={`ws-panel-header ${secondary ? "secondary" : ""}`}
        onDoubleClick={() => {
          if (canMax) onToggleMaximize?.();
        }}
      >
        <button
          type="button"
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          onClick={onToggleCollapse}
          className="shrink-0 text-[10px] text-[var(--rc-text-muted)]"
        >
          {collapsed ? "▸" : "▾"}
        </button>
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {badge ? (
          <span className="shrink-0 font-mono text-[9px] font-bold tracking-wide text-[var(--rc-text-muted)]">
            {badge}
          </span>
        ) : null}
        <button
          type="button"
          aria-label={collapsed ? "Expand" : "Collapse"}
          title={collapsed ? "Expand" : "Collapse"}
          onClick={onToggleCollapse}
          className="shrink-0 px-0.5 text-[10px] text-[var(--rc-text-muted)]"
        >
          —
        </button>
        {canMax ? (
          <button
            type="button"
            aria-label={maximized ? "Restore panel" : "Maximize panel"}
            title={maximized ? "Restore" : "Maximize"}
            onClick={onToggleMaximize}
            className="shrink-0 px-0.5 text-[10px] text-[var(--rc-text-muted)]"
          >
            ⬡
          </button>
        ) : null}
      </header>
      {collapsed ? null : <div className={`ws-panel-body ${bodyClassName ?? ""}`}>{children}</div>}
    </section>
  );
}
