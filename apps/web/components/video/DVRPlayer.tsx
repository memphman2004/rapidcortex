"use client";

import { useEffect, useRef } from "react";
import { attachHlsPlayback } from "@/lib/video/hls-player";

export function DVRPlayer({ src, label }: { src: string | null; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    let cancelled = false;
    let detach: (() => void) | undefined;
    void attachHlsPlayback(el, src)
      .then((fn) => {
        if (cancelled) fn();
        else detach = fn;
      })
      .catch(() => {
        /* native fallback already attempted inside attachHlsPlayback */
      });
    return () => {
      cancelled = true;
      detach?.();
    };
  }, [src]);

  return (
    <video
      ref={ref}
      className="h-full w-full bg-black object-contain"
      controls
      playsInline
      aria-label={label}
    />
  );
}
