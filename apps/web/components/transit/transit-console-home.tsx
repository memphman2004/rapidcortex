"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { TransitAlertLevel, TransitOperator } from "rapid-cortex-shared";
import {
  canTransitDispatchOps,
  canTransitSupervisorOps,
} from "@/lib/vertical/supervisor-access";
import { TransitOperationsShell } from "./transit-operations-shell";
import { TransitAlertStrip } from "./transit-alert-strip";
import { TransitOperationsDashboard } from "./transit-operations-dashboard";
import { TransitVehiclePanel } from "./transit-vehicle-panel";
import { TransitFleetMap } from "./transit-fleet-map";
import { TransitVehicleDetailClient } from "./transit-vehicle-detail-client";
import { TransitRouteMonitor, TransitStationsPanel } from "./transit-route-monitor";
import { TransitIncidentList } from "./transit-incident-list";
import { TransitReportsTable } from "./transit-reports-table";
import {
  TransitSettingsCamerasPanel,
  TransitSettingsRoutesPanel,
  TransitSettingsVehiclesPanel,
} from "./transit-settings-panels";
import { CreateTransitIncidentModal, TransitBroadcastModal } from "./transit-ops-modals";
import { useTransitOpsData } from "./use-transit-ops-data";
import { T } from "./transit-theme";

export function TransitConsoleHome(props: {
  agencyId: string;
  transitCode: string;
  transitName: string;
  userEmail: string;
  userRole: string;
  userId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const linkBase = `/transit/${props.transitCode}`;
  const ops = useTransitOpsData(props.agencyId);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const canSupervisor = canTransitSupervisorOps(props.userRole);
  const canDispatch = canTransitDispatchOps(props.userRole);

  const vehicleId = useMemo(() => {
    const match = pathname.match(/\/fleet\/([^/]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }, [pathname]);

  const view = useMemo(() => {
    if (pathname.includes("/cameras")) return "cameras";
    if (pathname.includes("/settings/vehicles")) return "settings-vehicles";
    if (pathname.includes("/settings/routes")) return "settings-routes";
    if (pathname.includes("/settings")) return "settings";
    if (pathname.includes("/fleet/") && vehicleId) return "vehicle";
    if (pathname.includes("/fleet")) return "fleet";
    if (pathname.includes("/routes")) return "routes";
    if (pathname.includes("/stations")) return "stations";
    if (pathname.includes("/operators")) return "operators";
    if (pathname.includes("/incidents")) return "incidents";
    if (pathname.includes("/reports")) return "reports";
    return "home";
  }, [pathname, vehicleId]);

  const data = ops.data;
  const selectedVehicle = data?.vehicles.find((v) => v.vehicleId === vehicleId);

  return (
    <TransitOperationsShell
      transitName={props.transitName}
      linkBase={linkBase}
      userEmail={props.userEmail}
      userRole={props.userRole}
      agencyId={props.agencyId}
      userId={props.userId}
      alertLevel={data?.alert.level ?? "nominal"}
    >
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>
      <TransitAlertStrip
        level={data?.alert.level ?? "nominal"}
        canChange={canSupervisor}
        disabled={ops.isLoading}
        onChange={(level: TransitAlertLevel) => {
          void ops.setAlertLevel(level);
        }}
      />
      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 11, color: T.textSecondary, margin: "0 0 12px" }}>
          Not a 911 PSAP console. Transit operations only.
        </p>
        {ops.isLoading && !data ? (
          <div style={{ color: T.textSecondary }}>Loading fleet…</div>
        ) : ops.error && !data ? (
          <div style={{ color: T.red }}>{ops.error}</div>
        ) : data ? (
          <>
            {view === "home" ? (
              <TransitOperationsDashboard
                vehicles={data.vehicles}
                incidents={data.incidents}
                operators={data.operators}
                stats={data.stats}
                linkBase={linkBase}
                canDispatch={canDispatch}
                canSupervisor={canSupervisor}
                onNewIncident={() => setIncidentOpen(true)}
                onBroadcast={() => setBroadcastOpen(true)}
                onEscalate={(id) => void ops.patchIncident(id, { escalatedTo911: true })}
              />
            ) : null}
            {view === "fleet" ? (
              <>
                <TransitFleetMap
                  vehicles={data.vehicles}
                  onSelect={(id) => router.push(`${linkBase}/fleet/${encodeURIComponent(id)}`)}
                />
                <div style={{ height: 16 }} />
                <TransitVehiclePanel vehicles={data.vehicles} linkBase={linkBase} />
              </>
            ) : null}
            {view === "vehicle" && selectedVehicle ? (
              <TransitVehicleDetailClient
                agencyId={props.agencyId}
                vehicle={selectedVehicle}
                operator={data.operators.find((o) => o.operatorId === selectedVehicle.operatorId)}
                incidents={data.incidents.filter((i) => i.vehicleId === selectedVehicle.vehicleId)}
              />
            ) : null}
            {view === "vehicle" && vehicleId && !selectedVehicle && !ops.isLoading ? (
              <div style={{ color: T.textSecondary }}>Vehicle not found.</div>
            ) : null}
            {view === "routes" ? (
              <TransitRouteMonitor
                routes={data.routes}
                vehicles={data.vehicles}
                stations={data.stations}
                incidents={data.incidents}
              />
            ) : null}
            {view === "stations" ? (
              <TransitStationsPanel stations={data.stations} incidents={data.incidents} />
            ) : null}
            {view === "operators" ? <OperatorsPanel operators={data.operators} /> : null}
            {view === "incidents" ? (
              <>
                {canDispatch ? (
                  <button
                    type="button"
                    onClick={() => setIncidentOpen(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: T.blueDim,
                      color: T.blue,
                      border: `1px solid ${T.blue}`,
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      marginBottom: 12,
                    }}
                  >
                    <Plus size={14} /> New incident
                  </button>
                ) : null}
                <TransitIncidentList
                  incidents={data.incidents}
                  canEscalate={canSupervisor}
                  onEscalate={(id) => void ops.patchIncident(id, { escalatedTo911: true })}
                />
              </>
            ) : null}
            {view === "reports" ? <TransitReportsTable reports={data.reports} /> : null}
            {view === "settings-vehicles" ? (
              <TransitSettingsVehiclesPanel vehicles={data.vehicles} />
            ) : null}
            {view === "settings-routes" ? <TransitSettingsRoutesPanel routes={data.routes} /> : null}
            {view === "cameras" ? (
              <TransitSettingsCamerasPanel
                agencyId={props.agencyId}
                transitCode={props.transitCode}
                userId={props.userId}
                userRole={props.userRole}
                vehicles={data.vehicles}
              />
            ) : null}
            {view === "settings" ? (
              <p style={{ color: T.textSecondary, fontSize: 13 }}>
                Vehicle and route registries are managed from this agency’s seed/config APIs. Live
                cameras are on the Cameras page (ONVIF/RTSP → KVS, plus Ring/Nest Connect).
              </p>
            ) : null}
          </>
        ) : null}
      </div>
      <CreateTransitIncidentModal
        open={incidentOpen}
        vehicles={data?.vehicles ?? []}
        stations={data?.stations ?? []}
        onClose={() => setIncidentOpen(false)}
        onSubmit={ops.createIncident}
      />
      <TransitBroadcastModal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        onSubmit={ops.broadcast}
      />
    </TransitOperationsShell>
  );
}

function OperatorsPanel({ operators }: { operators: TransitOperator[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {operators.map((op) => (
        <li
          key={op.operatorId}
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: 10,
            fontSize: 13,
            color: T.textPrimary,
          }}
        >
          {op.displayName} · {op.onDuty ? "on duty" : "off"} {op.vehicleId ?? ""}
        </li>
      ))}
    </ul>
  );
}
