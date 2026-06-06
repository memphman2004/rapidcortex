"use client";

import { useCallback, useEffect, useState } from "react";
import type { MciDistributionPlan, MciHospitalAllocation, MciPatient } from "rapid-cortex-shared";
import { RapidCortexMap } from "rapid-cortex-maps";
import type mapboxgl from "mapbox-gl";
import mapboxglLib from "mapbox-gl";

import { activateMciPlan } from "@/lib/hospital-routing/api";
import { formatTraumaLevel } from "./hospital-utils";

export interface MciDashboardProps {
  incidentId: string;
  distributionPlan: MciDistributionPlan;
  incidentLocation?: { lat: number; lon: number };
  onUpdatePlan?: () => void;
}

const PRIORITY_LABEL: Record<MciPatient["priority"], string> = {
  IMMEDIATE: "Immediate",
  DELAYED: "Delayed",
  MINIMAL: "Minimal",
  EXPECTANT: "Expectant",
};

const PRIORITY_CLASS: Record<MciPatient["priority"], string> = {
  IMMEDIATE: "bg-red-900/40 text-red-300",
  DELAYED: "bg-yellow-900/40 text-yellow-300",
  MINIMAL: "bg-green-900/40 text-green-300",
  EXPECTANT: "bg-slate-700 text-slate-300",
};

export function MciDashboard({
  incidentId,
  distributionPlan,
  incidentLocation,
  onUpdatePlan,
}: MciDashboardProps) {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);
  const [plan, setPlan] = useState(distributionPlan);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    setPlan(distributionPlan);
  }, [distributionPlan]);

  const center = (() => {
    const first = plan.allocations.find((a) => a.assignedPatientIds.length > 0);
    if (first) return { lon: first.longitude, lat: first.latitude };
    if (incidentLocation) return { lon: incidentLocation.lon, lat: incidentLocation.lat };
    return { lon: -82.5, lat: 27.3 };
  })();

  const handleActivate = useCallback(async () => {
    setActivating(true);
    try {
      const updated = await activateMciPlan(incidentId);
      setPlan(updated);
    } finally {
      setActivating(false);
    }
  }, [incidentId]);

  const patientsById = new Map(plan.patients.map((p) => [p.patientId, p]));

  return (
    <div className="flex h-full min-h-[480px] flex-col bg-slate-950">
      <header className="border-b-2 border-red-500 bg-red-950/40 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Mass casualty incident</h1>
            <p className="text-red-300">
              {plan.totalPatients} patients · {plan.summary.hospitalsUsed} hospitals ·{" "}
              {plan.status}
            </p>
          </div>
          <div className="flex gap-2">
            {onUpdatePlan ? (
              <button
                type="button"
                onClick={onUpdatePlan}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Recalculate plan
              </button>
            ) : null}
            <button
              type="button"
              disabled={activating || plan.status === "ACTIVE"}
              onClick={() => void handleActivate()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {plan.status === "ACTIVE" ? "Plan active" : activating ? "Activating…" : "Activate plan"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total patients" value={plan.totalPatients} />
          <StatCard label="Hospitals used" value={plan.summary.hospitalsUsed} />
          <StatCard label="Avg per hospital" value={plan.summary.avgPatientsPerHospital.toFixed(1)} />
          <StatCard label="Max load" value={plan.summary.maxHospitalLoad} />
        </div>

        {plan.warnings.length > 0 ? (
          <div className="mt-4 space-y-2">
            {plan.warnings.map((warning) => (
              <p
                key={warning}
                className="rounded border border-amber-500/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-200"
              >
                {warning}
              </p>
            ))}
          </div>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-[280px] flex-1">
          <RapidCortexMap
            center={[center.lon, center.lat]}
            zoom={10}
            theme="dark"
            onMapLoad={setMap}
          >
            {map && incidentLocation ? (
              <IncidentMarker map={map} lat={incidentLocation.lat} lon={incidentLocation.lon} />
            ) : null}
            {map
              ? plan.allocations
                  .filter((a) => a.assignedPatientIds.length > 0)
                  .map((allocation) => (
                    <MciHospitalMarker
                      key={allocation.hospitalId}
                      map={map}
                      allocation={allocation}
                      isSelected={selectedHospital === allocation.hospitalId}
                      onClick={() => setSelectedHospital(allocation.hospitalId)}
                    />
                  ))
              : null}
          </RapidCortexMap>
        </div>

        <aside className="w-full overflow-y-auto border-t border-slate-700 lg:w-1/2 lg:border-l lg:border-t-0">
          <div className="space-y-4 p-6">
            <h2 className="text-lg font-bold text-white">Distribution plan</h2>
            {plan.allocations
              .filter((a) => a.assignedPatientIds.length > 0)
              .map((allocation) => (
                <HospitalAllocationCard
                  key={allocation.hospitalId}
                  allocation={allocation}
                  patients={allocation.assignedPatientIds
                    .map((id) => patientsById.get(id))
                    .filter((p): p is MciPatient => Boolean(p))}
                  isSelected={selectedHospital === allocation.hospitalId}
                  onClick={() => setSelectedHospital(allocation.hospitalId)}
                />
              ))}

            {plan.unallocatedPatientIds.length > 0 ? (
              <div className="rounded-lg border-2 border-red-500 bg-red-950/30 p-4">
                <h3 className="font-bold text-red-400">Unallocated patients</h3>
                <p className="mb-3 text-sm text-red-300">
                  {plan.unallocatedPatientIds.length} patients could not be assigned
                </p>
                <div className="space-y-2">
                  {plan.unallocatedPatientIds.map((id) => {
                    const patient = patientsById.get(id);
                    if (!patient) return null;
                    return (
                      <div
                        key={id}
                        className="rounded bg-red-950/20 px-2 py-1 text-sm text-white"
                      >
                        <span className="font-mono">{id}</span>
                        <span className="ml-2 text-red-300">{PRIORITY_LABEL[patient.priority]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-900/60 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function IncidentMarker({ map, lat, lon }: { map: mapboxgl.Map; lat: number; lon: number }) {
  useEffect(() => {
    const marker = new mapboxglLib.Marker({ color: "#DC2626" })
      .setLngLat([lon, lat])
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, lat, lon]);
  return null;
}

function HospitalAllocationCard({
  allocation,
  patients,
  isSelected,
  onClick,
}: {
  allocation: MciHospitalAllocation;
  patients: MciPatient[];
  isSelected: boolean;
  onClick: () => void;
}) {
  const counts = patients.reduce(
    (acc, p) => {
      acc[p.priority] += 1;
      return acc;
    },
    { IMMEDIATE: 0, DELAYED: 0, MINIMAL: 0, EXPECTANT: 0 } as Record<MciPatient["priority"], number>,
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border-2 p-4 text-left transition ${
        isSelected
          ? "border-sky-500 bg-sky-950/30"
          : "border-slate-700 bg-slate-900 hover:border-slate-500"
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">{allocation.hospitalName}</h3>
          <p className="text-sm text-slate-400">{allocation.reasoning}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white">{patients.length}</div>
          <div className="text-xs text-slate-500">patients</div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(counts) as MciPatient["priority"][])
          .filter((k) => counts[k] > 0)
          .map((k) => (
            <span key={k} className={`rounded px-2 py-1 text-xs ${PRIORITY_CLASS[k]}`}>
              {PRIORITY_LABEL[k]}: {counts[k]}
            </span>
          ))}
      </div>

      <div className="flex items-center justify-between border-t border-slate-700 pt-3 text-sm">
        <span className="text-slate-400">
          Capacity remaining:{" "}
          <span
            className={allocation.availableCapacity > 0 ? "text-emerald-400" : "text-red-400"}
          >
            {allocation.availableCapacity} beds
          </span>
        </span>
        {allocation.traumaLevel && allocation.traumaLevel !== "NONE" ? (
          <span className="rounded bg-sky-900/40 px-2 py-0.5 text-xs text-sky-300">
            {formatTraumaLevel(allocation.traumaLevel)}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function MciHospitalMarker({
  map,
  allocation,
  isSelected,
  onClick,
}: {
  map: mapboxgl.Map;
  allocation: MciHospitalAllocation;
  isSelected: boolean;
  onClick: () => void;
}) {
  useEffect(() => {
    const count = allocation.assignedPatientIds.length;
    const el = document.createElement("div");
    el.style.cssText = `
      width: 56px; height: 56px; border-radius: 50%;
      background: ${count > 0 ? "#DC2626" : "#6B7280"};
      border: ${isSelected ? "4px" : "3px"} solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      cursor: pointer; font-family: system-ui, sans-serif;
      transform: ${isSelected ? "scale(1.15)" : "scale(1)"};
    `;
    el.innerHTML = `<div style="font-size:22px">🏥</div><div style="font-size:13px;font-weight:700;color:#fff">${count}</div>`;
    el.addEventListener("click", onClick);
    const marker = new mapboxglLib.Marker({ element: el })
      .setLngLat([allocation.longitude, allocation.latitude])
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, allocation, isSelected, onClick]);
  return null;
}
