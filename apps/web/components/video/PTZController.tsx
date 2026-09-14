"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoPtzDirection } from "rapid-cortex-shared";
import { sendPtzMove, sendPtzStop, sendPtzZoom } from "@/lib/video/ptz-api";
import { PTZPresetPanel } from "./PTZPresetPanel";

const PAD: Array<{ direction: VideoPtzDirection | "stop"; label: string }> = [
  { direction: "up-left", label: "↖" },
  { direction: "up", label: "↑" },
  { direction: "up-right", label: "↗" },
  { direction: "left", label: "←" },
  { direction: "stop", label: "⊙" },
  { direction: "right", label: "→" },
  { direction: "down-left", label: "↙" },
  { direction: "down", label: "↓" },
  { direction: "down-right", label: "↘" },
];

export function PTZController({
  agencyId,
  cameraId,
}: {
  agencyId: string;
  cameraId: string;
}) {
  const [speed, setSpeed] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const focused = useRef<HTMLDivElement>(null);
  const speedRef = useRef(speed);
  const heldKeys = useRef(new Set<string>());
  speedRef.current = speed;

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setError(null);
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "PTZ command failed");
      }
    },
    [],
  );

  const holdMove = useCallback(
    (direction: VideoPtzDirection) => {
      void run(() => sendPtzMove(agencyId, cameraId, direction, speedRef.current));
    },
    [agencyId, cameraId, run],
  );

  const release = useCallback(() => {
    void run(() => sendPtzStop(agencyId, cameraId));
  }, [agencyId, cameraId, run]);

  useEffect(() => {
    const el = focused.current;
    if (!el) return;
    function onKey(e: KeyboardEvent) {
      if (heldKeys.current.has(e.key)) {
        if (e.key.startsWith("Arrow") || e.key === " " || e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
          e.preventDefault();
        }
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        heldKeys.current.add(e.key);
        holdMove("up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        heldKeys.current.add(e.key);
        holdMove("down");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        heldKeys.current.add(e.key);
        holdMove("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        heldKeys.current.add(e.key);
        holdMove("right");
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        heldKeys.current.add(e.key);
        void run(() => sendPtzZoom(agencyId, cameraId, "in", speedRef.current));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        heldKeys.current.add(e.key);
        void run(() => sendPtzZoom(agencyId, cameraId, "out", speedRef.current));
      } else if (e.key === " ") {
        e.preventDefault();
        heldKeys.current.add(e.key);
        release();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      heldKeys.current.delete(e.key);
      if (e.key.startsWith("Arrow") || e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
        release();
      }
    }
    el.addEventListener("keydown", onKey);
    el.addEventListener("keyup", onKeyUp);
    return () => {
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("keyup", onKeyUp);
    };
  }, [agencyId, cameraId, holdMove, release, run]);

  return (
    <div ref={focused} tabIndex={0} className="outline-none" aria-label="PTZ controls">
      <div className="mb-2 text-[10px] uppercase" style={{ color: "#8b7bb5" }}>
        PTZ via on-prem gateway
      </div>
      <div className="grid grid-cols-3 gap-1">
        {PAD.map((cell) => (
          <button
            key={cell.label}
            type="button"
            className="rounded py-2 text-sm"
            style={{ background: "#1a1528", color: "#c4b5fd" }}
            onMouseDown={() => {
              if (cell.direction === "stop") release();
              else holdMove(cell.direction);
            }}
            onMouseUp={release}
            onMouseLeave={release}
            onTouchStart={() => {
              if (cell.direction === "stop") release();
              else holdMove(cell.direction);
            }}
            onTouchEnd={release}
          >
            {cell.label}
          </button>
        ))}
      </div>
      <label className="mt-3 flex flex-col gap-1 text-[10px] uppercase" style={{ color: "#8b7bb5" }}>
        Zoom
        <span className="flex gap-1">
          <button
            type="button"
            className="flex-1 rounded py-1"
            style={{ background: "#1a1528", color: "#c4b5fd" }}
            onMouseDown={() => void run(() => sendPtzZoom(agencyId, cameraId, "in", speed))}
            onMouseUp={release}
          >
            +
          </button>
          <button
            type="button"
            className="flex-1 rounded py-1"
            style={{ background: "#1a1528", color: "#c4b5fd" }}
            onMouseDown={() => void run(() => sendPtzZoom(agencyId, cameraId, "out", speed))}
            onMouseUp={release}
          >
            −
          </button>
        </span>
      </label>
      <label className="mt-3 flex flex-col gap-1 text-[10px] uppercase" style={{ color: "#8b7bb5" }}>
        Speed {speed}
        <input
          type="range"
          min={1}
          max={5}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
      </label>
      <PTZPresetPanel agencyId={agencyId} cameraId={cameraId} />
      {error ? (
        <p className="mt-2 text-[10px]" style={{ color: "#fca5a5" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
