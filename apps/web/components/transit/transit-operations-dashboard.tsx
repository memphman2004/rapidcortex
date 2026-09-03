"use client";

import type { ReactNode } from "react";
import { Plus, Radio } from "lucide-react";
import type { TransitIncident, TransitOperator, TransitVehicle } from "rapid-cortex-shared";
import { TransitVehiclePanel } from "./transit-vehicle-panel";
import { TransitIncidentList } from "./transit-incident-list";
import { T } from "./transit-theme";

export function TransitOperationsDashboard(props: {
  vehicles: TransitVehicle[];
  incidents: TransitIncident[];
  operators: TransitOperator[];
  stats: {
    vehiclesInService: number;
    vehiclesDelayed: number;
    activeIncidents: number;
    operatorsOnDuty: number;
    passengerReportsToday: number;
  };
  linkBase: string;
  canDispatch: boolean;
  canSupervisor: boolean;
  onNewIncident: () => void;
  onBroadcast: () => void;
  onEscalate: (incidentId: string) => void;
}) {
  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {props.canDispatch ? (
          <button type="button" onClick={props.onNewIncident} style={actionBtn}>
            <Plus size={14} /> New incident
          </button>
        ) : null}
        {props.canSupervisor ? (
          <button type="button" onClick={props.onBroadcast} style={actionBtn}>
            <Radio size={14} /> Broadcast
          </button>
        ) : null}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <Kpi label="In service" value={props.stats.vehiclesInService} />
        <Kpi label="Delayed" value={props.stats.vehiclesDelayed} />
        <Kpi label="Incidents" value={props.stats.activeIncidents} />
        <Kpi label="Operators" value={props.stats.operatorsOnDuty} />
        <Kpi label="Passenger reports" value={props.stats.passengerReportsToday} />
      </div>
      <Section title="Fleet">
        <TransitVehiclePanel vehicles={props.vehicles} linkBase={props.linkBase} />
      </Section>
      <Section title="Active incidents">
        <TransitIncidentList
          incidents={props.incidents.filter((i) => i.status !== "closed" && i.status !== "resolved")}
          canEscalate={props.canSupervisor}
          onEscalate={props.onEscalate}
        />
      </Section>
      <Section title="On-duty operators">
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
          {props.operators
            .filter((o) => o.onDuty)
            .map((op) => (
              <li key={op.operatorId} style={{ fontSize: 13, color: T.textPrimary }}>
                {op.displayName}
                {op.vehicleId ? ` · ${op.vehicleId}` : ""}
                {op.radioCallsign ? ` · ${op.radioCallsign}` : ""}
              </li>
            ))}
        </ul>
      </Section>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: T.blue }}>{value}</div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: T.textSecondary,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h2
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: T.textSecondary,
          margin: "0 0 10px",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

const actionBtn = {
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
} as const;
