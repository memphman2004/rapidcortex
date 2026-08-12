"use client";

import type { ContactCompany } from "@/lib/contacts/api";
import { RELATIONSHIP_BORDER, RELATIONSHIP_COLORS } from "@/lib/contacts/api";

type Props = {
  company: ContactCompany;
  selected: boolean;
  onSelect: () => void;
};

export function CompanyCard({ company, selected, onSelect }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={[
        "cursor-pointer border-b border-slate-900/80 border-l-2 px-4 py-3 transition-colors",
        "hover:bg-slate-900/60",
        RELATIONSHIP_BORDER[company.relationshipType],
        selected ? "bg-sky-950/40" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-100">{company.name}</div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            {company.industry ?? "—"}
            {company.hq ? ` · ${company.hq}` : ""}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${RELATIONSHIP_COLORS[company.relationshipType]}`}
        >
          {company.relationshipType}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-600">
        <span>
          {company.contactCount} contact{company.contactCount !== 1 ? "s" : ""}
        </span>
        {company.verticals.length > 0 && <span>{company.verticals.join(" · ")}</span>}
        {company.linkedSignalIds.length > 0 && (
          <span className="text-sky-600">
            {company.linkedSignalIds.length} signal
            {company.linkedSignalIds.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
