"use client";

import { Camera } from "lucide-react";
import { useState } from "react";
import { AvailableRingCamerasModal } from "./AvailableRingCamerasModal";
import { isRingAvailableCamerasEnabled } from "./ring-feature-flags";
import type { RingRole } from "./ring-types";

const AUTHORIZED_ROLES: RingRole[] = [
  "dispatcher",
  "supervisor",
  "command",
  "admin",
  "emergency_manager",
  "rc_admin",
];

export function ViewAvailableRingCamerasButton({
  incidentId,
  incidentLatitude,
  incidentLongitude,
  userRole,
}: {
  incidentId: string | null;
  incidentLatitude: number | null;
  incidentLongitude: number | null;
  userRole: RingRole;
}) {
  const [open, setOpen] = useState(false);

  if (!isRingAvailableCamerasEnabled()) return null;
  if (!AUTHORIZED_ROLES.includes(userRole)) return null;

  const missingIncident = !incidentId;
  const missingLocation = incidentLatitude == null || incidentLongitude == null;
  const disabled = missingIncident || missingLocation;
  const tooltip = missingIncident
    ? "Requires an active incident."
    : missingLocation
      ? "Incident location required."
      : "";

  return (
    <>
      <button
        type="button"
        title={tooltip}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded border border-[#2A3A4A] bg-[#1E2A3A] px-3 py-1.5 text-sm text-[#F0F4F8] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Camera size={14} />
        View Available Ring Cameras
      </button>
      {open && incidentId && incidentLatitude != null && incidentLongitude != null ? (
        <AvailableRingCamerasModal
          incidentId={incidentId}
          incidentLatitude={incidentLatitude}
          incidentLongitude={incidentLongitude}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
