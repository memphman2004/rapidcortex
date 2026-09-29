import type { CampusInstitutionType } from "./institution-type.js";

export interface CampusIncidentTypeConfig {
  value: string;
  label: string;
  severity: "low" | "medium" | "high" | "critical";
  requiresEscalation?: boolean;
  autoLockdown?: boolean;
}

export const HIGHER_ED_INCIDENT_TYPES: CampusIncidentTypeConfig[] = [
  { value: "theft", label: "Theft", severity: "medium" },
  { value: "assault", label: "Assault", severity: "high", requiresEscalation: true },
  { value: "dui", label: "DUI / DWI", severity: "medium" },
  { value: "vandalism", label: "Vandalism", severity: "low" },
  {
    value: "sexual_offense",
    label: "Sexual Offense",
    severity: "critical",
    requiresEscalation: true,
  },
  { value: "bias_hate", label: "Bias / Hate Incident", severity: "high" },
  { value: "drug_offense", label: "Drug Offense", severity: "medium" },
  { value: "trespassing", label: "Trespassing", severity: "medium" },
  {
    value: "mental_health",
    label: "Mental Health Crisis",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "weapon",
    label: "Weapon",
    severity: "critical",
    requiresEscalation: true,
    autoLockdown: true,
  },
  {
    value: "missing_person",
    label: "Missing Person",
    severity: "critical",
    requiresEscalation: true,
  },
  {
    value: "fire",
    label: "Fire / Smoke",
    severity: "critical",
    requiresEscalation: true,
    autoLockdown: true,
  },
  { value: "other", label: "Other", severity: "low" },
];

export const K12_INCIDENT_TYPES: CampusIncidentTypeConfig[] = [
  {
    value: "fight",
    label: "Student Fight / Altercation",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "weapon",
    label: "Weapon on Campus",
    severity: "critical",
    requiresEscalation: true,
    autoLockdown: true,
  },
  { value: "drug_substance", label: "Drug / Substance", severity: "high" },
  { value: "bullying", label: "Bullying / Harassment", severity: "medium" },
  {
    value: "trespasser",
    label: "Trespasser / Unauthorized Entry",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "medical",
    label: "Medical Emergency",
    severity: "critical",
    requiresEscalation: true,
  },
  { value: "property_damage", label: "Property Damage", severity: "low" },
  { value: "theft", label: "Theft", severity: "medium" },
  { value: "suspicious", label: "Suspicious Person / Vehicle", severity: "medium" },
  {
    value: "lockdown_threat",
    label: "Lockdown / Threat",
    severity: "critical",
    requiresEscalation: true,
    autoLockdown: true,
  },
  { value: "parent_dispute", label: "Parent / Guardian Dispute", severity: "medium" },
  { value: "welfare_check", label: "Welfare Check", severity: "medium" },
  { value: "other", label: "Other", severity: "low" },
];

export function getIncidentTypes(t: CampusInstitutionType): CampusIncidentTypeConfig[] {
  return t === "k12" ? K12_INCIDENT_TYPES : HIGHER_ED_INCIDENT_TYPES;
}
