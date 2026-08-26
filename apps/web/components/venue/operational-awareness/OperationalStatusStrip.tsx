"use client";

import { C } from "@/lib/theme/rc-theme-tokens";

export function OperationalStatusStrip({
  activeIncidents,
  staffOnDuty,
  camerasOnline,
  medicalResources,
  facilityAlerts,
}: {
  activeIncidents: number;
  staffOnDuty: number;
  camerasOnline: number;
  medicalResources: number;
  facilityAlerts: number;
}) {
  const items = [
    { label: "Active Incidents", value: activeIncidents, tone: activeIncidents > 0 ? C.red : C.green },
    { label: "Staff On Duty", value: staffOnDuty, tone: C.amber },
    { label: "Cameras Online", value: camerasOnline, tone: C.blue },
    { label: "Medical Resources", value: medicalResources, tone: "#a78bfa" },
    { label: "Facility Alerts", value: facilityAlerts, tone: facilityAlerts > 0 ? C.red : C.textMuted },
  ];

  return (
    <div
      className="grid grid-cols-5 gap-px"
      style={{ background: C.border, borderBottom: `1px solid ${C.border}` }}
      aria-label="Facility status"
    >
      {items.map((item) => (
        <div key={item.label} className="px-2 py-1.5" style={{ background: C.card }}>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            {item.label}
          </div>
          <div className="text-sm font-bold tabular-nums" style={{ color: item.tone }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
