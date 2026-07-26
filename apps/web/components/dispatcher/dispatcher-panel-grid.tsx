"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DispatcherPanelShell } from "@/components/dispatcher/dispatcher-panel-shell";
import { usePanelLayout, type PanelDef } from "@/lib/dispatcher/use-panel-layout";

export const DISPATCHER_PANEL_DEFS: PanelDef[] = [
  { id: "intelligence", defaultWide: true },
  { id: "caller_mobile", defaultWide: false },
  { id: "silent_text", defaultWide: false },
  { id: "pinpoint", defaultWide: true },
  { id: "location", defaultWide: false },
  { id: "premise_notes", defaultWide: false },
  { id: "ng911_assist", defaultWide: true },
];

const PANEL_META: Record<
  string,
  {
    title: string;
    accentColor: string;
    badge?: string;
    badgeColor?: string;
    helpTopic?: string;
  }
> = {
  intelligence: { title: "INTELLIGENCE", accentColor: "#8b5cf6", badge: "AI SUGGESTED", badgeColor: "#8b5cf6" },
  caller_mobile: { title: "CALLER MOBILE", accentColor: "#10b981", helpTopic: "live-video" },
  silent_text: { title: "SILENT TEXT LINK", accentColor: "#10b981", helpTopic: "silent-text" },
  pinpoint: { title: "RAPID CORTEX PINPOINT", accentColor: "#3b82f6", helpTopic: "pinpoint" },
  location: { title: "LOCATION", accentColor: "#8b5cf6" },
  premise_notes: { title: "PREMISE NOTES", accentColor: "#f59e0b" },
  ng911_assist: { title: "NG9-1-1 ASSIST", accentColor: "#0ea5e9", badge: "CRISIS / EIDO", badgeColor: "#f59e0b" },
};

/** Prefer the panel under the pointer (CRM-like); fall back to nearest corner. */
const panelCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return closestCorners(args);
};

export type PanelContentMap = Partial<Record<string, ReactNode>>;

interface DispatcherPanelGridProps {
  userId: string;
  panels: PanelContentMap;
  className?: string;
}

export function DispatcherPanelGrid({ userId, panels, className }: DispatcherPanelGridProps) {
  const { order, wide, collapsed, setOrder, toggleWide, toggleCollapse, resetLayout } = usePanelLayout(
    userId,
    DISPATCHER_PANEL_DEFS,
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const isDragging = activeId != null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeKey = String(active.id);
    const overKey = String(over.id);

    setOrder((prev) => {
      const oldIndex = prev.indexOf(activeKey);
      const newIndex = prev.indexOf(overKey);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
      // Insert at the drop target index (same feel as dropping a CRM card onto a slot).
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  const activeMeta = activeId ? PANEL_META[activeId] : null;

  return (
    <div className={className}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 8,
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#7c6fa0",
            letterSpacing: "0.1em",
            fontFamily: "monospace",
          }}
        >
          INCIDENT PANEL LAYOUT
        </span>
        <button
          type="button"
          onClick={resetLayout}
          title="Reset to default layout"
          style={{
            marginLeft: "auto",
            background: "none",
            border: "1px solid #2a2440",
            borderRadius: 4,
            color: "#5a4d7a",
            fontSize: 10,
            padding: "2px 7px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <RotateCcw size={10} />
          Reset
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={panelCollisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div
            style={{
              display: "grid",
              // While dragging, flatten to equal cells so drop targets match pointer position
              // (full-width spans otherwise pull collision toward the first slot).
              gridTemplateColumns: isDragging ? "1fr 1fr" : "1fr 1fr",
              gap: 8,
              alignItems: "start",
            }}
          >
            {order.map((id) => {
              const meta = PANEL_META[id];
              const content = panels[id];
              if (!meta) return null;

              return (
                <DispatcherPanelShell
                  key={id}
                  id={id}
                  title={meta.title}
                  accentColor={meta.accentColor}
                  badge={meta.badge}
                  badgeColor={meta.badgeColor}
                  helpTopic={meta.helpTopic}
                  wide={wide[id] ?? false}
                  forceHalfWidth={isDragging}
                  collapsed={collapsed[id] ?? false}
                  onToggleWide={() => toggleWide(id)}
                  onToggleCollapse={() => toggleCollapse(id)}
                >
                  {content ?? (
                    <div
                      style={{
                        padding: "10px 12px",
                        fontSize: 11,
                        color: "#5a4d7a",
                        fontFamily: "monospace",
                      }}
                    >
                      Panel content unavailable.
                    </div>
                  )}
                </DispatcherPanelShell>
              );
            })}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeId && activeMeta ? (
            <div
              style={{
                border: `1px solid ${activeMeta.accentColor}`,
                borderRadius: 8,
                background: "#1a1625",
                padding: "10px 12px",
                opacity: 0.95,
                boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px ${activeMeta.accentColor}55`,
                cursor: "grabbing",
                minWidth: 220,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ color: "#3d3460", fontSize: 13 }}>⠿</span>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: activeMeta.accentColor,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "#a8a0c0",
                    fontFamily: "monospace",
                  }}
                >
                  {activeMeta.title}
                </span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 10, color: "#5a4d7a", fontFamily: "monospace" }}>
                Drop on a panel to place here
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div
        style={{
          marginTop: 8,
          padding: "5px 9px",
          background: "#13102a",
          borderRadius: 5,
          border: "1px solid #1e1a30",
          fontSize: 10,
          color: "#3d3460",
          fontFamily: "monospace",
        }}
      >
        ⠿ drag panel to reorder · ◧ / ▭ toggle full width · ▽ collapse · layout saved for next session
      </div>
    </div>
  );
}
