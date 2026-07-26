"use client";

import { useSortable, defaultAnimateLayoutChanges } from "@dnd-kit/sortable";
import type { AnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, Columns2, Square } from "lucide-react";
import type { ReactNode } from "react";
import { ContextualHelp } from "@/components/help/help-button";

const V = {
  surface: "#1a1625",
  border: "#2a2440",
  silver: "#a8a0c0",
  dim: "#5a4d7a",
  handle: "#3d3460",
} as const;

/** Skip cascading grid transforms — they shove items toward slot 0 with full-width spans. */
const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args;
  if (isSorting || wasDragging) return false;
  return defaultAnimateLayoutChanges(args);
};

export interface PanelShellProps {
  id: string;
  title: string;
  accentColor: string;
  badge?: string;
  badgeColor?: string;
  helpTopic?: string;
  wide: boolean;
  collapsed: boolean;
  /** When true, force half-width for accurate drop targeting during a drag. */
  forceHalfWidth?: boolean;
  onToggleWide: () => void;
  onToggleCollapse: () => void;
  children: ReactNode;
}

export function DispatcherPanelShell({
  id,
  title,
  accentColor,
  badge,
  badgeColor,
  helpTopic,
  wide,
  collapsed,
  forceHalfWidth = false,
  onToggleWide,
  onToggleCollapse,
  children,
}: PanelShellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    animateLayoutChanges,
  });

  const spanWide = forceHalfWidth ? false : wide;

  return (
    <div
      ref={setNodeRef}
      data-panel-id={id}
      style={{
        gridColumn: spanWide ? "1 / -1" : "auto",
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0.35 : 1,
        border: `1px solid ${isDragging ? accentColor : V.border}`,
        borderRadius: 8,
        background: V.surface,
        minWidth: 0,
        zIndex: isDragging ? 2 : 1,
        boxShadow: isDragging ? `0 0 0 1px ${accentColor}66` : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "8px 10px",
          borderBottom: collapsed ? "none" : `1px solid ${V.border}`,
        }}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${title} panel to reorder`}
          style={{
            background: "none",
            border: "none",
            cursor: isDragging ? "grabbing" : "grab",
            color: V.handle,
            fontSize: 14,
            lineHeight: 1,
            padding: "2px 3px",
            borderRadius: 3,
            flexShrink: 0,
            touchAction: "none",
          }}
        >
          ⠿
        </button>

        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: accentColor,
            flexShrink: 0,
          }}
        />

        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: V.silver,
            flex: 1,
            fontFamily: "monospace",
            userSelect: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {title}
          {helpTopic ? <ContextualHelp topic={helpTopic} /> : null}
        </span>

        {badge && badgeColor ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: badgeColor,
              background: `${badgeColor}22`,
              border: `1px solid ${badgeColor}44`,
              padding: "2px 6px",
              borderRadius: 999,
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            {badge}
          </span>
        ) : null}

        <button
          type="button"
          onClick={onToggleWide}
          aria-label={wide ? "Collapse to single column" : "Expand to full width"}
          title={wide ? "Single column" : "Full width"}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: V.dim,
            padding: "2px 3px",
            borderRadius: 3,
          }}
        >
          {wide ? <Columns2 size={12} /> : <Square size={12} />}
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand panel" : "Collapse panel"}
          title={collapsed ? "Expand" : "Collapse"}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: V.dim,
            padding: "2px 3px",
            borderRadius: 3,
          }}
        >
          {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>

      {!collapsed && children}
    </div>
  );
}
