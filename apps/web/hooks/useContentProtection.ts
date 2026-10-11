"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAllowedDragTarget } from "./content-protection-drag";

export type ViolationType =
  | "right_click"
  | "copy"
  | "cut"
  | "drag_text"
  | "keyboard_shortcut"
  | "print_dialog"
  | "devtools_open"
  | "screen_share_started"
  | "screen_share_stopped"
  | "window_focus_lost"
  | "page_visibility_hidden"
  | "text_selection"
  | "terms_acknowledged";

export type ViolationPayload = {
  eventType: ViolationType;
  keyCombo?: string;
  pageUrl: string;
  userAgent: string;
  timestamp: string;
  selectedText?: string;
};

type Options = {
  enabled?: boolean;
  /** When true, content blur fires on window blur (disabled in demo mode). */
  blurOnFocusLoss?: boolean;
  /** When true, patch getDisplayMedia and obscure during share (disabled in demo mode). */
  hideOnScreenShare?: boolean;
  /** Still block copy/cut/print even in demo mode. */
  blockExtraction?: boolean;
  onViolation?: (type: ViolationType) => void;
};

export type ProtectionState = {
  isScreenShareActive: boolean;
  isWindowFocused: boolean;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function useContentProtection({
  enabled = true,
  blurOnFocusLoss = true,
  hideOnScreenShare = true,
  blockExtraction = true,
  onViolation,
}: Options = {}): ProtectionState {
  const [isScreenShareActive, setIsScreenShareActive] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const buffer = useRef<ViolationPayload[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastViolation = useRef<Record<string, number>>({});

  const flush = useCallback(async () => {
    const batch = [...buffer.current];
    buffer.current = [];
    if (!batch.length) return;
    try {
      await fetch("/api/security/log-violation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ violations: batch }),
        keepalive: true,
        credentials: "include",
      });
    } catch {
      /* never surface logging */
    }
  }, []);

  const queue = useCallback(
    (payload: ViolationPayload) => {
      const now = Date.now();
      const last = lastViolation.current[payload.eventType] ?? 0;
      if (now - last < 2000) return;
      lastViolation.current[payload.eventType] = now;
      buffer.current.push(payload);
      clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => void flush(), 600);
      onViolation?.(payload.eventType);
    },
    [flush, onViolation],
  );

  const build = useCallback(
    (eventType: ViolationType, extra?: Partial<ViolationPayload>): ViolationPayload => ({
      eventType,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      ...extra,
    }),
    [],
  );

  useEffect(() => {
    if (!enabled || !hideOnScreenShare) return;
    if (!navigator.mediaDevices?.getDisplayMedia) return;

    const original = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia = async (constraints?: DisplayMediaStreamOptions) => {
      queue(build("screen_share_started"));
      setIsScreenShareActive(true);
      try {
        const stream = await original(constraints);
        for (const track of stream.getTracks()) {
          track.addEventListener("ended", () => {
            setIsScreenShareActive(false);
            queue(build("screen_share_stopped"));
          });
        }
        return stream;
      } catch (err) {
        setIsScreenShareActive(false);
        throw err;
      }
    };

    return () => {
      navigator.mediaDevices.getDisplayMedia = original;
    };
  }, [enabled, hideOnScreenShare, build, queue]);

  useEffect(() => {
    if (!enabled) return;

    const onContextMenu = (e: MouseEvent) => {
      if (isEditableTarget(e.target)) return;
      if (!blockExtraction) return;
      e.preventDefault();
      queue(build("right_click"));
    };

    const onCopy = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (!blockExtraction) return;
      e.preventDefault();
      const selected = window.getSelection()?.toString().slice(0, 100);
      queue(build("copy", { selectedText: selected }));
    };

    const onCut = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (!blockExtraction) return;
      e.preventDefault();
      queue(build("cut"));
    };

    const onDrag = (e: DragEvent) => {
      // Allow Kanban / UI drag handles; still block free-text drag-to-extract.
      if (isAllowedDragTarget(e.target)) return;
      if (!blockExtraction) return;
      e.preventDefault();
      queue(build("drag_text"));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (!blockExtraction) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const blocked =
        (mod && ["c", "p", "u", "s"].includes(key)) ||
        key === "f12" ||
        key === "printscreen";
      if (!blocked) return;
      e.preventDefault();
      e.stopPropagation();
      const keyCombo = [
        e.ctrlKey ? "Ctrl" : "",
        e.metaKey ? "Cmd" : "",
        e.shiftKey ? "Shift" : "",
        e.key,
      ]
        .filter(Boolean)
        .join("+");
      queue(build("keyboard_shortcut", { keyCombo }));
    };

    const onBeforePrint = () => queue(build("print_dialog"));

    const onBlur = () => {
      if (!blurOnFocusLoss) return;
      setIsWindowFocused(false);
      queue(build("window_focus_lost"));
    };

    const onFocus = () => setIsWindowFocused(true);

    const onVisibilityChange = () => {
      if (document.hidden) queue(build("page_visibility_hidden"));
    };

    const devCheck = window.setInterval(() => {
      if (
        window.outerWidth - window.innerWidth > 160 ||
        window.outerHeight - window.innerHeight > 160
      ) {
        queue(build("devtools_open"));
      }
    }, 4000);

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("dragstart", onDrag);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("dragstart", onDrag);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(devCheck);
      clearTimeout(flushTimer.current);
    };
  }, [enabled, blockExtraction, blurOnFocusLoss, build, queue]);

  return { isScreenShareActive, isWindowFocused };
}
