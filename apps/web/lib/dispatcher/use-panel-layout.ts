"use client";

/**
 * Rapid Cortex — Dispatcher Panel Layout
 *
 * Manages per-user panel order, width, and collapsed state.
 * Persists to localStorage keyed by userId so each dispatcher
 * keeps their own layout across sessions.
 */

import { useCallback, useEffect, useState } from "react";

export interface PanelDef {
  id: string;
  defaultWide: boolean;
}

export interface PanelLayoutState {
  /** Ordered list of panel IDs */
  order: string[];
  /** Map of panelId → boolean (true = spans full width) */
  wide: Record<string, boolean>;
  /** Map of panelId → boolean (true = collapsed to header only) */
  collapsed: Record<string, boolean>;
}

function storageKey(userId: string) {
  return `rc-panel-layout:${userId}`;
}

function buildDefault(panels: PanelDef[]): PanelLayoutState {
  return {
    order: panels.map((p) => p.id),
    wide: Object.fromEntries(panels.map((p) => [p.id, p.defaultWide])),
    collapsed: Object.fromEntries(panels.map((p) => [p.id, false])),
  };
}

function loadFromStorage(userId: string, panels: PanelDef[]): PanelLayoutState {
  const defaults = buildDefault(panels);
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PanelLayoutState>;

    const allIds = panels.map((p) => p.id);
    const savedIds = new Set(parsed.order ?? []);
    const order = [
      ...(parsed.order ?? []).filter((id) => allIds.includes(id)),
      ...allIds.filter((id) => !savedIds.has(id)),
    ];

    return {
      order,
      wide: { ...defaults.wide, ...(parsed.wide ?? {}) },
      collapsed: { ...defaults.collapsed, ...(parsed.collapsed ?? {}) },
    };
  } catch {
    return defaults;
  }
}

export function usePanelLayout(userId: string, panels: PanelDef[]) {
  const [state, setState] = useState<PanelLayoutState>(() => buildDefault(panels));

  useEffect(() => {
    setState(loadFromStorage(userId, panels));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const persist = useCallback(
    (next: PanelLayoutState) => {
      setState(next);
      try {
        localStorage.setItem(storageKey(userId), JSON.stringify(next));
      } catch {
        // Storage may be unavailable; state still updates in memory
      }
    },
    [userId],
  );

  const setOrder = useCallback(
    (order: string[]) => persist({ ...state, order }),
    [persist, state],
  );

  const toggleWide = useCallback(
    (id: string) =>
      persist({
        ...state,
        wide: { ...state.wide, [id]: !state.wide[id] },
      }),
    [persist, state],
  );

  const toggleCollapse = useCallback(
    (id: string) =>
      persist({
        ...state,
        collapsed: { ...state.collapsed, [id]: !state.collapsed[id] },
      }),
    [persist, state],
  );

  const resetLayout = useCallback(() => {
    const defaults = buildDefault(panels);
    persist(defaults);
  }, [panels, persist]);

  return {
    order: state.order,
    wide: state.wide,
    collapsed: state.collapsed,
    setOrder,
    toggleWide,
    toggleCollapse,
    resetLayout,
  };
}
