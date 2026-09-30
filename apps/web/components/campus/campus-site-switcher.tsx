"use client";

import {
  CAMPUS_SITE_SCOPE_ALL,
  type CampusInstitutionType,
  type CampusSite,
} from "rapid-cortex-shared";
import { useCampusInstitutionType } from "@/lib/campus/use-campus-institution";

export function CampusSiteSwitcher({
  sites,
  value,
  onChange,
  variant = "page",
  institutionType: institutionTypeProp,
}: {
  sites: CampusSite[];
  value: string;
  onChange: (next: string) => void;
  variant?: "page" | "console";
  /** Override when rendered outside CampusInstitutionProvider. */
  institutionType?: CampusInstitutionType;
}) {
  if (sites.length <= 1) return null;

  const { institutionType: ctxType } = useCampusInstitutionType();
  const isK12 = (institutionTypeProp ?? ctxType) === "k12";
  const isConsole = variant === "console";
  const noun = isK12 ? "School" : "Campus";
  const allLabel = isK12 ? "All schools" : "All campuses";

  return (
    <label
      className={
        isConsole
          ? undefined
          : "block text-[10px] font-semibold uppercase tracking-widest text-slate-400"
      }
      style={
        isConsole
          ? { display: "flex", flexDirection: "column", gap: 4, minWidth: 200 }
          : undefined
      }
    >
      <span style={isConsole ? { fontSize: 10, color: "#94a3b8", fontWeight: 600 } : undefined}>
        {noun}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${noun} filter`}
        className={
          isConsole
            ? undefined
            : "mt-1 w-full min-w-[12rem] rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
        }
        style={
          isConsole
            ? {
                background: "#0f172a",
                color: "#e2e8f0",
                border: "1px solid #334155",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12,
              }
            : undefined
        }
      >
        <option value={CAMPUS_SITE_SCOPE_ALL}>{allLabel}</option>
        {sites.map((site) => (
          <option key={site.code} value={site.code}>
            {site.name}
            {site.city ? ` · ${site.city}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
