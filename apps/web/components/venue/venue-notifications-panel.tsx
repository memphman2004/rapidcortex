"use client";

import { useState } from "react";
import { canVenueNotifications } from "@/lib/venue/venue-access";
import { NotifyStaffModal } from "@/components/venue/venue-ops-modals";

export function VenueNotificationsPanel({
  agencyId,
  userRole,
}: {
  agencyId: string;
  userRole?: string;
}) {
  const [open, setOpen] = useState(false);
  const allowed = canVenueNotifications(userRole);

  if (!allowed) {
    return (
      <div style={{ padding: 14 }}>
        <p style={{ color: "#5a4d7a", fontSize: 12 }}>Supervisor access required to compose notifications.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 14 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Notifications</h2>
      <p style={{ fontSize: 12, color: "#5a4d7a", marginBottom: 12 }}>
        Send staff alerts by section, gate, or all security personnel.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: "8px 14px",
          background: "#f59e0b",
          color: "#000",
          border: "none",
          borderRadius: 6,
          fontWeight: 700,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Compose notification
      </button>
      {open ? <NotifyStaffModal agencyId={agencyId} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
