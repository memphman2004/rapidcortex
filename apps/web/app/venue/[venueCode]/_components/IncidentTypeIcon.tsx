import { AlertCircle, Heart, HelpCircle, Shield, UserSearch, Wrench } from "lucide-react";
import type { IncidentType } from "../_lib/venue-types";

const iconByType: Record<
  IncidentType,
  { icon: React.ComponentType<{ className?: string }>; colorClass: string; label: string }
> = {
  medical: { icon: Heart, colorClass: "text-red-400", label: "Medical" },
  security: { icon: Shield, colorClass: "text-amber-400", label: "Security" },
  lost_person: { icon: UserSearch, colorClass: "text-sky-400", label: "Lost Person" },
  maintenance: { icon: Wrench, colorClass: "text-slate-400", label: "Maintenance" },
  guest_services: { icon: HelpCircle, colorClass: "text-emerald-400", label: "Guest Services" },
  other: { icon: AlertCircle, colorClass: "text-slate-400", label: "Other" },
};

export function IncidentTypeIcon({ type, className }: { type: IncidentType; className?: string }) {
  const config = iconByType[type];
  const Icon = config.icon;

  return <Icon className={`h-4 w-4 ${config.colorClass} ${className ?? ""}`} aria-label={config.label} />;
}

export function incidentTypeLabel(type: IncidentType): string {
  return iconByType[type].label;
}
