"use client";

import type { RapidIqContact, RapidIqOpportunity } from "@/lib/rapid-iq/types";
import { formatCurrency, formatShortDate } from "@/lib/rapid-iq/scoring";
import { CONTACT_ROLES_BY_VERTICAL } from "@/lib/rapid-iq/contact-roles";

type Props = {
  opportunity: RapidIqOpportunity;
  contacts: RapidIqContact[];
};

export function ContactIntelligenceTab({ opportunity, contacts }: Props) {
  const roles = CONTACT_ROLES_BY_VERTICAL[opportunity.vertical];

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5">
      <div>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Agency profile
        </div>
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 text-[11px] text-slate-400 space-y-2">
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
            <span>
              {opportunity.city}, {opportunity.county} County, {opportunity.state}
            </span>
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
        </div>
      </div>

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
