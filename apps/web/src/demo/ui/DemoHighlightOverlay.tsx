"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getCalloutCopy, getCalloutRevision, subscribeCallouts } from "../fixtures/callout-store";
import { getDemoPlaybackEngine } from "../engine/DemoPlaybackEngine";
import { useDemoHighlight } from "../hooks/useDemoEngine";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function DemoHighlightOverlay() {
  const highlight = useDemoHighlight();
  useSyncExternalStore(subscribeCallouts, getCalloutRevision, () => 0);
  const [box, setBox] = useState<Box | null>(null);
  const copy = highlight ? getCalloutCopy(highlight) : null;

  useEffect(() => {
    if (!highlight) {
      setBox(null);
      return;
    }
    const measure = () => {
      const target = document.querySelector(highlight.targetSelector);
      if (!target) {
        setBox(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [highlight]);

  if (!copy || !box) return null;

  const calloutStyle =
    copy.placement === "bottom"
      ? { top: box.top + box.height + 12, left: box.left }
      : copy.placement === "left"
        ? { top: box.top, left: Math.max(12, box.left - 320) }
        : copy.placement === "right"
          ? { top: box.top, left: box.left + box.width + 12 }
          : { top: Math.max(48, box.top - 132), left: box.left };

  const advance = () => {
    const engine = getDemoPlaybackEngine();
    if (copy.triggerMode === "manual") engine.advanceHighlight();
    else engine.dismissHighlight();
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[75]">
      <div
        data-demo-spotlight="true"
        className="pointer-events-none absolute rounded-lg ring-2 ring-amber-300"
        style={{
          top: box.top - 4,
          left: box.left - 4,
          width: box.width + 8,
          height: box.height + 8,
          boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.72)",
        }}
      />
      <div
        data-demo-callout="true"
        className="pointer-events-auto absolute w-72 rounded-lg border border-amber-300/50 bg-slate-950 p-3 text-slate-100 shadow-xl"
        style={calloutStyle}
      >
        <p className="text-sm font-semibold text-amber-200">{copy.title}</p>
        <p className="mt-1 text-sm leading-5 text-slate-300">{copy.description}</p>
        <button
          type="button"
          onClick={advance}
          className="mt-3 rounded bg-amber-400 px-2 py-1 text-xs font-semibold text-amber-950"
        >
          {copy.triggerMode === "manual" ? "Next" : "Dismiss"}
        </button>
      </div>
    </div>
  );
}
