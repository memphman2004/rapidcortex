"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const MIN = 0.3;
const MAX = 0.7;
const DEFAULT = 0.5;

export function clampSplitRatio(ratio: number): number {
  if (Number.isNaN(ratio)) return DEFAULT;
  return Math.min(MAX, Math.max(MIN, ratio));
}

/**
 * Split layout that keeps both panes mounted (Mapbox must not remount).
 * Hidden panes use `display: none` so ResizeObserver refits the canvas when shown.
 */
export function ResizableMapSplit({
  ratio,
  onRatioChange,
  stacked,
  left,
  right,
  leftHidden,
  rightHidden,
}: {
  ratio: number;
  onRatioChange: (next: number) => void;
  stacked: boolean;
  left: ReactNode;
  right: ReactNode;
  leftHidden?: boolean;
  rightHidden?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [active, setActive] = useState(false);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragging.current || !rootRef.current) return;
      const box = rootRef.current.getBoundingClientRect();
      if (stacked) {
        onRatioChange(clampSplitRatio((event.clientY - box.top) / box.height));
        return;
      }
      onRatioChange(clampSplitRatio((event.clientX - box.left) / box.width));
    },
    [onRatioChange, stacked],
  );

  const stop = useCallback(() => {
    dragging.current = false;
    setActive(false);
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stop);
    };
  }, [onPointerMove, stop]);

  const splitVisible = !leftHidden && !rightHidden;
  const leftPct = `${Math.round(ratio * 1000) / 10}%`;
  const rightPct = `${Math.round((1 - ratio) * 1000) / 10}%`;

  return (
    <div
      ref={rootRef}
      className={`flex h-full min-h-0 ${stacked && splitVisible ? "flex-col" : "flex-row"}`}
    >
      <div
        className="min-h-0 min-w-0"
        style={
          leftHidden
            ? { display: "none" }
            : rightHidden
              ? { flex: 1, width: "100%", height: "100%" }
              : stacked
                ? { height: leftPct, width: "100%" }
                : { width: leftPct, height: "100%" }
        }
      >
        {left}
      </div>
      <button
        type="button"
        aria-label="Resize map panels"
        aria-hidden={!splitVisible}
        tabIndex={splitVisible ? 0 : -1}
        onPointerDown={(event) => {
          if (!splitVisible) return;
          event.preventDefault();
          dragging.current = true;
          setActive(true);
        }}
        className={`shrink-0 bg-slate-800 hover:bg-orange-600/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${
          stacked ? "h-1.5 w-full cursor-row-resize" : "h-full w-1.5 cursor-col-resize"
        } ${active ? "bg-orange-500" : ""}`}
        style={{ display: splitVisible ? undefined : "none" }}
      />
      <div
        className="min-h-0 min-w-0"
        style={
          rightHidden
            ? { display: "none" }
            : leftHidden
              ? { flex: 1, width: "100%", height: "100%" }
              : stacked
                ? { height: rightPct, width: "100%", flex: 1 }
                : { width: rightPct, height: "100%", flex: 1 }
        }
      >
        {right}
      </div>
    </div>
  );
}
