"use client";

import { useEffect, useState } from "react";
import type {
  HospitalCapacity,
  HospitalPortalContext,
  ManualCapacityUpdateBody,
} from "rapid-cortex-shared";

import { manualUpdateHospitalCapacity } from "@/lib/hospital-portal/api";
import { formatTraumaLevel } from "./hospital-utils";

type FormState = ManualCapacityUpdateBody;

const defaultForm: FormState = {
  erBeds: { available: 0, total: 1 },
  icuBeds: { available: 0, total: 1 },
  traumaBeds: { available: 0, total: 0 },
  waitTimeMinutes: 30,
  isOnDiversion: false,
  diversionType: "FULL",
  diversionReason: "",
  staffing: { erPhysicians: 2, erNurses: 4, adequateStaffing: true },
  notes: "",
};

export interface CapacityUpdateFormProps {
  context: HospitalPortalContext;
  onUpdated: () => void;
}

export function CapacityUpdateForm({ context, onUpdated }: CapacityUpdateFormProps) {
  const [formData, setFormData] = useState<FormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const currentCapacity = context.capacity as HospitalCapacity | null;
  const hospital = context.hospital;

  useEffect(() => {
    if (!currentCapacity) return;
    setFormData({
      erBeds: {
        available: currentCapacity.availability.erBeds.available,
        total: currentCapacity.availability.erBeds.total,
      },
      icuBeds: {
        available: currentCapacity.availability.icuBeds.available,
        total: currentCapacity.availability.icuBeds.total,
      },
      traumaBeds: {
        available: currentCapacity.availability.traumaBeds?.available ?? 0,
        total: currentCapacity.availability.traumaBeds?.total ?? 0,
      },
      waitTimeMinutes: currentCapacity.waitTimes.erWaitMinutes,
      isOnDiversion: currentCapacity.diversion.isOnDiversion,
      diversionType: currentCapacity.diversion.diversionType ?? "FULL",
      diversionReason: currentCapacity.diversion.diversionReason ?? "",
      staffing: {
        erPhysicians: currentCapacity.staffing.erPhysicians ?? 0,
        erNurses: currentCapacity.staffing.erNurses ?? 0,
        adequateStaffing: currentCapacity.staffing.adequateStaffing,
      },
      notes: "",
    });
  }, [currentCapacity]);

  const handleQuickUpdate = (scenario: "full" | "normal" | "busy" | "diversion") => {
    setFormData((prev) => {
      switch (scenario) {
        case "full":
          return {
            ...prev,
            erBeds: { ...prev.erBeds, available: prev.erBeds.total },
            icuBeds: { ...prev.icuBeds, available: prev.icuBeds.total },
            waitTimeMinutes: 15,
            isOnDiversion: false,
            staffing: { ...prev.staffing, adequateStaffing: true },
          };
        case "normal":
          return {
            ...prev,
            erBeds: {
              ...prev.erBeds,
              available: Math.max(0, Math.floor(prev.erBeds.total * 0.5)),
            },
            waitTimeMinutes: 30,
            isOnDiversion: false,
          };
        case "busy":
          return {
            ...prev,
            erBeds: {
              ...prev.erBeds,
              available: Math.max(0, Math.floor(prev.erBeds.total * 0.2)),
            },
            waitTimeMinutes: 60,
            isOnDiversion: false,
          };
        case "diversion":
          return {
            ...prev,
            erBeds: { ...prev.erBeds, available: 0 },
            isOnDiversion: true,
            diversionType: "FULL",
            diversionReason: "ER at capacity",
          };
        default:
          return prev;
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      await manualUpdateHospitalCapacity(formData);
      setSuccess(true);
      onUpdated();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update capacity");
    } finally {
      setSubmitting(false);
    }
  };

  const hasTrauma = hospital.traumaLevel && hospital.traumaLevel !== "NONE";

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6 rounded-lg bg-slate-900 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-white">Update capacity</h2>
        <span className="text-sm text-slate-400">
          Last updated:{" "}
          {currentCapacity
            ? new Date(currentCapacity.timestamp).toLocaleString()
            : "Never"}
        </span>
      </div>

      <div className="rounded-lg bg-slate-950 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-400">Quick actions</h3>
        <div className="capacity-grid grid grid-cols-2 gap-3">
          <QuickButton label="Full capacity" tone="green" onClick={() => handleQuickUpdate("full")} />
          <QuickButton label="Normal load" tone="blue" onClick={() => handleQuickUpdate("normal")} />
          <QuickButton label="Busy" tone="amber" onClick={() => handleQuickUpdate("busy")} />
          <QuickButton label="Diversion" tone="red" onClick={() => handleQuickUpdate("diversion")} />
        </div>
      </div>

      {success ? (
        <p className="rounded-lg border border-emerald-500/60 bg-emerald-950/40 px-4 py-3 text-emerald-200">
          Capacity updated successfully
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-500/60 bg-red-950/40 px-4 py-3 text-red-200">{error}</p>
      ) : null}

      <BedSection
        title="Emergency room beds"
        available={formData.erBeds.available}
        total={formData.erBeds.total}
        onAvailable={(v) =>
          setFormData((p) => ({ ...p, erBeds: { ...p.erBeds, available: v } }))
        }
        onTotal={(v) => setFormData((p) => ({ ...p, erBeds: { ...p.erBeds, total: v } }))}
      />

      <BedSection
        title="ICU beds"
        available={formData.icuBeds.available}
        total={formData.icuBeds.total}
        onAvailable={(v) =>
          setFormData((p) => ({ ...p, icuBeds: { ...p.icuBeds, available: v } }))
        }
        onTotal={(v) => setFormData((p) => ({ ...p, icuBeds: { ...p.icuBeds, total: v } }))}
      />

      {hasTrauma ? (
        <BedSection
          title={`Trauma beds (${formatTraumaLevel(hospital.traumaLevel!)})`}
          available={formData.traumaBeds?.available ?? 0}
          total={formData.traumaBeds?.total ?? 0}
          onAvailable={(v) =>
            setFormData((p) => ({
              ...p,
              traumaBeds: { available: v, total: p.traumaBeds?.total ?? 0 },
            }))
          }
          onTotal={(v) =>
            setFormData((p) => ({
              ...p,
              traumaBeds: { available: p.traumaBeds?.available ?? 0, total: v },
            }))
          }
        />
      ) : null}

      <section className="rounded-lg bg-slate-950 p-4">
        <h3 className="mb-3 text-lg font-semibold text-white">ER wait time</h3>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={180}
            step={5}
            value={formData.waitTimeMinutes}
            onChange={(e) =>
              setFormData((p) => ({ ...p, waitTimeMinutes: Number(e.target.value) }))
            }
            className="min-h-[44px] flex-1"
          />
          <span className="w-20 text-center text-3xl font-bold text-white">
            {formData.waitTimeMinutes}
          </span>
          <span className="text-slate-400">min</span>
        </div>
      </section>

      <section className="rounded-lg bg-slate-950 p-4">
        <h3 className="mb-3 text-lg font-semibold text-white">Diversion</h3>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={formData.isOnDiversion}
            onChange={(e) => setFormData((p) => ({ ...p, isOnDiversion: e.target.checked }))}
            className="h-6 w-6"
          />
          <span className="text-white">Hospital is on diversion</span>
        </label>
        {formData.isOnDiversion ? (
          <div className="mt-4 space-y-3 pl-2">
            <select
              value={formData.diversionType}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  diversionType: e.target.value as FormState["diversionType"],
                }))
              }
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            >
              <option value="FULL">Full diversion</option>
              <option value="TRAUMA">Trauma only</option>
              <option value="CARDIAC">Cardiac only</option>
              <option value="STROKE">Stroke only</option>
              <option value="PSYCHIATRIC">Psychiatric only</option>
            </select>
            <textarea
              value={formData.diversionReason ?? ""}
              onChange={(e) => setFormData((p) => ({ ...p, diversionReason: e.target.value }))}
              placeholder="Reason for diversion"
              rows={3}
              maxLength={200}
              required
              className="w-full resize-none rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            />
          </div>
        ) : null}
      </section>

      <section className="rounded-lg bg-slate-950 p-4">
        <h3 className="mb-3 text-lg font-semibold text-white">Staffing</h3>
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="ER physicians"
            value={formData.staffing.erPhysicians}
            onChange={(v) =>
              setFormData((p) => ({ ...p, staffing: { ...p.staffing, erPhysicians: v } }))
            }
          />
          <NumberField
            label="ER nurses"
            value={formData.staffing.erNurses}
            onChange={(v) =>
              setFormData((p) => ({ ...p, staffing: { ...p.staffing, erNurses: v } }))
            }
          />
        </div>
        <label className="mt-4 flex min-h-[44px] cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={formData.staffing.adequateStaffing}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                staffing: { ...p.staffing, adequateStaffing: e.target.checked },
              }))
            }
            className="h-5 w-5"
          />
          <span className="text-white">Adequate staffing for current load</span>
        </label>
      </section>

      <section className="rounded-lg bg-slate-950 p-4">
        <h3 className="mb-2 text-lg font-semibold text-white">Notes (optional)</h3>
        <textarea
          value={formData.notes ?? ""}
          onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
          rows={3}
          maxLength={500}
          className="w-full resize-none rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
        />
      </section>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-emerald-600 py-4 text-lg font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {submitting ? "Updating…" : "Update capacity"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Dispatchers see this update immediately
      </p>
    </form>
  );
}

function QuickButton({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: "green" | "blue" | "amber" | "red";
  onClick: () => void;
}) {
  const tones = {
    green: "border-emerald-500/60 bg-emerald-950/40 text-emerald-200",
    blue: "border-sky-500/60 bg-sky-950/40 text-sky-200",
    amber: "border-amber-500/60 bg-amber-950/40 text-amber-200",
    red: "border-red-500/60 bg-red-950/40 text-red-200",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium ${tones[tone]}`}
    >
      {label}
    </button>
  );
}

function BedSection({
  title,
  available,
  total,
  onAvailable,
  onTotal,
}: {
  title: string;
  available: number;
  total: number;
  onAvailable: (v: number) => void;
  onTotal: (v: number) => void;
}) {
  return (
    <section className="rounded-lg bg-slate-950 p-4">
      <h3 className="mb-3 text-lg font-semibold text-white">{title}</h3>
      <div className="capacity-grid grid grid-cols-2 gap-4">
        <NumberField label="Available" value={available} onChange={onAvailable} large />
        <NumberField label="Total" value={total} onChange={onTotal} large />
      </div>
      <CapacityBar available={available} total={total} />
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  large = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  large?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-400">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10) || 0)}
        className={`w-full rounded border border-slate-600 bg-slate-800 px-3 text-center font-bold text-white focus:border-sky-500 focus:outline-none ${
          large ? "hospital-portal-number py-3 text-2xl" : "py-2"
        }`}
      />
    </label>
  );
}

function CapacityBar({ available, total }: { available: number; total: number }) {
  if (total <= 0) return null;
  const pct = (available / total) * 100;
  const color = pct >= 50 ? "bg-emerald-500" : pct >= 20 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="mt-3">
      <div className="h-3 overflow-hidden rounded-full bg-slate-700">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{total - available} occupied</span>
        <span>{available} available</span>
      </div>
    </div>
  );
}
