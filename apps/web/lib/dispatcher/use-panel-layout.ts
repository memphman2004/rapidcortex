"use client";

/**
 * Rapid Cortex — Dispatcher Panel Layout
 *
 * Manages per-user panel order, width, and collapsed state.
 * Persists to localStorage keyed by userId so each dispatcher
 * keeps their own layout across browser sessions / logins.
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

function canPersist(userId: string): boolean {
  return Boolean(userId && userId !== "anonymous");
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
  if (!canPersist(userId) || typeof window === "undefined") return defaults;
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

function writeStorage(userId: string, next: PanelLayoutState) {
  if (!canPersist(userId) || typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // Storage may be unavailable; state still updates in memory
  }
}

export function usePanelLayout(userId: string, panels: PanelDef[]) {
  const [state, setState] = useState<PanelLayoutState>(() =>
    typeof window === "undefined" ? buildDefault(panels) : loadFromStorage(userId, panels),
  );

  // Re-load when the authenticated user becomes available (or changes).
  useEffect(() => {
    setState(loadFromStorage(userId, panels));
    // panels is a stable module-level constant in callers; userId is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setOrder = useCallback(
    (orderOrUpdater: string[] | ((prev: string[]) => string[])) => {
      setState((prev) => {
        const order =
          typeof orderOrUpdater === "function" ? orderOrUpdater(prev.order) : orderOrUpdater;
        if (order === prev.order) return prev;
        const next = { ...prev, order };
        writeStorage(userId, next);
        return next;
      });
    },
    [userId],
  );

  const toggleWide = useCallback(
    (id: string) => {
      setState((prev) => {
        const next = {
          ...prev,
          wide: { ...prev.wide, [id]: !prev.wide[id] },
        };
        writeStorage(userId, next);
        return next;
      });
    },
    [userId],
  );

  const toggleCollapse = useCallback(
    (id: string) => {
      setState((prev) => {
        const next = {
          ...prev,
          collapsed: { ...prev.collapsed, [id]: !prev.collapsed[id] },
        };
        writeStorage(userId, next);
        return next;
      });
    },
    [userId],
  );

  const resetLayout = useCallback(() => {
    const defaults = buildDefault(panels);
    setState(defaults);
    writeStorage(userId, defaults);
  }, [panels, userId]);

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
