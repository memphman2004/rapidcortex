"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Eye,
  FileText,
  KeyRound,
  MapPin,
  Users,
  X,
} from "lucide-react";
import type { AddressIntelligence } from "rapid-cortex-shared";
import {
  featureSuiteAddressKey,
  featureSuiteFetch,
} from "@/lib/feature-suite-client";
import { isFeaturesSuiteUiEnabled } from "@/lib/runtime-flags";
import { isSupervisorOrAdmin } from "@/lib/auth/roles";
import { useSession } from "@/components/auth/session-context";

type Props = {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  /** Preloaded intel skips the fetch. */
  intel?: AddressIntelligence | null;
  className?: string;
};

const severityColor: Record<string, string> = {
  critical: "text-red-400",
  high: "text-red-300",
  medium: "text-amber-300",
  low: "text-yellow-200",
};

export function AddressIntelPanel({
  street,
  city,
  state,
  zip,
  intel: injected,
  className,
}: Props) {
  const { user } = useSession();
  const canReveal = user?.role ? isSupervisorOrAdmin(user.role) : false;
  const [showCodes, setShowCodes] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);
  const enabled = isFeaturesSuiteUiEnabled();

  const ready = Boolean(street && city && state && zip);
  const key = ready ? featureSuiteAddressKey(street!, city!, state!, zip!) : "";

  const query = useQuery({
    queryKey: ["address-intel", key],
    queryFn: () =>
      featureSuiteFetch<AddressIntelligence>(`address/${key}/intelligence`),
    enabled: enabled && !injected && ready,
    staleTime: 30_000,
    retry: false,
  });

  const intel = injected ?? query.data ?? null;
  if (!enabled) return null;
  if (!injected && !ready) return null;
  if (query.isLoading && !injected) {
    return (
      <div className={`rounded-md border border-slate-700/80 bg-[#161b2e] px-3 py-2 text-xs text-slate-400 ${className ?? ""}`}>
        Loading address intelligence…
      </div>
    );
  }
  if (!intel && query.isError) return null;
  if (!intel) return null;

  const floorPlan = intel.prePlan?.floorPlans?.[0];

  return (
    <div
      className={`rounded-md border border-slate-700/80 border-l-4 border-l-sky-500 bg-[#161b2e] text-[#e2e4ea] ${className ?? ""}`}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/90">
            Address intelligence
          </div>
          <div className="text-sm font-medium">
            {intel.normalizedAddress}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {intel.totalIncidents} prior incident{intel.totalIncidents === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-700/60 px-3 py-2 text-xs">
        {intel.hazards?.length > 0 && (
          <section>
            <div className="mb-1 flex items-center gap-1.5 font-semibold uppercase tracking-wider text-amber-300/90">
              <AlertTriangle className="h-3.5 w-3.5" /> Hazards
            </div>
            <ul className="space-y-1 text-slate-300">
              {intel.hazards.map((h) => (
                <li key={h.hazardId} className={severityColor[h.severity] ?? "text-slate-300"}>
                  <span className="font-medium capitalize">{h.severity}</span>
                  {" · "}
                  {h.description}
                  {h.verified ? " (verified)" : ""}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <div className="mb-1 flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-400">
            <Users className="h-3.5 w-3.5" /> Occupants
          </div>
          <ul className="space-y-0.5 text-slate-300">
            {intel.hasNonAmbulatoryOccupant && <li>Non-ambulatory resident on record</li>}
            {intel.hasSpecialNeedsOccupant && <li>Special needs occupant on record</li>}
            <li>
              {intel.knownOccupantCount ?? 0} known occupant
              {(intel.knownOccupantCount ?? 0) === 1 ? "" : "s"}
            </li>
          </ul>
        </section>

        {intel.prePlan && (
          <section>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-400">
                <FileText className="h-3.5 w-3.5" /> Pre-plan
              </span>
              {floorPlan?.cloudFrontUrl && (
                <button
                  type="button"
                  onClick={() => setFloorPlanUrl(floorPlan.cloudFrontUrl)}
                  className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-sky-300 hover:bg-slate-800"
                >
                  View floor plan
                </button>
              )}
            </div>
            <p className="text-slate-300 capitalize">
              {intel.prePlan.facilityType}
              {intel.prePlan.floors ? ` · ${intel.prePlan.floors} floors` : ""}
            </p>
            {intel.prePlan.contacts?.[0] && (
              <p className="mt-0.5 text-slate-400">
                Contact: {intel.prePlan.contacts[0].name} ({intel.prePlan.contacts[0].role}){" "}
                {intel.prePlan.contacts[0].phone}
              </p>
            )}
          </section>
        )}

        <section>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-400">
              <KeyRound className="h-3.5 w-3.5" /> Access
            </span>
            {(intel.gateCode || intel.lockboxCode) && (
              <button
                type="button"
                disabled={!canReveal}
                title={canReveal ? undefined : "Supervisor role required"}
                onClick={() => canReveal && setShowCodes((v) => !v)}
                className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-0.5 text-[11px] text-sky-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Eye className="h-3 w-3" />
                {showCodes ? "Hide codes" : "Show codes"}
              </button>
            )}
          </div>
          <p className="text-slate-300">
            Gate:{" "}
            <span className={!showCodes && intel.gateCode ? "blur-sm select-none" : ""}>
              {intel.gateCode || "—"}
            </span>
            {" · "}
            Lockbox:{" "}
            <span className={!showCodes && intel.lockboxCode ? "blur-sm select-none" : ""}>
              {intel.lockboxCode || "—"}
            </span>
          </p>
          {intel.accessNotes && <p className="mt-0.5 text-slate-400">{intel.accessNotes}</p>}
        </section>

        {intel.incidentHistory?.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="text-[11px] font-semibold uppercase tracking-wider text-sky-400 hover:text-sky-300"
            >
              {historyOpen ? "Hide" : "Show"} prior incidents ({intel.incidentHistory.length})
            </button>
            {historyOpen && (
              <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-slate-400">
                {intel.incidentHistory.map((inc) => (
                  <li key={inc.incidentId}>
                    {inc.incidentType} · {new Date(inc.date).toLocaleDateString()}
                    {inc.disposition ? ` · ${inc.disposition}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {floorPlanUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative flex h-[85vh] w-full max-w-4xl flex-col rounded-lg border border-slate-700 bg-[#0f1117]">
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2">
              <span className="text-sm font-medium text-white">Floor plan</span>
              <button type="button" onClick={() => setFloorPlanUrl(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <iframe title="Floor plan" src={floorPlanUrl} className="h-full w-full flex-1 rounded-b-lg bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}
