"use client";

import type { RingRequestStatus } from "rapid-cortex-integrations/ring";

type BadgeStatus = RingRequestStatus | "AVAILABLE";

const STATUS_STYLES: Record<BadgeStatus, { color: string; label: string }> = {
  AVAILABLE: { color: "#00D4FF", label: "Available" },
  DRAFT: { color: "#8B9CB0", label: "Draft" },
  SENT: { color: "#F59E0B", label: "Request Sent" },
  OPENED: { color: "#F59E0B", label: "Opened" },
  APPROVED: { color: "#22C55E", label: "Temporary Access Approved" },
  DECLINED: { color: "#FF4444", label: "Owner Declined" },
  EXPIRED: { color: "#8B9CB0", label: "Request Expired" },
  REVOKED: { color: "#FF4444", label: "Access Revoked" },
};

export function RingCameraRequestStatusBadge({ status }: { status: BadgeStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px]"
      style={{ borderLeft: `3px solid ${style.color}` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: style.color }} />
      <span className="text-slate-100">{style.label}</span>
    </span>
  );
}
