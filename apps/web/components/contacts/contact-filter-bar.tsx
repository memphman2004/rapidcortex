"use client";

import type { ContactVertical, RelationshipType } from "rapid-cortex-shared";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  relationshipType: RelationshipType | "all";
  onTypeChange: (v: RelationshipType | "all") => void;
  vertical: ContactVertical | "all";
  onVerticalChange: (v: ContactVertical | "all") => void;
  onAddCompany: () => void;
};

export function ContactFilterBar({
  search,
  onSearchChange,
  relationshipType,
  onTypeChange,
  vertical,
  onVerticalChange,
  onAddCompany,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-[#0a1428] px-4 py-2.5">
      <span className="mr-1 text-sm font-semibold text-slate-100">Contacts</span>
      <select
        value={relationshipType}
        onChange={(e) => onTypeChange(e.target.value as RelationshipType | "all")}
        className="rounded-full border border-slate-700 bg-transparent px-3 py-1.5 text-[11px] text-slate-300 outline-none focus:border-sky-500"
      >
        <option value="all">All Types</option>
        <option value="prospect">Prospect</option>
        <option value="partner">Partner</option>
        <option value="competitor">Competitor</option>
        <option value="vendor">Vendor</option>
        <option value="influencer">Influencer</option>
        <option value="customer">Customer</option>
      </select>
      <select
        value={vertical}
        onChange={(e) => onVerticalChange(e.target.value as ContactVertical | "all")}
        className="rounded-full border border-slate-700 bg-transparent px-3 py-1.5 text-[11px] text-slate-300 outline-none focus:border-sky-500"
      >
        <option value="all">All Verticals</option>
        <option value="911">911</option>
        <option value="campus">Campus</option>
        <option value="venue">Venue</option>
      </select>
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search companies…"
        className="min-w-[10rem] flex-1 rounded-full border border-slate-700 bg-transparent px-3 py-1.5 text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-500"
      />
      <button
        type="button"
        onClick={onAddCompany}
        className="rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-500"
      >
        + Add Company
      </button>
    </div>
  );
}
