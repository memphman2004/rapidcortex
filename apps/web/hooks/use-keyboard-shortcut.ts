"use client";

import { useEffect } from "react";

type ModifierKey = "alt" | "ctrl" | "meta" | "shift";

export interface ShortcutOptions {
  key: string;
  modifiers?: ModifierKey[];
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Registers a global keyboard shortcut.
 * Extra modifiers not listed in `modifiers` block the shortcut (Alt+N won't fire on Alt+Shift+N).
 */
export function useKeyboardShortcut(
  options: ShortcutOptions,
  handler: (e: KeyboardEvent) => void,
): void {
  const { key, modifiers = [], enabled = true, preventDefault = true } = options;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;

      const modMap: Record<ModifierKey, boolean> = {
        alt: e.altKey,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        shift: e.shiftKey,
      };

      const allModifiersHeld = modifiers.every((mod) => modMap[mod]);
      const noExtraModifiers = (["alt", "ctrl", "meta", "shift"] as ModifierKey[])
        .filter((m) => !modifiers.includes(m))
        .every((m) => !modMap[m]);

      if (!allModifiersHeld || !noExtraModifiers) return;

      if (preventDefault) e.preventDefault();
      handler(e);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, handler, key, modifiers, preventDefault]);
}
