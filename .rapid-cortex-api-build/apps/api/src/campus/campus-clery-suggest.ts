/**
 * Lightweight Clery category suggestion — no PDF/pdfkit imports.
 * Kept separate so incident list/get handlers do not pull fontkit/@swc/helpers
 * through campus-clery-service (which causes Lambda ImportModuleError).
 */
import type { CleryCategory } from "rapid-cortex-shared";
import type { CampusIncidentType } from "./campus-types.js";

const TYPE_TO_CLERY: Partial<Record<CampusIncidentType, CleryCategory>> = {
  property_crime: "Burglary",
  active_threat: "Aggravated Assault",
};

const KEYWORD_CLERY: Array<{ keywords: string[]; category: CleryCategory }> = [
  { keywords: ["arson", "fire", "set fire"], category: "Arson" },
  { keywords: ["robbery", "robbed", "stole from"], category: "Robbery" },
  { keywords: ["assault", "attacked", "hit", "punched"], category: "Aggravated Assault" },
  { keywords: ["car", "vehicle", "auto", "truck", "van"], category: "Motor Vehicle Theft" },
  { keywords: ["weapon", "gun", "knife", "firearm", "explosive"], category: "Arrests - Weapons Violations" },
  { keywords: ["drug", "narcotics", "marijuana", "cocaine", "pills"], category: "Arrests - Drug Abuse Violations" },
  { keywords: ["alcohol", "drunk", "intoxicated", "liquor"], category: "Arrests - Liquor Law Violations" },
  { keywords: ["stalk", "following me", "won't leave me alone"], category: "VAWA - Stalking" },
  { keywords: ["domestic", "partner", "spouse", "boyfriend", "girlfriend"], category: "VAWA - Domestic Violence" },
  { keywords: ["hazing"], category: "Hazing" },
];

/**
 * Keyword-based suggestion only — NEVER automatic classification.
 * Final determination must be made by designated Campus Security Authority.
 */
export function suggestCleryCategory(
  type: CampusIncidentType,
  description: string,
): CleryCategory | null {
  const lower = description.toLowerCase();
  const typeMatch = TYPE_TO_CLERY[type];
  if (typeMatch) return typeMatch;

  const matches = KEYWORD_CLERY.filter(({ keywords }) =>
    keywords.some((k) => lower.includes(k)),
  );
  if (matches.length === 1) return matches[0].category;
  return null;
}
