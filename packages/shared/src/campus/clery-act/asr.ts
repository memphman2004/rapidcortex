import type {
  CleryActGeography,
  CleryOffenseCategory,
  CleryRecord,
  HateCrimeBias,
  VAWAOffenseType,
} from "./schemas.js";
import {
  CRIMINAL_OFFENSE_CATEGORIES,
  HATE_CRIME_BIASES,
  VAWA_OFFENSE_CATEGORIES,
} from "./schemas.js";

/**
 * Part 6.3 — required on every generated ASR PDF and ED survey export.
 * Do not remove or paraphrase in generated artifacts.
 */
export const ASR_DISCLAIMER_TEMPLATE = `This Annual Security Report was prepared using data from the Rapid Cortex campus safety platform and reviewed by {{institutionName}}'s designated Clery Coordinator. Rapid Cortex provides data collection, classification workflow, and report generation tools. Final responsibility for Clery Act compliance, including the accuracy of all statistics and policy statements, rests with {{institutionName}}. This report does not constitute legal advice. For questions about Clery Act compliance, contact the U.S. Department of Education, Office of Postsecondary Education, at ope.ed.gov.`;

export function formatAsrDisclaimer(institutionName: string): string {
  const name = institutionName.trim() || "the institution";
  return ASR_DISCLAIMER_TEMPLATE.replaceAll("{{institutionName}}", name);
}

export type ASRGeoCounts = {
  onCampus: number;
  onCampusResidential: number;
  nonCampus: number;
  publicProperty: number;
  unfounded: number;
};

export type ASROffenseRow = ASRGeoCounts & {
  calendarYear: number;
  offenseCategory: CleryOffenseCategory;
};

export type ASRArrestRow = ASRGeoCounts & {
  calendarYear: number;
  offenseCategory: CleryOffenseCategory;
};

export type ASRHateCrimeRow = {
  calendarYear: number;
  offenseCategory: CleryOffenseCategory;
  biasCategoryBreakdown: Record<HateCrimeBias, Omit<ASRGeoCounts, "unfounded">>;
};

export type ASRVAWARow = ASRGeoCounts & {
  calendarYear: number;
  offenseType: VAWAOffenseType;
};

export type ASRStatisticsBlock = {
  offenses: ASROffenseRow[];
  arrests: ASRArrestRow[];
  referrals: ASRArrestRow[];
  hateCrimes: ASRHateCrimeRow[];
  vawa: ASRVAWARow[];
};

function emptyGeo(): ASRGeoCounts {
  return { onCampus: 0, onCampusResidential: 0, nonCampus: 0, publicProperty: 0, unfounded: 0 };
}

function emptyBiasGeo(): Omit<ASRGeoCounts, "unfounded"> {
  return { onCampus: 0, onCampusResidential: 0, nonCampus: 0, publicProperty: 0 };
}

function bumpGeo(counts: ASRGeoCounts, geo: CleryActGeography, residential: boolean): void {
  if (geo === "NOT_CLERY_REPORTABLE") return;
  if (geo === "ON_CAMPUS" || geo === "ON_CAMPUS_RESIDENTIAL") {
    counts.onCampus += 1;
    if (residential || geo === "ON_CAMPUS_RESIDENTIAL") counts.onCampusResidential += 1;
  } else if (geo === "NON_CAMPUS") {
    counts.nonCampus += 1;
  } else if (geo === "PUBLIC_PROPERTY") {
    counts.publicProperty += 1;
  }
}

function bumpBiasGeo(
  counts: Omit<ASRGeoCounts, "unfounded">,
  geo: CleryActGeography,
  residential: boolean,
): void {
  if (geo === "NOT_CLERY_REPORTABLE") return;
  if (geo === "ON_CAMPUS" || geo === "ON_CAMPUS_RESIDENTIAL") {
    counts.onCampus += 1;
    if (residential || geo === "ON_CAMPUS_RESIDENTIAL") counts.onCampusResidential += 1;
  } else if (geo === "NON_CAMPUS") {
    counts.nonCampus += 1;
  } else if (geo === "PUBLIC_PROPERTY") {
    counts.publicProperty += 1;
  }
}

function key(year: number, cat: string): string {
  return `${year}#${cat}`;
}

/**
 * ASR statistics: only `CLASSIFIED` records count in offense/arrest/referral/VAWA/hate totals.
 * `UNFOUNDED` is counted only in the separate unfounded column — never in offense totals.
 * `PENDING_REVIEW`, `PENDING_INFORMATION`, and `EXCLUDED` never count.
 */
export function generateAsrStatistics(
  records: readonly CleryRecord[],
  coverageYears: readonly number[],
): ASRStatisticsBlock {
  const years = new Set(coverageYears);
  const offenseMap = new Map<string, ASROffenseRow>();
  const arrestMap = new Map<string, ASRArrestRow>();
  const referralMap = new Map<string, ASRArrestRow>();
  const vawaMap = new Map<string, ASRVAWARow>();
  const hateMap = new Map<string, ASRHateCrimeRow>();

  const ensureOffense = (year: number, cat: CleryOffenseCategory): ASROffenseRow => {
    const k = key(year, cat);
    let row = offenseMap.get(k);
    if (!row) {
      row = { calendarYear: year, offenseCategory: cat, ...emptyGeo() };
      offenseMap.set(k, row);
    }
    return row;
  };

  for (const year of coverageYears) {
    for (const cat of CRIMINAL_OFFENSE_CATEGORIES) ensureOffense(year, cat);
  }

  for (const rec of records) {
    if (!years.has(rec.reportingCalendarYear)) continue;
    const year = rec.reportingCalendarYear;
    const geo = rec.cleryGeography;
    const residential = rec.isResidentialFacility || geo === "ON_CAMPUS_RESIDENTIAL";
    const offense = rec.primaryOffense;

    if (rec.status === "UNFOUNDED") {
      if ((CRIMINAL_OFFENSE_CATEGORIES as readonly string[]).includes(offense)) {
        ensureOffense(year, offense).unfounded += 1;
      }
      continue;
    }

    if (rec.status !== "CLASSIFIED") continue;
    if (offense === "NOT_CLERY_REPORTABLE") continue;

    if ((CRIMINAL_OFFENSE_CATEGORIES as readonly string[]).includes(offense)) {
      bumpGeo(ensureOffense(year, offense), geo, residential);
    }

    if (offense.startsWith("ARREST_")) {
      const k = key(year, offense);
      let row = arrestMap.get(k);
      if (!row) {
        row = { calendarYear: year, offenseCategory: offense, ...emptyGeo() };
        arrestMap.set(k, row);
      }
      bumpGeo(row, geo, residential);
    }

    if (offense.startsWith("REFERRAL_")) {
      const k = key(year, offense);
      let row = referralMap.get(k);
      if (!row) {
        row = { calendarYear: year, offenseCategory: offense, ...emptyGeo() };
        referralMap.set(k, row);
      }
      bumpGeo(row, geo, residential);
    }

    if ((VAWA_OFFENSE_CATEGORIES as readonly string[]).includes(offense)) {
      const k = key(year, offense);
      let row = vawaMap.get(k);
      if (!row) {
        row = {
          calendarYear: year,
          offenseType: offense as VAWAOffenseType,
          ...emptyGeo(),
        };
        vawaMap.set(k, row);
      }
      bumpGeo(row, geo, residential);
    }

    if (rec.isHateCrime) {
      const hateCat = offense;
      const k = key(year, hateCat);
      let row = hateMap.get(k);
      if (!row) {
        const biasCategoryBreakdown = {} as ASRHateCrimeRow["biasCategoryBreakdown"];
        for (const bias of HATE_CRIME_BIASES) {
          biasCategoryBreakdown[bias] = emptyBiasGeo();
        }
        row = { calendarYear: year, offenseCategory: hateCat, biasCategoryBreakdown };
        hateMap.set(k, row);
      }
      const biases = rec.hateCrimeBiasCategories.length > 0 ? rec.hateCrimeBiasCategories : [];
      for (const bias of biases) {
        bumpBiasGeo(row.biasCategoryBreakdown[bias], geo, residential);
      }
    }
  }

  const sortRows = <T extends { calendarYear: number; offenseCategory?: string; offenseType?: string }>(
    rows: T[],
  ): T[] =>
    [...rows].sort((a, b) => {
      if (a.calendarYear !== b.calendarYear) return a.calendarYear - b.calendarYear;
      const ak = a.offenseCategory ?? a.offenseType ?? "";
      const bk = b.offenseCategory ?? b.offenseType ?? "";
      return ak.localeCompare(bk);
    });

  return {
    offenses: sortRows([...offenseMap.values()]),
    arrests: sortRows([...arrestMap.values()]),
    referrals: sortRows([...referralMap.values()]),
    hateCrimes: sortRows([...hateMap.values()]),
    vawa: sortRows([...vawaMap.values()]),
  };
}

export function asrStatisticsToEdSurveyCsv(
  institutionName: string,
  reportYear: number,
  stats: ASRStatisticsBlock,
): string {
  const disclaimer = formatAsrDisclaimer(institutionName).replaceAll('"', '""');
  const lines: string[] = [
    `"${disclaimer}"`,
    "section,calendarYear,category,onCampus,onCampusResidential,nonCampus,publicProperty,unfounded",
  ];
  const push = (
    section: string,
    year: number,
    category: string,
    row: ASRGeoCounts,
  ) => {
    lines.push(
      [section, year, category, row.onCampus, row.onCampusResidential, row.nonCampus, row.publicProperty, row.unfounded].join(
        ",",
      ),
    );
  };
  for (const row of stats.offenses) {
    push("criminal_offense", row.calendarYear, row.offenseCategory, row);
  }
  for (const row of stats.arrests) {
    push("arrest", row.calendarYear, row.offenseCategory, row);
  }
  for (const row of stats.referrals) {
    push("referral", row.calendarYear, row.offenseCategory, row);
  }
  for (const row of stats.vawa) {
    push("vawa", row.calendarYear, row.offenseType, row);
  }
  lines.push(`# ASR reportYear=${reportYear} — https://ope.ed.gov/campussafety/#/`);
  return `${lines.join("\n")}\n`;
}
