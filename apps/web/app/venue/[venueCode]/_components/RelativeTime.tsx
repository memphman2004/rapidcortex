"use client";

import { useEffect, useMemo, useState } from "react";

function formatRelativeTime(iso: string, nowMs: number): string {
  const targetMs = new Date(iso).getTime();
  const deltaSeconds = Math.max(0, Math.floor((nowMs - targetMs) / 1000));

  if (deltaSeconds < 60) return "just now";
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)} min ago`;
  if (deltaSeconds < 86400) return `${Math.floor(deltaSeconds / 3600)} hr ago`;
  return `${Math.floor(deltaSeconds / 86400)} day ago`;
}

export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const label = useMemo(() => formatRelativeTime(iso, nowMs), [iso, nowMs]);
  return <span className={className}>{label}</span>;
}
