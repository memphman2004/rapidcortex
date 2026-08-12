"use client";

import { useEffect, useState } from "react";
import {
  fetchAgencyProfile,
  fetchAgencyResearch,
  fetchCompetitorIntel,
  type AgencyProfileResult,
} from "@/lib/rapid-iq/api";
import type { RapidIqContact, RapidIqOpportunity } from "@/lib/rapid-iq/types";
import { formatCurrency, formatShortDate } from "@/lib/rapid-iq/scoring";
import { CONTACT_ROLES_BY_VERTICAL } from "@/lib/rapid-iq/contact-roles";
import { BuyingCommitteeMap } from "./buying-committee-map";

type Props = {
  opportunity: RapidIqOpportunity;
  contacts: RapidIqContact[];
  demo?: boolean;
};

function seedProfileFromOpportunity(opportunity: RapidIqOpportunity): AgencyProfileResult {
  const population =
    opportunity.population && opportunity.population > 0 ? opportunity.population : null;
  return {
    annualCallVolume: population ? Math.round(population * 0.55) : null,
    dispatcherCount: population ? Math.max(8, Math.round(population / 45_000)) : null,
    populationServed: population,
    estimatedBudget:
      opportunity.estimatedDollarValue && opportunity.estimatedDollarValue > 0
        ? opportunity.estimatedDollarValue
        : population
          ? Math.round(population * 2.5)
          : null,
    currentCadVendor: opportunity.incumbentVendor ?? null,
    cadNotes: opportunity.incumbentVendor
      ? `Incumbent from Rapid IQ signal: ${opportunity.incumbentVendor}`
      : null,
    agencyWebsite: null,
    psapType:
      opportunity.agencyType?.includes("county") || opportunity.vertical === "911"
        ? "Primary PSAP / ECC"
        : null,
    notes: `Seeded from opportunity data for ${opportunity.agencyName}. Refresh to enrich via Claude.`,
  };
}

function isEmptyProfile(profile: AgencyProfileResult): boolean {
  return (
    profile.annualCallVolume == null &&
    profile.dispatcherCount == null &&
    profile.populationServed == null &&
    profile.estimatedBudget == null &&
    !profile.currentCadVendor &&
    !profile.psapType
  );
}

export function ContactIntelligenceTab({ opportunity, contacts, demo }: Props) {
  const roles = CONTACT_ROLES_BY_VERTICAL[opportunity.vertical];
  const [profile, setProfile] = useState<AgencyProfileResult | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [research, setResearch] = useState<string | null>(null);
  const [loadingResearch, setLoadingResearch] = useState(false);
  const [competitorIntel, setCompetitorIntel] = useState<string | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    setLoadingProfile(true);
    setError(null);
    try {
      const result = await fetchAgencyProfile(opportunity.opportunityId, demo);
      setProfile(isEmptyProfile(result) ? seedProfileFromOpportunity(opportunity) : result);
    } catch (err) {
      setProfile(seedProfileFromOpportunity(opportunity));
      setError(err instanceof Error ? err.message : "Profile failed — showing opportunity seed");
    } finally {
      setLoadingProfile(false);
    }
  }

  useEffect(() => {
    void loadProfile();
    // Load once per opportunity open; Refresh still re-runs loadProfile.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional opportunityId gate
  }, [opportunity.opportunityId, demo]);

  async function loadResearch() {
    setLoadingResearch(true);
    setError(null);
    try {
      setResearch(await fetchAgencyResearch(opportunity.opportunityId, demo));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setLoadingResearch(false);
    }
  }

  async function loadCompetitorIntel() {
    setLoadingIntel(true);
    setError(null);
    try {
      setCompetitorIntel(await fetchCompetitorIntel(opportunity.opportunityId, demo));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Competitor intel failed");
    } finally {
      setLoadingIntel(false);
    }
  }

  const locationLabel = [opportunity.city, opportunity.county, opportunity.state]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join(", ");

  return (
    <div className="h-full space-y-5 overflow-y-auto p-4">
      <BuyingCommitteeMap contacts={contacts} />

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Agency profile
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loadingProfile}
              onClick={() => void loadProfile()}
              className="rounded border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-800 disabled:opacity-50"
            >
              {loadingProfile ? "Loading…" : profile ? "Refresh profile" : "Load profile"}
            </button>
            <button
              type="button"
              disabled={loadingResearch}
              onClick={() => void loadResearch()}
              className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
            >
              {loadingResearch ? "Researching…" : "Research Agency"}
            </button>
          </div>
        </div>

        {error && <p className="mb-2 text-[11px] text-red-400">{error}</p>}

        <div className="space-y-2 rounded border border-slate-800 bg-slate-900/50 p-4 text-[11px] text-slate-400">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Agency</span>
            <span className="text-slate-200">{opportunity.agencyName}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Type</span>
            <span>{opportunity.agencyType.replace(/_/g, " ")}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Location</span>
            <span>{locationLabel || "—"}</span>
          </div>
          {opportunity.population != null && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Population</span>
              <span>{opportunity.population.toLocaleString()}</span>
            </div>
          )}
          {opportunity.estimatedDollarValue != null && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Est. value</span>
              <span className="font-semibold text-amber-300">
                {formatCurrency(opportunity.estimatedDollarValue)}
              </span>
            </div>
          )}
          {opportunity.incumbentVendor && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Incumbent</span>
              <span>{opportunity.incumbentVendor}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Intent stage</span>
            <span className="capitalize">{opportunity.intentStage.replace(/_/g, " ")}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Last signal</span>
            <span>{formatShortDate(opportunity.lastSignalAt)}</span>
          </div>

          {loadingProfile && !profile && (
            <div className="mt-3 border-t border-slate-800 pt-3 text-[10px] text-slate-600">
              Generating agency profile…
            </div>
          )}

          {profile && (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-800 pt-3 text-[11px]">
              {[
                {
                  label: "Annual Calls",
                  value: profile.annualCallVolume?.toLocaleString() ?? "—",
                },
                {
                  label: "Dispatchers",
                  value: profile.dispatcherCount?.toLocaleString() ?? "—",
                },
                {
                  label: "Population",
                  value: profile.populationServed?.toLocaleString() ?? "—",
                },
                {
                  label: "Est. Budget",
                  value: profile.estimatedBudget
                    ? `$${(profile.estimatedBudget / 1000).toFixed(0)}K/yr`
                    : "—",
                },
                { label: "CAD Vendor", value: profile.currentCadVendor ?? "Unknown" },
                { label: "PSAP Type", value: profile.psapType ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="w-24 shrink-0 text-slate-500">{label}</span>
                  <span
                    className={`font-medium ${
                      value === "—" || value === "Unknown" ? "text-slate-600" : "text-slate-200"
                    }`}
                  >
                    {value}
                  </span>
                </div>
              ))}
              {profile.cadNotes && (
                <div className="col-span-2 text-[10px] italic text-slate-500">{profile.cadNotes}</div>
              )}
              {profile.notes && (
                <div className="col-span-2 text-[10px] text-slate-500">{profile.notes}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {research && (
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Agency research
          </div>
          <pre className="whitespace-pre-wrap rounded border border-slate-800 bg-slate-900/40 p-3 font-sans text-[11px] leading-relaxed text-slate-300">
            {research}
          </pre>
        </div>
      )}

      {opportunity.incumbentVendor && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Competitor displacement
            </div>
            <button
              type="button"
              disabled={loadingIntel}
              onClick={() => void loadCompetitorIntel()}
              className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              {loadingIntel ? "Loading…" : competitorIntel ? "Refresh intel" : "Generate intel"}
            </button>
          </div>
          {competitorIntel && (
            <pre className="whitespace-pre-wrap rounded border border-red-500/20 bg-red-500/5 p-3 font-sans text-[11px] leading-relaxed text-slate-300">
              {competitorIntel}
            </pre>
          )}
        </div>
      )}

      <div>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Target personas ({opportunity.vertical})
        </div>
        <div className="space-y-2">
          {roles.map((role) => {
            const match = contacts.find((c) => c.roleTier === role.tier);
            return (
              <div
                key={role.tier}
                className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/30 px-3 py-2"
              >
                <div>
                  <div className="text-[11px] font-semibold text-slate-300">{role.label}</div>
                  <div className="text-[10px] text-slate-600">Match: {role.matchedOn}</div>
                </div>
                <div className="text-right text-[11px]">
                  {match?.name ? (
                    <span className="text-emerald-400">{match.name}</span>
                  ) : (
                    <span className="text-slate-600">Not found</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {opportunity.notes && (
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Notes</div>
          <p className="text-[11px] leading-relaxed text-slate-400">{opportunity.notes}</p>
        </div>
      )}
    </div>
  );
}
