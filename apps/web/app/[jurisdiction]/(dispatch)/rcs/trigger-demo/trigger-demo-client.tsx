"use client";

/**
 * Design/QA sandbox for RCS components using mock call data (no live backend required
 * to review visual states). Action buttons may still hit `/api/rcs/*` BFF routes.
 */

import { useState } from "react";
import type { UserContext } from "rapid-cortex-shared/types";
import { RcsCallCard } from "@/components/rcs/RcsCallCard";
import { RcsSilentMonitorTrigger } from "@/components/rcs/RcsSilentMonitorTrigger";
import { RcsSupervisorStrip } from "@/components/rcs/RcsSupervisorStrip";
import { RCS_SURFACE } from "@/lib/rcs/rcs-colors";
import type { RcsCall } from "@/lib/rcs/rcs-api";

function mockCall(overrides: Partial<RcsCall>): RcsCall {
  const now = new Date().toISOString();
  return {
    callId: overrides.callId ?? "demo-call",
    agencyId: overrides.agencyId ?? "demo-agency",
    incidentId: overrides.incidentId ?? "demo-incident",
    state: "MONITORING",
    escalationLevel: "NONE",
    audioStatus: "SILENT",
    arrivalRadiusMeters: 150,
    units: [],
    createdAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    updatedAt: now,
    createdByUserId: "demo-dispatcher",
    assignedDispatcherId: "demo-dispatcher",
    ...overrides,
  };
}

export function RcsTriggerDemoClient({ user }: { user: UserContext }) {
  const [calls, setCalls] = useState<RcsCall[]>([
    mockCall({ callId: "demo-monitoring", state: "MONITORING", audioStatus: "SILENT" }),
    mockCall({
      callId: "demo-en-route",
      state: "UNIT_EN_ROUTE",
      audioStatus: "LISTENING",
      units: [
        {
          unitId: "M-12",
          callSign: "Medic 12",
          latitude: 33.75,
          longitude: -84.39,
          updatedAt: new Date().toISOString(),
          onScene: false,
          distanceMeters: 420,
        },
      ],
    }),
    mockCall({
      callId: "demo-audio-alert",
      state: "AUDIO_ALERT",
      audioStatus: "ALERT",
      escalationLevel: "LEVEL_1",
    }),
    mockCall({
      callId: "demo-escalated",
      state: "ESCALATED",
      audioStatus: "ALERT",
      escalationLevel: "LEVEL_2",
      supervisorAckByUserId: user.userId,
      supervisorAckAt: new Date().toISOString(),
    }),
    mockCall({
      callId: "demo-arrived",
      state: "UNIT_ARRIVED",
      audioStatus: "CONFIRMED_SAFE",
      units: [
        {
          unitId: "E-4",
          callSign: "Engine 4",
          latitude: 33.75,
          longitude: -84.39,
          updatedAt: new Date().toISOString(),
          onScene: true,
          distanceMeters: 40,
        },
      ],
    }),
  ]);

  function applyUpdate(updated: RcsCall) {
    setCalls((prev) => prev.map((c) => (c.callId === updated.callId ? updated : c)));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20, maxWidth: 1180 }}>
      <div>
        <h1 style={{ fontSize: 17, fontWeight: 700, color: RCS_SURFACE.heading, margin: 0 }}>
          RCS Component Demo
        </h1>
        <p style={{ fontSize: 12, color: RCS_SURFACE.subtleText, margin: "4px 0 0" }}>
          Mock data sandbox for reviewing RcsCallCard / RcsSilentMonitorTrigger / RcsSupervisorStrip.
          Not wired to production data.
        </p>
      </div>

      <RcsSilentMonitorTrigger user={user} compact incidentId="demo-incident" notes="Demo trigger" />

      <RcsSupervisorStrip calls={calls} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 12,
        }}
      >
        {calls.map((call) => (
          <RcsCallCard key={call.callId} call={call} user={user} onUpdated={applyUpdate} />
        ))}
      </div>
    </div>
  );
}
