"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  KeyRound,
  PawPrint,
  Accessibility,
  UserRound,
} from "lucide-react";
import type { CitizenProfile } from "rapid-cortex-shared";
import { featureSuiteFetch } from "@/lib/feature-suite-client";
import { isFeaturesSuiteUiEnabled } from "@/lib/runtime-flags";

type LookupResponse = { found: boolean; profile?: CitizenProfile };

type Props = {
  callerPhone?: string | null;
  /** When provided, skip lookup and render this profile. */
  profile?: CitizenProfile | null;
  className?: string;
};

function displayName(p: CitizenProfile): string {
  if (p.preferredName) return p.preferredName;
  const parts = [p.firstName, p.lastName?.charAt(0) ? `${p.lastName.charAt(0)}.` : p.lastName]
    .filter(Boolean)
    .join(" ");
  return parts || p.phoneE164;
}

export function CitizenProfileCard({ callerPhone, profile: injected, className }: Props) {
  const [expanded, setExpanded] = useState(true);
  const enabled = isFeaturesSuiteUiEnabled();
  const phone = callerPhone?.trim() || "";

  const lookup = useQuery({
    queryKey: ["citizen-lookup", phone],
    queryFn: () =>
      featureSuiteFetch<LookupResponse>(`citizens/lookup?phone=${encodeURIComponent(phone)}`),
    enabled: enabled && !injected && phone.length >= 8,
    staleTime: 60_000,
  });

  const profile = injected ?? (lookup.data?.found ? lookup.data.profile : null);
  if (!enabled) return null;
  if (!injected && !phone) return null;
  if (lookup.isLoading && !injected) {
    return (
      <div
        className={`rounded-md border border-slate-700/80 border-l-4 border-l-teal-500 bg-[#161b2e] px-3 py-2 text-xs text-slate-400 ${className ?? ""}`}
      >
        Looking up citizen profile…
      </div>
    );
  }
  if (!profile) return null;

  const med = profile.medicalConditions?.[0];
  const pet = profile.pets?.[0];

  return (
    <div
      className={`rounded-md border border-slate-700/80 border-l-4 border-l-teal-500 bg-[#161b2e] text-[#e2e4ea] ${className ?? ""}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <UserRound className="h-4 w-4 shrink-0 text-teal-400" />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-teal-300/90">
              Citizen profile match
            </div>
            <div className="truncate text-sm font-medium">
              {displayName(profile)}
              <span className="ml-2 text-xs font-normal text-slate-400">
                Primary: {profile.primaryLanguage}
              </span>
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="space-y-1.5 border-t border-slate-700/60 px-3 py-2 text-xs text-slate-300">
          {med && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>
                {med.condition}
                {med.notes ? ` — ${med.notes}` : ""}
              </span>
            </div>
          )}
          {profile.mobilityStatus && profile.mobilityStatus !== "ambulatory" && (
            <div className="flex items-start gap-2">
              <Accessibility className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
              <span className="capitalize">{profile.mobilityStatus.replace(/_/g, " ")}</span>
            </div>
          )}
          {pet && (
            <div className="flex items-start gap-2">
              <PawPrint
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${pet.aggressive ? "text-red-400" : "text-slate-400"}`}
              />
              <span>
                {pet.name || "Pet"} ({pet.species}
                {pet.breed ? `, ${pet.breed}` : ""})
                {pet.aggressive ? (
                  <span className="ml-1 font-semibold text-red-400">aggressive</span>
                ) : (
                  <span className="ml-1 text-slate-500">not aggressive</span>
                )}
              </span>
            </div>
          )}
          {(profile.accessNotes || profile.specialInstructions) && (
            <div className="flex items-start gap-2">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
              <span>{profile.accessNotes || profile.specialInstructions}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
