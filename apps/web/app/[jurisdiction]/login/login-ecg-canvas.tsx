"use client";

import { useEffect, useRef } from "react";
import { EcgMonitor } from "./ecg-monitor";

/**
 * Live Lead II-style ECG strip for the agency login page.
 * Replaces the previous CSS translateX zigzag feed.
 */
export function LoginEcgCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let monitor: EcgMonitor | null = null;
    let ro: ResizeObserver | null = null;

    const syncSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const cssW = Math.max(1, rect.width);
      const cssH = Math.max(1, rect.height);
      const nextW = Math.floor(cssW * dpr);
      const nextH = Math.floor(cssH * dpr);
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
      return dpr;
    };

    const start = () => {
      monitor?.stop();
      const dpr = syncSize();
      // Speed is in canvas pixels/s so ~200 CSS px/s on retina.
      monitor = new EcgMonitor(canvas, { speed: 200 * dpr });
      if (!reduceMotion.matches) monitor.start();
      else monitor.resize();
    };

    start();

    ro = new ResizeObserver(() => {
      const dpr = syncSize();
      if (!monitor) return;
      const wasRunning = !reduceMotion.matches;
      monitor.stop();
      monitor = new EcgMonitor(canvas, { speed: 200 * dpr });
      if (wasRunning) monitor.start();
      else monitor.resize();
    });
    ro.observe(canvas);

    const onMotionChange = () => {
      if (!monitor) return;
      if (reduceMotion.matches) monitor.stop();
      else monitor.start();
    };
    reduceMotion.addEventListener("change", onMotionChange);

    return () => {
      reduceMotion.removeEventListener("change", onMotionChange);
      ro?.disconnect();
      monitor?.stop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="rc-login-page__ecg-canvas"
      aria-hidden="true"
    />
  );
}
