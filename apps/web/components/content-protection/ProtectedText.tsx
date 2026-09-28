"use client";

import { useEffect, useRef } from "react";

type Props = {
  text: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  className?: string;
};

/** Canvas-rendered text — harder to select/scrape than DOM text. Use for high-value phrases only. */
export function ProtectedText({
  text,
  fontSize = 15,
  color = "#e2e8f0",
  fontFamily = "Inter, system-ui, sans-serif",
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.font = `${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    const w = metrics.width + 24;
    const h = fontSize + 16;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.fillText(text, 12, fontSize + 4);
  }, [text, fontSize, color, fontFamily]);

  return <canvas ref={canvasRef} className={className} aria-label={text} role="img" />;
}
