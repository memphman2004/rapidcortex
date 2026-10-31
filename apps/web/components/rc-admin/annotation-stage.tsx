"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  type BoxHandle,
  boxesMatch,
  boxFromDrag,
  fittedImageSize,
  inspectPreviewPixels,
  moveStudioBox,
  pointInsideBox,
  resizeStudioBox,
  type NormPoint,
} from "@/lib/rapid-vision/annotation-geometry";
import type { StudioBox } from "@/lib/rapid-vision/studio-dataset";

export type PreviewInspection = "loading" | "ready" | "black" | "failed" | "unreadable";

type Drag =
  | { kind: "draw"; start: NormPoint; previous: StudioBox | null }
  | { kind: "move"; start: NormPoint; box: StudioBox }
  | { kind: "resize"; handle: BoxHandle; start: NormPoint; box: StudioBox }
  | { kind: "pan"; x: number; y: number; panX: number; panY: number };

const HANDLES: BoxHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

type AnnotationStageProps = {
  src: string;
  candidateId: string;
  box: StudioBox | null;
  onBoxChange: (box: StudioBox | null) => void;
  onCommit: (box: StudioBox | null) => void;
  brightness: number;
  contrast: number;
  magnifier: boolean;
  onInspection: (state: PreviewInspection) => void;
};

export function AnnotationStage({
  src,
  candidateId,
  box,
  onBoxChange,
  onCommit,
  brightness,
  contrast,
  magnifier,
  onInspection,
}: AnnotationStageProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const latestRef = useRef<StudioBox | null>(box);
  const onInspectionRef = useRef(onInspection);
  latestRef.current = box;
  onInspectionRef.current = onInspection;
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [fitted, setFitted] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [inspection, setInspection] = useState<PreviewInspection>("loading");
  const [cursor, setCursor] = useState<NormPoint | null>(null);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const filter = `brightness(${brightness}) contrast(${contrast})`;

  useEffect(() => {
    setNatural(null);
    setFitted({ width: 0, height: 0 });
    setInspection("loading");
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCursor(null);
    onInspectionRef.current("loading");
    const probe = new Image();
    let cancelled = false;
    probe.onload = () => {
      if (cancelled) return;
      setNatural({ width: probe.naturalWidth, height: probe.naturalHeight });
    };
    probe.onerror = () => {
      if (cancelled) return;
      setInspection("failed");
      onInspectionRef.current("failed");
    };
    probe.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      if (!natural) return;
      setFitted(fittedImageSize(viewport.clientWidth - 24, viewport.clientHeight - 24, natural.width, natural.height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [natural]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom((value) => clampZoom(value * 1.2));
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoom((value) => clampZoom(value / 1.2));
      } else if (event.key === "0") {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        void toggleFullscreen();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (!box) return;
        event.preventDefault();
        onBoxChange(null);
        onCommit(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [box, onBoxChange, onCommit]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((value) => clampZoom(value * (event.deltaY < 0 ? 1.12 : 0.9)));
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    let startDistance = 0;
    let startZoom = 1;
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      startDistance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
      startZoom = zoomRef.current;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || startDistance < 1) return;
      event.preventDefault();
      const distance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
      setZoom(clampZoom(startZoom * (distance / startDistance)));
    };
    viewport.addEventListener("touchstart", onTouchStart);
    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  function toggleFullscreen() {
    const frame = frameRef.current;
    if (!frame) return;
    if (document.fullscreenElement === frame) {
      void document.exitFullscreen();
      setFullscreen(false);
      return;
    }
    void frame.requestFullscreen().then(() => setFullscreen(true)).catch(() => setFullscreen(false));
  }

  function normFromClient(clientX: number, clientY: number): NormPoint | null {
    const image = imageRef.current;
    if (!image) return null;
    const rect = image.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const point = normFromClient(event.clientX, event.clientY);
    if (!point) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable for some synthetic or touch sequences. The drag still tracks move and up.
    }
    if (event.shiftKey) {
      dragRef.current = { kind: "pan", x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
      return;
    }
    const image = imageRef.current;
    const handle = image && box ? hitHandle(event.clientX, event.clientY, box, image.getBoundingClientRect()) : null;
    if (box && handle) {
      dragRef.current = { kind: "resize", handle, start: point, box };
      return;
    }
    if (box && pointInsideBox(point, box)) {
      dragRef.current = { kind: "move", start: point, box };
      return;
    }
    if (point.x < 0 || point.y < 0 || point.x > 1 || point.y > 1) return;
    dragRef.current = { kind: "draw", start: point, previous: box };
    latestRef.current = box;
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const point = normFromClient(event.clientX, event.clientY);
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (viewport && point && point.x >= 0 && point.y <= 1 && point.x <= 1 && point.y >= 0) {
      setCursor(point);
      setLens({ x: event.clientX - viewport.left, y: event.clientY - viewport.top });
    } else if (!dragRef.current) {
      setCursor(null);
      setLens(null);
    }
    const drag = dragRef.current;
    if (!drag || !point) return;
    if (drag.kind === "pan") {
      setPan({ x: drag.panX + event.clientX - drag.x, y: drag.panY + event.clientY - drag.y });
      return;
    }
    if (drag.kind === "draw") {
      const next = boxFromDrag(drag.start, point);
      if (next) {
        latestRef.current = next;
        onBoxChange(next);
      }
      return;
    }
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    const next = drag.kind === "move" ? moveStudioBox(drag.box, dx, dy) : resizeStudioBox(drag.box, drag.handle, dx, dy);
    latestRef.current = next;
    onBoxChange(next);
  }

  function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.kind === "pan") return;
    if (drag.kind === "draw") {
      const next = latestRef.current;
      if (!next || boxesMatch(next, drag.previous)) {
        latestRef.current = drag.previous;
        onBoxChange(drag.previous);
        return;
      }
    }
    onCommit(latestRef.current);
  }

  const imageRect = imageRef.current?.getBoundingClientRect();

  return (
    <div ref={frameRef} className="flex min-h-[70vh] flex-col rounded-xl border border-slate-800 bg-slate-950">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2 text-xs">
        <span className="text-slate-400">{Math.round(zoom * 100)}%</span>
        <ToolbarButton onClick={() => setZoom((value) => clampZoom(value / 1.2))}>Zoom out</ToolbarButton>
        <ToolbarButton onClick={() => setZoom((value) => clampZoom(value * 1.2))}>Zoom in</ToolbarButton>
        <ToolbarButton onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Fit</ToolbarButton>
        <ToolbarButton onClick={() => void toggleFullscreen()}>{fullscreen ? "Exit full screen" : "Full screen"}</ToolbarButton>
        <span className="text-slate-500">Shift-drag pans. Scroll zooms. Delete removes the box.</span>
      </div>
      <div
        ref={viewportRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-black"
        role="application"
        aria-label="Annotation canvas"
        tabIndex={0}
        style={{ minHeight: fullscreen ? "100%" : "62vh", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {fitted.width > 0 ? (
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center center" }}>
            <div className="relative" style={{ width: fitted.width, height: fitted.height }}>
              {/* The preview filter stays on this element. The stored file is not rewritten. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={src}
                alt={`Training image ${candidateId}`}
                draggable={false}
                className="block h-full w-full select-none"
                style={{ filter }}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  setNatural({ width: image.naturalWidth, height: image.naturalHeight });
                  const next = inspectImageElement(image);
                  setInspection(next);
                  onInspection(next);
                }}
                onError={() => {
                  setInspection("failed");
                  onInspection("failed");
                }}
              />
              {box && box.width > 0 && box.height > 0 ? (
                <>
                  <div
                    className="absolute border-2 border-amber-300 bg-amber-300/10"
                    style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}
                  />
                  {HANDLES.map((handle) => (
                    <span
                      key={handle}
                      className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-slate-950 bg-amber-200"
                      style={handleStyle(handle, box)}
                    />
                  ))}
                </>
              ) : null}
            </div>
          </div>
        ) : inspection === "failed" ? null : (
          <p className="text-sm text-slate-400">Loading the full image…</p>
        )}
        {inspection === "failed" ? (
          <p className="absolute inset-x-6 bottom-6 rounded-lg border border-rose-700 bg-rose-950/90 px-3 py-2 text-sm text-rose-100">
            The preview failed to load. No pixels were drawn, so this candidate cannot be verified from this image.
          </p>
        ) : null}
        {inspection === "black" ? (
          <p className="absolute inset-x-6 bottom-6 rounded-lg border border-amber-700 bg-amber-950/90 px-3 py-2 text-sm text-amber-100">
            This preview is almost black. Brightness and contrast change only what you see. If the object stays invisible, reject the candidate or request another review.
          </p>
        ) : null}
        {inspection === "unreadable" ? (
          <p className="absolute inset-x-6 bottom-6 rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2 text-sm text-slate-200">
            The image loaded, but its pixels could not be inspected for a failed or black preview.
          </p>
        ) : null}
        {magnifier && cursor && lens && imageRect ? (
          <div
            className="pointer-events-none absolute z-10 h-36 w-36 overflow-hidden rounded-full border-2 border-white shadow-xl"
            style={{ left: Math.min(lens.x + 18, (viewportRef.current?.clientWidth ?? 200) - 156), top: Math.max(8, lens.y - 72) }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className="max-w-none"
              style={{
                width: imageRect.width * 4,
                height: imageRect.height * 4,
                marginLeft: -(cursor.x * imageRect.width * 4 - 72),
                marginTop: -(cursor.y * imageRect.height * 4 - 72),
                filter,
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToolbarButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded border border-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-800">
      {children}
    </button>
  );
}

function clampZoom(value: number): number {
  return Math.min(8, Math.max(1, value));
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;
}

function handleStyle(handle: BoxHandle, box: StudioBox): { left: string; top: string } {
  const x = handle.includes("w") ? box.x : handle.includes("e") ? box.x + box.width : box.x + box.width / 2;
  const y = handle.includes("n") ? box.y : handle.includes("s") ? box.y + box.height : box.y + box.height / 2;
  return { left: `${x * 100}%`, top: `${y * 100}%` };
}

function hitHandle(clientX: number, clientY: number, box: StudioBox, rect: DOMRect): BoxHandle | null {
  let found: BoxHandle | null = null;
  let best = 14;
  for (const handle of HANDLES) {
    const spot = handleStyle(handle, box);
    const x = rect.left + (parseFloat(spot.left) / 100) * rect.width;
    const y = rect.top + (parseFloat(spot.top) / 100) * rect.height;
    const distance = Math.hypot(clientX - x, clientY - y);
    if (distance <= best) {
      best = distance;
      found = handle;
    }
  }
  return found;
}

export function inspectImageElement(image: HTMLImageElement): PreviewInspection {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return "unreadable";
    context.drawImage(image, 0, 0, 32, 32);
    return inspectPreviewPixels(context.getImageData(0, 0, 32, 32).data);
  } catch {
    return "unreadable";
  }
}
