"use client";

export function CameraStatusBadge({ status }: { status: "online" | "offline" | "unknown" | string }) {
  const online = status === "online";
  const color = online ? "#10b981" : status === "offline" ? "#ef4444" : "#f59e0b";
  return (
    <span className="inline-flex items-center gap-1.5" title={status}>
      <span
        className={online ? "h-1.5 w-1.5 rounded-full animate-pulse" : "h-1.5 w-1.5 rounded-full"}
        style={{ background: color }}
      />
      <span className="text-[9px] font-normal uppercase tracking-wide" style={{ color: "#8b7bb5" }}>
        {status}
      </span>
    </span>
  );
}
