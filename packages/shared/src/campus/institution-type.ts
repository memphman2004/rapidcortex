export const CAMPUS_INSTITUTION_TYPES = ["higher_ed", "k12"] as const;
export type CampusInstitutionType = (typeof CAMPUS_INSTITUTION_TYPES)[number];

export const CAMPUS_INSTITUTION_LABELS: Record<CampusInstitutionType, string> = {
  higher_ed: "University / College",
  k12: "K-12 School District",
};

export function isCampusInstitutionType(value: unknown): value is CampusInstitutionType {
  return CAMPUS_INSTITUTION_TYPES.includes(value as CampusInstitutionType);
}

/**
 * Falls back to `higher_ed` — existing agencies without the field are unaffected.
 * Also maps legacy `campusType: "k12"` from campus config.
 */
export function parseCampusInstitutionType(value: unknown): CampusInstitutionType {
  if (value === "k12") return "k12";
  if (typeof value === "string" && value.trim().toLowerCase() === "k12") return "k12";
  return "higher_ed";
}

/** Prefer explicit institutionType; else derive from legacy campusType. */
export function resolveCampusInstitutionType(opts: {
  institutionType?: unknown;
  campusType?: unknown;
}): CampusInstitutionType {
  if (opts.institutionType === "k12" || opts.institutionType === "higher_ed") {
    return opts.institutionType;
  }
  if (opts.campusType === "k12") return "k12";
  return parseCampusInstitutionType(opts.institutionType);
}
