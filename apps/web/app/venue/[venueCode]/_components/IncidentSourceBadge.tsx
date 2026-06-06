import { AlertTriangle, MessageSquare, Plus, QrCode } from "lucide-react";
import type { IncidentSource } from "../_lib/venue-types";

const sourceConfig: Record<IncidentSource, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  qr: { label: "QR Code", icon: QrCode },
  sms: { label: "SMS", icon: MessageSquare },
  manual: { label: "Manual", icon: Plus },
  escalated_from_core: { label: "Escalated", icon: AlertTriangle },
};

export function IncidentSourceBadge({
  source,
  className,
}: {
  source: IncidentSource;
  className?: string;
}) {
  const config = sourceConfig[source];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-900/50 px-2.5 py-1 text-[11px] font-semibold text-slate-200 ${className ?? ""}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
