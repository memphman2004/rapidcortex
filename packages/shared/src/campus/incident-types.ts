import type { CampusInstitutionType } from "./institution-type.js";
import { getK12GroupForType, type K12IncidentGroupId } from "./k12-intake.js";

export interface CampusIncidentTypeConfig {
  value: string;
  label: string;
  /** Short guidance for reporters / intake forms. */
  description?: string;
  severity: "low" | "medium" | "high" | "critical";
  requiresEscalation?: boolean;
  autoLockdown?: boolean;
  /** K-12 parent category for grouped pickers. */
  groupId?: K12IncidentGroupId;
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

/**
 * K-12 incident / concern types for students, teachers, parents, and staff.
 * Selected type drives intake questions, routing, urgency, and escalation.
 */
export const K12_INCIDENT_TYPES: CampusIncidentTypeConfig[] = [
  {
    value: "active_threat",
    label: "Active Threat / Immediate Danger",
    description:
      "Weapon seen, active shooter, person threatening violence, immediate life-safety danger",
    severity: "critical",
    requiresEscalation: true,
    autoLockdown: true,
  },
  {
    value: "weapon_concern",
    label: "Weapon Concern",
    description: "Firearm, knife, suspected weapon, ammunition, weapon-related social media post",
    severity: "critical",
    requiresEscalation: true,
    autoLockdown: true,
  },
  {
    value: "threat_of_violence",
    label: "Threat of Violence",
    description: "Verbal, written, online, or communicated threat toward a student, employee, or school",
    severity: "critical",
    requiresEscalation: true,
  },
  {
    value: "fight",
    label: "Fight / Physical Altercation",
    description: "Fighting, assault, attempted assault, group fight",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "bullying",
    label: "Bullying",
    description: "Physical, verbal, social, relational, or repeated intimidation",
    severity: "medium",
  },
  {
    value: "cyberbullying",
    label: "Cyberbullying / Online Harassment",
    description: "Threatening messages, social media harassment, impersonation, harmful posts",
    severity: "medium",
  },
  {
    value: "harassment",
    label: "Harassment / Intimidation",
    description: "Unwanted behavior, threats, coercion, stalking, or intimidation",
    severity: "medium",
  },
  {
    value: "sexual_misconduct",
    label: "Sexual Harassment / Sexual Misconduct",
    description: "Inappropriate touching, comments, messages, images, or reported sexual misconduct",
    severity: "critical",
    requiresEscalation: true,
  },
  {
    value: "hazing",
    label: "Hazing",
    description: "Forced, coercive, humiliating, or dangerous initiation behavior",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "student_welfare",
    label: "Student Welfare Concern",
    description: "Concern about a student's immediate safety or well-being",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "self_harm",
    label: "Self-Harm / Suicide Concern",
    description: "Statements, behavior, messages, or other indications of possible self-harm or suicide",
    severity: "critical",
    requiresEscalation: true,
  },
  {
    value: "mental_emotional_distress",
    label: "Mental/Emotional Distress",
    description: "Student in significant distress, crisis, panic, or behavioral crisis",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "abuse_neglect",
    label: "Abuse / Neglect Concern",
    description: "Suspected child abuse, neglect, exploitation, or unsafe home circumstances",
    severity: "critical",
    requiresEscalation: true,
  },
  {
    value: "missing_student",
    label: "Missing / Unaccounted-for Student",
    description: "Student cannot be located or has unexpectedly left supervision",
    severity: "critical",
    requiresEscalation: true,
  },
  {
    value: "runaway_elopement",
    label: "Runaway / Elopement",
    description: "Student intentionally leaves the school, classroom, bus, or supervised area",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "suspicious_person",
    label: "Suspicious Person",
    description: "Unknown or unauthorized person, concerning behavior, attempted access",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "unauthorized_visitor",
    label: "Unauthorized Visitor / Trespassing",
    description: "Person entering or remaining on school property without authorization",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "suspicious_activity",
    label: "Suspicious Activity",
    description: "Unusual behavior, surveillance, suspicious vehicle, abandoned item, or other concerning activity",
    severity: "medium",
  },
  {
    value: "drug_alcohol",
    label: "Drug / Alcohol Concern",
    description: "Possession, use, distribution, suspected impairment, vaping, or drug paraphernalia",
    severity: "high",
  },
  {
    value: "overdose_poisoning",
    label: "Overdose / Poisoning",
    description: "Suspected overdose, ingestion, poisoning, or dangerous substance exposure",
    severity: "critical",
    requiresEscalation: true,
  },
  {
    value: "medical_emergency",
    label: "Medical Emergency",
    description: "Serious injury, allergic reaction, seizure, breathing problem, unconscious person, etc.",
    severity: "critical",
    requiresEscalation: true,
  },
  {
    value: "injury_accident",
    label: "Injury / Accident",
    description: "Non-emergency student, employee, visitor, playground, athletic, or classroom injury",
    severity: "medium",
  },
  {
    value: "vaping_tobacco",
    label: "Vaping / Tobacco",
    description: "Vaping devices, cigarettes, nicotine products, or related activity",
    severity: "low",
  },
  {
    value: "fire_smoke",
    label: "Fire / Smoke",
    description: "Visible fire, smoke, burning odor, or suspected fire condition",
    severity: "critical",
    requiresEscalation: true,
    autoLockdown: true,
  },
  {
    value: "hazardous_material",
    label: "Hazardous Material / Chemical Concern",
    description: "Spill, gas odor, laboratory incident, unknown substance, exposure",
    severity: "critical",
    requiresEscalation: true,
  },
  {
    value: "bomb_threat",
    label: "Bomb Threat / Suspicious Package",
    description: "Bomb threat, suspicious package, unattended item, or explosive concern",
    severity: "critical",
    requiresEscalation: true,
    autoLockdown: true,
  },
  {
    value: "bus_transportation",
    label: "School Bus / Transportation Incident",
    description:
      "Unsafe behavior, fight, medical issue, suspicious person, crash, driver concern, or other transportation issue",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "traffic_parking",
    label: "Traffic / Parking Safety",
    description: "Dangerous driving, blocked emergency access, pickup/drop-off safety, pedestrian concern",
    severity: "medium",
  },
  {
    value: "facility_hazard",
    label: "Facility / Safety Hazard",
    description: "Broken door/lock, exposed wiring, water leak, damaged railing, unsafe playground equipment",
    severity: "medium",
  },
  {
    value: "security_access",
    label: "Security Door / Access Concern",
    description: "Propped door, failed lock, unauthorized access, missing key/card",
    severity: "high",
  },
  {
    value: "vandalism",
    label: "Vandalism / Property Damage",
    description: "Intentional damage to school or personal property",
    severity: "low",
  },
  {
    value: "theft",
    label: "Theft / Missing Property",
    description: "Stolen or missing school/student/staff property",
    severity: "medium",
  },
  {
    value: "cybersecurity",
    label: "Technology / Cybersecurity Concern",
    description: "Suspicious login, compromised account, phishing, inappropriate system access, cyber incident",
    severity: "high",
  },
  {
    value: "inappropriate_content",
    label: "Inappropriate Content / Social Media Concern",
    description: "Disturbing post, threatening content, explicit material, rumor of planned incident",
    severity: "high",
  },
  {
    value: "discrimination_bias",
    label: "Discrimination / Bias Incident",
    description: "Reported discriminatory conduct, slurs, targeted harassment, or bias-related behavior",
    severity: "high",
  },
  {
    value: "gang_related",
    label: "Gang-Related Concern",
    description: "Suspected recruitment, threats, symbols, activity, or conflict",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "trafficking_exploitation",
    label: "Sex Trafficking / Exploitation Concern",
    description: "Suspected grooming, trafficking, exploitation, or coercion",
    severity: "critical",
    requiresEscalation: true,
  },
  {
    value: "custody_pickup",
    label: "Custody / Unauthorized Pickup Concern",
    description: "Custody restriction, unauthorized adult attempting pickup, or family-related security issue",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "staff_conduct",
    label: "Staff Conduct Concern",
    description: "Reported inappropriate, unsafe, or concerning employee/contractor conduct",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "student_conduct",
    label: "Student Conduct Concern",
    description: "Disruptive or unsafe behavior that doesn't fit another category",
    severity: "medium",
  },
  {
    value: "animal_wildlife",
    label: "Animal / Wildlife Concern",
    description: "Aggressive animal, loose animal, wildlife on campus, bite, or other animal hazard",
    severity: "medium",
  },
  {
    value: "severe_weather",
    label: "Severe Weather / Environmental Hazard",
    description: "Flooding, tornado damage, extreme heat, fallen tree, ice, lightning, etc.",
    severity: "high",
    requiresEscalation: true,
  },
  {
    value: "event_athletic",
    label: "Event / Athletic Safety Concern",
    description: "Issue at a game, assembly, field trip, dance, graduation, or school-sponsored event",
    severity: "medium",
  },
  {
    value: "other",
    label: "Other Safety Concern",
    description: "Free-text report when none of the categories fit",
    severity: "low",
  },
];

/** Map legacy / operational type codes onto the current K-12 catalog. */
export const K12_INCIDENT_TYPE_ALIASES: Record<string, string> = {
  // Prior short catalog
  weapon: "weapon_concern",
  drug_substance: "drug_alcohol",
  trespasser: "unauthorized_visitor",
  medical: "medical_emergency",
  property_damage: "vandalism",
  suspicious: "suspicious_person",
  lockdown_threat: "active_threat",
  parent_dispute: "custody_pickup",
  welfare_check: "student_welfare",
  // QR / public report codes
  security: "unauthorized_visitor",
  suspicious_activity: "suspicious_activity",
  property_crime: "theft",
  wellness_check: "student_welfare",
  active_threat: "active_threat",
  mental_health: "mental_emotional_distress",
  facility_hazard: "facility_hazard",
  fire: "fire_smoke",
  missing_person: "missing_student",
};

export function normalizeK12IncidentType(type: string): string {
  const raw = String(type ?? "").trim();
  if (!raw) return "other";
  if (K12_INCIDENT_TYPES.some((t) => t.value === raw)) return raw;
  return K12_INCIDENT_TYPE_ALIASES[raw] ?? "other";
}

export function getIncidentTypes(t: CampusInstitutionType): CampusIncidentTypeConfig[] {
  if (t !== "k12") return HIGHER_ED_INCIDENT_TYPES;
  return K12_INCIDENT_TYPES.map((type) => ({
    ...type,
    groupId: type.groupId ?? getK12GroupForType(type.value),
  }));
}

export function getIncidentTypeLabel(
  institutionType: CampusInstitutionType,
  type: string,
): string {
  const catalog = getIncidentTypes(institutionType);
  const normalized = institutionType === "k12" ? normalizeK12IncidentType(type) : type;
  return catalog.find((t) => t.value === normalized)?.label ?? type;
}
