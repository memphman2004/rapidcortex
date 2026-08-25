"use client";

import type { ReactNode } from "react";
import {
  DOCK_MODULE_LABELS,
  DOCK_MODULES,
  dockRowClass,
  type DockFocusedSlot,
  type DockModuleKey,
  type DockState,
} from "@/lib/dispatcher/module-dock";

export type DockItem = {
  key: DockModuleKey;
  label: string;
  body: ReactNode;
};

function SlotChrome({
  slot,
  focused,
  moduleKey,
  onFocus,
  onClose,
}: {
  slot: DockFocusedSlot;
  focused: boolean;
  moduleKey: DockModuleKey | null;
  onFocus: () => void;
  onClose: () => void;
}) {
  const label = moduleKey ? DOCK_MODULE_LABELS[moduleKey] : "Empty";
  return (
    <div className={`workspace-slot-chip ${slot} ${focused ? "focused" : ""} ${moduleKey ? "" : "is-empty"}`}>
      <button
        type="button"
        className="workspace-slot-chip-name"
        onClick={onFocus}
        title={moduleKey ? `Focus ${slot} slot` : `Click a module to fill the ${slot} pane`}
      >
        {label}
      </button>
      {moduleKey ? (
        <button type="button" className="workspace-slot-close" aria-label={`Close ${slot} slot`} onClick={onClose}>
          ×
        </button>
      ) : null}
    </div>
  );
}

export function ModulePicker({
  dock,
  onOpenModule,
}: {
  dock: DockState;
  onOpenModule: (key: DockModuleKey) => void;
}) {
  const { leftSlot, rightSlot, split } = dock;
  return (
    <nav className="module-picker module-picker-rail" aria-label="Modules">
      {DOCK_MODULES.map((item) => (
        <div
          key={item.key}
          role="button"
          tabIndex={0}
          className={dockRowClass(leftSlot, rightSlot, item.key, split)}
          onClick={() => onOpenModule(item.key)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenModule(item.key);
            }
          }}
        >
          <span className="module-name">{item.label}</span>
          <div className="slot-indicators">
            <div className={`slot-dot ${leftSlot === item.key ? "slot-left" : ""}`} />
            <div className={`slot-dot ${split && rightSlot === item.key ? "slot-right" : ""}`} />
          </div>
        </div>
      ))}
    </nav>
  );
}

export function ModuleDock({
  items,
  dock,
  onToggleSplit,
  onSwap,
  onFocusSlot,
  onCloseSlot,
}: {
  items: DockItem[];
  dock: DockState;
  onToggleSplit: () => void;
  onSwap: () => void;
  onFocusSlot: (slot: DockFocusedSlot) => void;
  onCloseSlot: (slot: DockFocusedSlot) => void;
}) {
  const { leftSlot, rightSlot, split, focusedSlot } = dock;
  const canSwap = split && leftSlot != null && rightSlot != null && leftSlot !== rightSlot;
  const anyVisible = items.some((item) => item.key === leftSlot || (split && item.key === rightSlot));

  return (
    <div className="module-dock-shell">
      <div className="workspace-controls">
        <button
          type="button"
          className={`workspace-ctrl-btn ${split ? "active" : ""}`}
          onClick={onToggleSplit}
          title={split ? "Single pane" : "Split workspace into two panes"}
        >
          Split
        </button>
        <button
          type="button"
          className="workspace-ctrl-btn"
          onClick={onSwap}
          disabled={!canSwap}
          title="Swap left and right modules"
        >
          Swap
        </button>
        <SlotChrome
          slot="left"
          focused={focusedSlot === "left"}
          moduleKey={leftSlot}
          onFocus={() => onFocusSlot("left")}
          onClose={() => onCloseSlot("left")}
        />
        {split ? (
          <SlotChrome
            slot="right"
            focused={focusedSlot === "right"}
            moduleKey={rightSlot}
            onFocus={() => onFocusSlot("right")}
            onClose={() => onCloseSlot("right")}
          />
        ) : null}
      </div>

      <div className={`workspace-panels ${split ? "split" : ""}`}>
        {items.map((item) => {
          const inLeft = leftSlot === item.key;
          const inRight = split && rightSlot === item.key;
          const visible = inLeft || inRight;
          let gridColumn = "1";
          if (inRight && !inLeft) gridColumn = "2";
          if (inLeft && inRight) gridColumn = "1 / -1";
          const slot: DockFocusedSlot = inRight && !inLeft ? "right" : "left";
          return (
            <div
              key={item.key}
              className="workspace-slot"
              data-module={item.key}
              onClick={() => onFocusSlot(slot)}
              style={{
                display: visible ? "flex" : "none",
                gridColumn,
              }}
            >
              {item.body}
            </div>
          );
        })}
        {split && leftSlot == null ? (
          <button
            type="button"
            className={`workspace-empty workspace-empty-slot ${focusedSlot === "left" ? "focused left" : ""}`}
            style={{ gridColumn: 1 }}
            onClick={() => onFocusSlot("left")}
          >
            Select a module
          </button>
        ) : null}
        {split && rightSlot == null ? (
          <button
            type="button"
            className={`workspace-empty workspace-empty-slot ${focusedSlot === "right" ? "focused right" : ""}`}
            style={{ gridColumn: 2 }}
            onClick={() => onFocusSlot("right")}
          >
            Select a module
          </button>
        ) : null}
        {!split && !anyVisible ? <div className="workspace-empty">Select a module</div> : null}
      </div>
    </div>
  );
}
