/**
 * Grant Writer — Grant program / name suggestion catalog.
 * Filters by existing agency type + state fields only (no new form fields).
 * Manual entry remains supported by the combobox; legacy typed names are never blocked.
 */

export type GrantVertical =
  | "psap"
  | "nexiq"
  | "campus_k12"
  | "campus_higher_ed"
  | "venue"
  | "transit";

export type GrantProgramSuggestion = {
  /** Official program name shown in the dropdown. */
  name: string;
  /** Product verticals this program may apply to. */
  verticals: readonly GrantVertical[];
  /**
   * USPS state codes. Omit or empty = national / federal (available in every state).
   * When set, the suggestion is added only when the agency state matches.
   */
  states?: readonly string[];
};

/** Retired from *new* suggestions — keep for documentation / tests only. */
export const RETIRED_GRANT_PROGRAM_SUGGESTIONS = [
  "ARPA / SLFRF",
  "PSAP NG911 Grant Program",
  "State Criminal Justice Grant",
  "FEMA Homeland Security Grant Program",
  "Edward Byrne Memorial JAG",
  "COPS Technology Program",
  "Congressionally Directed Spending (CDS)",
] as const;

/**
 * Map previously suggested names → current official names.
 * Used when loading the demonstration profile / normalizing known legacy picks.
 * Does not rewrite free-typed historical records in storage.
 */
export const LEGACY_GRANT_PROGRAM_NAME_MAP: Readonly<Record<string, string>> = {
  "COPS Technology Program": "COPS Technology and Equipment Program (TEP)",
  "Edward Byrne Memorial JAG": "Edward Byrne Memorial Justice Assistance Grant (JAG) — Local",
  "FEMA Homeland Security Grant Program": "FEMA State Homeland Security Program (SHSP)",
  "Congressionally Directed Spending (CDS)":
    "Congressionally Directed Spending (CDS) / Community Project Funding (CPF)",
};

/** National / federal programs (no state gate). */
const NATIONAL_GRANT_PROGRAMS: readonly GrantProgramSuggestion[] = [
  {
    name: "Edward Byrne Memorial Justice Assistance Grant (JAG) — Local",
    verticals: ["psap", "nexiq"],
  },
  {
    name: "Edward Byrne Memorial Justice Assistance Grant (JAG) — State",
    verticals: ["psap", "nexiq"],
  },
  {
    name: "COPS Technology and Equipment Program (TEP)",
    verticals: ["psap", "nexiq"],
  },
  {
    name: "FEMA State Homeland Security Program (SHSP)",
    verticals: ["psap", "campus_k12", "campus_higher_ed", "venue", "transit"],
  },
  {
    name: "FEMA Urban Area Security Initiative (UASI)",
    verticals: ["psap", "campus_k12", "campus_higher_ed", "venue", "transit"],
  },
  {
    name: "FEMA Emergency Management Performance Grant (EMPG)",
    verticals: ["psap"],
  },
  {
    name: "USDA Community Facilities Direct Loan & Grant Program",
    verticals: ["psap"],
  },
  {
    name: "FTA Urbanized Area Formula Grants — Section 5307",
    verticals: ["transit"],
  },
  {
    name: "FEMA Transit Security Grant Program (TSGP)",
    verticals: ["transit"],
  },
  {
    name: "COPS School Violence Prevention Program (SVPP)",
    verticals: ["campus_k12"],
  },
  {
    name: "BJA STOP School Violence Program",
    verticals: ["campus_k12", "campus_higher_ed"],
  },
  {
    name: "FEMA Nonprofit Security Grant Program (NSGP)",
    verticals: ["campus_k12", "campus_higher_ed", "venue"],
  },
  {
    name: "Congressionally Directed Spending (CDS) / Community Project Funding (CPF)",
    verticals: ["psap", "nexiq", "campus_k12", "campus_higher_ed", "venue", "transit"],
  },
];

/**
 * Verified state-specific programs only.
 * Oklahoma statewide title intentionally omitted until confirmed.
 * Missouri closed historical rounds intentionally omitted from new suggestions.
 */
const STATE_GRANT_PROGRAMS: readonly GrantProgramSuggestion[] = [
  {
    name: "Arizona 9-1-1 Program — Funding Assistance",
    states: ["AZ"],
    verticals: ["psap"],
  },
  {
    name: "911 ACOG Grant Program",
    states: ["OK"],
    verticals: ["psap"],
  },
  {
    name: "Wisconsin PSAP Grant Program",
    states: ["WI"],
    verticals: ["psap"],
  },
  {
    name: "Wisconsin NG911 GIS Grant Program",
    states: ["WI"],
    verticals: ["psap"],
  },
  {
    name: "Virginia PSAP Resiliency Grant Program",
    states: ["VA"],
    verticals: ["psap"],
  },
];

export const ALL_GRANT_PROGRAM_SUGGESTIONS: readonly GrantProgramSuggestion[] = [
  ...NATIONAL_GRANT_PROGRAMS,
  ...STATE_GRANT_PROGRAMS,
];

/** Map wizard agency-type labels → product vertical for suggestion filtering. */
export function inferGrantVertical(agencyType: string): GrantVertical | null {
  const t = agencyType.trim().toLowerCase();
  if (!t) return null;

  if (
    t.includes("k-12") ||
    t.includes("k12") ||
    t.includes("school district") ||
    (t.includes("school") && !t.includes("university"))
  ) {
    return "campus_k12";
  }
  if (t.includes("university") || t.includes("higher education") || t.includes("campus public safety")) {
    return "campus_higher_ed";
  }
  if (t.includes("venue") || t.includes("stadium")) {
    return "venue";
  }
  if (t.includes("transit")) {
    return "transit";
  }
  if (
    t.includes("nexiq") ||
    t.includes("non-emergency") ||
    t.includes("call assist") ||
    t.includes("311")
  ) {
    return "nexiq";
  }
  if (
    t.includes("911") ||
    t.includes("psap") ||
    t.includes("ecc") ||
    t.includes("emergency communications") ||
    t.includes("sheriff") ||
    t.includes("police") ||
    t.includes("fire") ||
    t.includes("ems") ||
    t.includes("emergency management") ||
    t.includes("combined")
  ) {
    return "psap";
  }
  return null;
}

function normalizeStateCode(agencyState: string): string {
  return agencyState.trim().toUpperCase();
}

/**
 * Ordered, de-duplicated grant program names for the Grant Writer combobox.
 * - Filters by vertical when agency type maps to one.
 * - Adds verified state programs when agency state matches.
 * - With no vertical yet, returns national programs (+ matching state programs).
 */
export function suggestGrantPrograms(input: {
  agencyType?: string;
  agencyState?: string;
}): string[] {
  const vertical = inferGrantVertical(input.agencyType ?? "");
  const state = normalizeStateCode(input.agencyState ?? "");
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (name: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    out.push(name);
  };

  for (const program of NATIONAL_GRANT_PROGRAMS) {
    if (vertical && !program.verticals.includes(vertical)) continue;
    push(program.name);
  }

  if (state) {
    for (const program of STATE_GRANT_PROGRAMS) {
      if (!program.states?.includes(state)) continue;
      if (vertical && !program.verticals.includes(vertical)) continue;
      push(program.name);
    }
  }

  return out;
}

export function normalizeLegacyGrantProgramName(name: string): string {
  const trimmed = name.trim();
  return LEGACY_GRANT_PROGRAM_NAME_MAP[trimmed] ?? trimmed;
}
