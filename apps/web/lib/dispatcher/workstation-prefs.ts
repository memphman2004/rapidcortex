"use client";

/**
 * Dispatcher CAD workstation layout prefs (sizes + collapse only).
 * Never persist incident data or PII.
 */

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_DOCK_STATE,
  isDockModuleKey,
  reduceDock,
  type DockFocusedSlot,
  type DockModuleKey,
  type DockState,
} from "@/lib/dispatcher/module-dock";

const PREFIX = "rapidCortex.dispatcher.layout.";

export const WORKSTATION_PANELS = [
  "transcript",
  "intelligence",
  "map",
  "caller_language",
  "caller_mobile",
  "silent_text",
  "pinpoint",
  "cad_entry",
  "premise_notes",
  "ng911_assist",
  "supervisor_assist",
  "actions",
  "location",
  "share",
] as const;

export type WorkstationPanelName = (typeof WORKSTATION_PANELS)[number];

const DEFAULT_OPEN: Record<WorkstationPanelName, boolean> = {
  transcript: true,
  intelligence: true,
  map: true,
  caller_language: true,
  caller_mobile: true,
  silent_text: true,
  pinpoint: true,
  cad_entry: true,
  premise_notes: false,
  ng911_assist: false,
  supervisor_assist: false,
  actions: false,
  location: false,
  share: false,
};

const DEFAULT_QUEUE = 220;
const DEFAULT_CONTEXT = 260;
const DEFAULT_TRANSCRIPT = 240;
const MIN_QUEUE = 180;
const MAX_QUEUE = 360;
const MIN_CONTEXT = 200;
const MAX_CONTEXT = 420;
const MIN_TRANSCRIPT = 140;
const MAX_TRANSCRIPT = 480;

function readNumber(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  } catch {
    return fallback;
  }
}

function writeNumber(key: string, value: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + key, String(value));
  } catch {
    /* ignore quota */
  }
}

function readCollapsed(name: WorkstationPanelName): boolean {
  if (typeof window === "undefined") return !DEFAULT_OPEN[name];
  try {
    const raw = localStorage.getItem(`${PREFIX}${name}.collapsed`);
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
    return !DEFAULT_OPEN[name];
  } catch {
    return !DEFAULT_OPEN[name];
  }
}

function writeCollapsed(name: WorkstationPanelName, collapsed: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${PREFIX}${name}.collapsed`, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function readDockState(): DockState {
  if (typeof window === "undefined") return DEFAULT_DOCK_STATE;
  try {
    const leftRaw = localStorage.getItem(`${PREFIX}dock.v2.leftSlot`);
    const rightRaw = localStorage.getItem(`${PREFIX}dock.v2.rightSlot`);
    const splitRaw = localStorage.getItem(`${PREFIX}dock.v2.split`);
    const focusedRaw = localStorage.getItem(`${PREFIX}dock.v2.focusedSlot`);
    const leftSlot = isDockModuleKey(leftRaw) ? leftRaw : null;
    const rightSlot = isDockModuleKey(rightRaw) ? rightRaw : null;
    const split = splitRaw == null ? DEFAULT_DOCK_STATE.split : splitRaw === "1" || splitRaw === "true";
    const focusedSlot: DockFocusedSlot = focusedRaw === "right" && split ? "right" : "left";
    return { leftSlot, rightSlot, split, focusedSlot };
  } catch {
    return DEFAULT_DOCK_STATE;
  }
}

function writeDockState(state: DockState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${PREFIX}dock.v2.leftSlot`, state.leftSlot ?? "");
    localStorage.setItem(`${PREFIX}dock.v2.rightSlot`, state.rightSlot ?? "");
    localStorage.setItem(`${PREFIX}dock.v2.split`, state.split ? "1" : "0");
    localStorage.setItem(`${PREFIX}dock.v2.focusedSlot`, state.focusedSlot);
  } catch {
    /* ignore quota */
  }
}

export function useWorkstationPrefs() {
  const [queueWidth, setQueueWidthState] = useState(DEFAULT_QUEUE);
  const [contextWidth, setContextWidthState] = useState(DEFAULT_CONTEXT);
  const [transcriptHeight, setTranscriptHeightState] = useState(DEFAULT_TRANSCRIPT);
  const [collapsed, setCollapsed] = useState<Record<WorkstationPanelName, boolean>>(() =>
    Object.fromEntries(WORKSTATION_PANELS.map((p) => [p, !DEFAULT_OPEN[p]])) as Record<
      WorkstationPanelName,
      boolean
    >,
  );
  const [maximized, setMaximized] = useState<WorkstationPanelName | null>(null);
  const [dock, setDock] = useState<DockState>(DEFAULT_DOCK_STATE);

  useEffect(() => {
    setQueueWidthState(readNumber("queueWidth", DEFAULT_QUEUE, MIN_QUEUE, MAX_QUEUE));
    setContextWidthState(readNumber("contextWidth", DEFAULT_CONTEXT, MIN_CONTEXT, MAX_CONTEXT));
    setTranscriptHeightState(
      readNumber("transcriptHeight", DEFAULT_TRANSCRIPT, MIN_TRANSCRIPT, MAX_TRANSCRIPT),
    );
    setCollapsed(
      Object.fromEntries(WORKSTATION_PANELS.map((p) => [p, readCollapsed(p)])) as Record<
        WorkstationPanelName,
        boolean
      >,
    );
    setDock(readDockState());
  }, []);

  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMaximized(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maximized]);

  const setQueueWidth = useCallback((n: number) => {
    const v = Math.min(MAX_QUEUE, Math.max(MIN_QUEUE, Math.round(n)));
    setQueueWidthState(v);
    writeNumber("queueWidth", v);
  }, []);

  const setContextWidth = useCallback((n: number) => {
    const v = Math.min(MAX_CONTEXT, Math.max(MIN_CONTEXT, Math.round(n)));
    setContextWidthState(v);
    writeNumber("contextWidth", v);
  }, []);

  const setTranscriptHeight = useCallback((n: number) => {
    const v = Math.min(MAX_TRANSCRIPT, Math.max(MIN_TRANSCRIPT, Math.round(n)));
    setTranscriptHeightState(v);
    writeNumber("transcriptHeight", v);
  }, []);

  const toggleCollapsed = useCallback((name: WorkstationPanelName) => {
    setCollapsed((prev) => {
      const next = !prev[name];
      writeCollapsed(name, next);
      return { ...prev, [name]: next };
    });
  }, []);

  const toggleMaximize = useCallback((name: WorkstationPanelName) => {
    setMaximized((prev) => (prev === name ? null : name));
  }, []);

  const applyDock = useCallback((action: Parameters<typeof reduceDock>[1]) => {
    setDock((prev) => {
      const next = reduceDock(prev, action);
      writeDockState(next);
      return next;
    });
  }, []);

  const openDockModule = useCallback(
    (key: DockModuleKey) => {
      applyDock({ type: "open", key });
      const panelName: WorkstationPanelName | null =
        key === "incident_picture"
          ? "intelligence"
          : (WORKSTATION_PANELS as readonly string[]).includes(key)
            ? (key as WorkstationPanelName)
            : null;
      if (!panelName) return;
      setCollapsed((prev) => {
        if (!prev[panelName]) return prev;
        writeCollapsed(panelName, false);
        return { ...prev, [panelName]: false };
      });
    },
    [applyDock],
  );

  const toggleDockSplit = useCallback(() => applyDock({ type: "toggleSplit" }), [applyDock]);
  const swapDockSlots = useCallback(() => applyDock({ type: "swap" }), [applyDock]);
  const focusDockSlot = useCallback(
    (slot: DockFocusedSlot) => applyDock({ type: "focus", slot }),
    [applyDock],
  );
  const closeDockSlot = useCallback(
    (slot: DockFocusedSlot) => applyDock({ type: "close", slot }),
    [applyDock],
  );

  return {
    queueWidth,
    contextWidth,
    transcriptHeight,
    collapsed,
    maximized,
    dock,
    setQueueWidth,
    setContextWidth,
    setTranscriptHeight,
    toggleCollapsed,
    toggleMaximize,
    setMaximized,
    openDockModule,
    toggleDockSplit,
    swapDockSlots,
    focusDockSlot,
    closeDockSlot,
  };
}

export function startHorizontalResize(
  startX: number,
  startWidth: number,
  invert: boolean,
  onChange: (w: number) => void,
) {
  const onMove = (e: MouseEvent) => {
    const dx = e.clientX - startX;
    onChange(startWidth + (invert ? -dx : dx));
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

export function startVerticalResize(
  startY: number,
  startHeight: number,
  onChange: (h: number) => void,
) {
  const onMove = (e: MouseEvent) => {
    onChange(startHeight + (e.clientY - startY));
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}
