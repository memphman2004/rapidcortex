"use client";

import { useState } from "react";
import type { HospitalRecommendation } from "rapid-cortex-shared";

import { formatTraumaLevel, hasTraumaCenter, RECOMMENDATION_ICONS, recommendationLabel } from "./hospital-utils";

export interface HospitalDetailModalProps {
  recommendation: HospitalRecommendation;
  onClose: () => void;
  onSelectForTransport?: () => void;
}

export function HospitalDetailModal({
  recommendation,
  onClose,
  onSelectForTransport,
}: HospitalDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "capacity" | "history">("overview");
  const { hospital, capacity, routing, scoring } = recommendation;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-slate-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-700 bg-slate-950 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
              🏥 {hospital.name}
            </h2>
            <p className="mt-1 text-sm text-slate-400">{hospital.address}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-3xl leading-none text-slate-400 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <nav className="border-b border-slate-700 bg-slate-950 px-6">
          <div className="flex gap-6">
            {(
              [
                ["overview", "Overview"],
                ["capacity", "Current capacity"],
                ["history", "Historical data"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`border-b-2 px-2 py-3 transition-colors ${
                  activeTab === id
                    ? "border-blue-500 text-white"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && (
            <OverviewTab hospital={hospital} routing={routing} scoring={scoring} level={recommendation.recommendation} />
          )}
          {activeTab === "capacity" && <CapacityTab hospital={hospital} capacity={capacity} />}
          {activeTab === "history" && <HistoryTab hospitalId={hospital.hospitalId} />}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-700 bg-slate-950 px-6 py-4">
          <span className="text-sm text-slate-400">
            Last updated: {new Date(capacity.timestamp).toLocaleString()}
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-700 px-6 py-2 font-medium text-white hover:bg-slate-600"
            >
              Close
            </button>
            {onSelectForTransport && (
              <button
                type="button"
                onClick={onSelectForTransport}
                className="rounded-lg bg-emerald-600 px-6 py-2 font-medium text-white hover:bg-emerald-700"
              >
                Select for transport
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function OverviewTab({
  hospital,
  routing,
  scoring,
  level,
}: {
  hospital: HospitalRecommendation["hospital"];
  routing: HospitalRecommendation["routing"];
  scoring: HospitalRecommendation["scoring"];
  level: HospitalRecommendation["recommendation"];
}) {
  const trauma = formatTraumaLevel(hospital.traumaLevel);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-950 p-4">
          <div className="mb-2 text-sm text-slate-400">Distance</div>
          <div className="mb-1 text-3xl font-bold text-white">{routing.distanceMiles.toFixed(1)} mi</div>
          <div className="text-sm text-slate-500">~{routing.durationLightsMinutes} min (L&amp;S)</div>
        </div>
        <div className="rounded-lg bg-slate-950 p-4">
          <div className="mb-2 text-sm text-slate-400">Overall score</div>
          <div
            className={`mb-1 text-3xl font-bold ${
              scoring.overallScore >= 80
                ? "text-emerald-400"
                : scoring.overallScore >= 60
                  ? "text-amber-400"
                  : "text-red-400"
            }`}
          >
            {scoring.overallScore}
          </div>
          <div className="text-sm text-slate-500">out of 100</div>
        </div>
        <div className="rounded-lg bg-slate-950 p-4">
          <div className="mb-2 text-sm text-slate-400">Recommendation</div>
          <div className="text-xl font-bold capitalize text-white">
            {RECOMMENDATION_ICONS[level]} {recommendationLabel(level)}
          </div>
          {trauma && <div className="text-sm text-slate-500">Trauma {trauma}</div>}
        </div>
      </div>

      <section className="rounded-lg bg-slate-950 p-4">
        <h3 className="mb-4 font-semibold text-white">Capabilities</h3>
        <div className="grid grid-cols-2 gap-4">
          <CapabilityItem label="Trauma center" value={trauma ?? "No"} enabled={hasTraumaCenter(hospital)} />
          <CapabilityItem label="Stroke center" value={hospital.strokeCenter ? "Yes" : "No"} enabled={hospital.strokeCenter} />
          <CapabilityItem label="STEMI center" value={hospital.cardiacCenter ? "Yes" : "No"} enabled={hospital.cardiacCenter} />
          <CapabilityItem label="Burn center" value={hospital.burnCenter ? "Yes" : "No"} enabled={hospital.burnCenter} />
          <CapabilityItem label="Pediatric" value={hospital.pediatricCapable ? "Yes" : "No"} enabled={hospital.pediatricCapable} />
          <CapabilityItem label="Behavioral health" value={hospital.behavioralHealthCapable ? "Yes" : "No"} enabled={hospital.behavioralHealthCapable} />
        </div>
      </section>

      <section className="rounded-lg bg-slate-950 p-4">
        <h3 className="mb-4 font-semibold text-white">Contact</h3>
        <div className="space-y-3">
          <div>
            <div className="text-sm text-slate-400">Main phone</div>
            <div className="font-mono text-white">{hospital.phone}</div>
          </div>
          {hospital.emergencyDepartmentPhone && (
            <div>
              <div className="text-sm text-slate-400">Emergency line</div>
              <div className="font-mono text-white">{hospital.emergencyDepartmentPhone}</div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg bg-slate-950 p-4">
        <h3 className="mb-4 font-semibold text-white">Score breakdown</h3>
        <div className="space-y-3">
          <ScoreBar label="Distance" score={scoring.factors.distance} />
          <ScoreBar label="Capacity" score={scoring.factors.capacity} />
          <ScoreBar label="Specialty match" score={scoring.factors.specialtyMatch} />
          <ScoreBar label="Wait time" score={scoring.factors.waitTime} />
          <ScoreBar label="Historical" score={scoring.factors.historical} />
        </div>
      </section>
    </div>
  );
}

function CapabilityItem({ label, value, enabled }: { label: string; value: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`font-semibold ${enabled ? "text-emerald-400" : "text-slate-500"}`}>{value}</span>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <span className="font-semibold text-white">{score}/100</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-700">
        <div
          className={`h-2 rounded-full ${score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function CapacityTab({
  hospital,
  capacity,
}: {
  hospital: HospitalRecommendation["hospital"];
  capacity: HospitalRecommendation["capacity"];
}) {
  return (
    <div className="space-y-6">
      {capacity.diversion.isOnDiversion && (
        <div className="rounded-lg border-2 border-red-500 bg-red-950/30 p-4">
          <p className="text-lg font-bold text-red-400">Hospital on diversion</p>
          {capacity.diversion.diversionType && (
            <p className="text-red-300">Type: {capacity.diversion.diversionType}</p>
          )}
          {capacity.diversion.diversionReason && (
            <p className="text-red-300">Reason: {capacity.diversion.diversionReason}</p>
          )}
          {capacity.diversion.diversionUntil && (
            <p className="text-sm text-red-300">
              Until: {new Date(capacity.diversion.diversionUntil).toLocaleString()}
            </p>
          )}
        </div>
      )}

      <section className="rounded-lg bg-slate-950 p-4">
        <h3 className="mb-4 font-semibold text-white">Bed availability</h3>
        <div className="space-y-4">
          <BedBar label="Emergency room" available={capacity.availability.erBeds.available} total={capacity.availability.erBeds.total} />
          <BedBar label="ICU" available={capacity.availability.icuBeds.available} total={capacity.availability.icuBeds.total} />
          {capacity.availability.traumaBeds && (
            <BedBar label="Trauma" available={capacity.availability.traumaBeds.available} total={capacity.availability.traumaBeds.total} />
          )}
        </div>
      </section>

      <section className="rounded-lg bg-slate-950 p-4">
        <h3 className="mb-4 font-semibold text-white">Wait times</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-slate-400">ER wait</div>
            <div className="text-3xl font-bold text-white">{capacity.waitTimes.erWaitMinutes}</div>
            <div className="text-sm text-slate-500">minutes</div>
          </div>
          {capacity.waitTimes.traumaBayMinutes !== undefined && (
            <div>
              <div className="text-sm text-slate-400">Trauma bay</div>
              <div className="text-3xl font-bold text-white">{capacity.waitTimes.traumaBayMinutes}</div>
              <div className="text-sm text-slate-500">minutes</div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg bg-slate-950 p-4">
        <h3 className="mb-4 font-semibold text-white">Staffing</h3>
        <div className="space-y-2 text-white">
          {capacity.staffing.erPhysicians !== undefined && (
            <p>ER physicians: {capacity.staffing.erPhysicians}</p>
          )}
          {capacity.staffing.erNurses !== undefined && <p>ER nurses: {capacity.staffing.erNurses}</p>}
          <p className="flex items-center gap-2">
            <span
              className={`inline-block h-3 w-3 rounded-full ${capacity.staffing.adequateStaffing ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            {capacity.staffing.adequateStaffing ? "Adequate staffing" : "Limited staffing"}
          </p>
        </div>
      </section>

      <section className="rounded-lg bg-slate-950 p-4">
        <h3 className="mb-4 font-semibold text-white">Data quality</h3>
        <div className="space-y-2 text-sm">
          <p className="text-slate-300">
            Source: <span className="font-mono text-white">{capacity.dataQuality.source}</span>
          </p>
          <p className="text-slate-300">
            Confidence:{" "}
            <span className="capitalize text-white">{capacity.dataQuality.confidence.toLowerCase()}</span>
          </p>
          <p className="text-slate-300">
            Verified: {new Date(capacity.dataQuality.lastVerified).toLocaleString()}
          </p>
        </div>
      </section>
    </div>
  );
}

function BedBar({ label, available, total }: { label: string; available: number; total: number }) {
  const pct = total > 0 ? (available / total) * 100 : 0;
  return (
    <div>
      <div className="mb-2 flex justify-between">
        <span className="font-medium text-white">{label}</span>
        <span className="font-bold text-white">
          {available} / {total}
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-slate-700">
        <div
          className={`h-3 rounded-full ${pct >= 50 ? "bg-emerald-500" : pct >= 20 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function HistoryTab({ hospitalId }: { hospitalId: string }) {
  return (
    <div className="py-12 text-center text-slate-400">
      <p className="mb-2 text-4xl">📊</p>
      <p className="text-lg font-semibold text-white">Historical data</p>
      <p className="mt-2 text-sm">
        Trends for hospital <span className="font-mono">{hospitalId}</span> will appear here (avg wait,
        diversion hours, capacity patterns).
      </p>
    </div>
  );
}
