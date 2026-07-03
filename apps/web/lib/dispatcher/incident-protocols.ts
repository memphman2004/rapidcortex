/**
 * Canonical incident type definitions for Rapid Cortex dispatcher workspace.
 * Each type maps to a CAD nature code, default priority, and inline protocol hints.
 *
 * UI hints only — protocol enforcement and CAD write-back validation are server-side.
 */

export type IncidentPriority = "P1" | "P2" | "P3" | "P4";

export type IncidentDiscipline = "law" | "fire" | "ems" | "multi";

export interface IncidentTypeDefinition {
  id: string;
  label: string;
  icon: string;
  cadNatureCode: string;
  defaultPriority: IncidentPriority;
  discipline: IncidentDiscipline[];
  protocolHints: string[];
  supervisorAlert: boolean;
}

export const INCIDENT_TYPES: IncidentTypeDefinition[] = [
  {
    id: "assault",
    label: "Assault / Fight",
    icon: "⚡",
    cadNatureCode: "ASSLT",
    defaultPriority: "P1",
    discipline: ["law"],
    protocolHints: [
      "Confirm suspect(s) still on scene",
      "Obtain weapon description",
      "Establish number of victims / injuries",
      "Request EMS if injuries reported",
    ],
    supervisorAlert: true,
  },
  {
    id: "shots_fired",
    label: "Shots Fired",
    icon: "🔴",
    cadNatureCode: "SHOTS",
    defaultPriority: "P1",
    discipline: ["law"],
    protocolHints: [
      "Confirm location — intersection or address",
      "Direction shots were fired",
      "Suspect / vehicle description",
      "Any known injuries — stage EMS if needed",
    ],
    supervisorAlert: true,
  },
  {
    id: "structure_fire",
    label: "Structure Fire",
    icon: "🔥",
    cadNatureCode: "FIRE_STRUCT",
    defaultPriority: "P1",
    discipline: ["fire", "ems"],
    protocolHints: [
      "Is caller inside or outside?",
      "Confirm type of structure",
      "Anyone trapped / not evacuated?",
      "Visible flames vs smoke only",
    ],
    supervisorAlert: true,
  },
  {
    id: "cardiac",
    label: "Cardiac / Chest Pain",
    icon: "❤️",
    cadNatureCode: "CARD",
    defaultPriority: "P1",
    discipline: ["ems"],
    protocolHints: [
      "Patient conscious and breathing?",
      "Age, sex, location in structure",
      "Begin pre-arrival CPR instructions if needed",
      "AED available on scene?",
    ],
    supervisorAlert: false,
  },
  {
    id: "mvc",
    label: "Vehicle Crash",
    icon: "🚗",
    cadNatureCode: "MVC",
    defaultPriority: "P2",
    discipline: ["law", "fire", "ems"],
    protocolHints: [
      "Number of vehicles / injuries",
      "Road / intersection — mile marker if highway",
      "Confirm airbag deployment or entrapment",
      "Hazmat — fuel leak or cargo?",
    ],
    supervisorAlert: false,
  },
  {
    id: "welfare_check",
    label: "Welfare Check",
    icon: "👤",
    cadNatureCode: "WELF",
    defaultPriority: "P3",
    discipline: ["law"],
    protocolHints: [
      "Last seen / last contact date",
      "Any weapons or mental health history known",
      "Next of kin contact info",
    ],
    supervisorAlert: false,
  },
  {
    id: "burglary",
    label: "Burglary / Break-in",
    icon: "🔓",
    cadNatureCode: "BURG",
    defaultPriority: "P2",
    discipline: ["law"],
    protocolHints: [
      "In progress vs just discovered?",
      "Suspect description and last seen direction",
      "Point of entry confirmed?",
      "Is anyone inside?",
    ],
    supervisorAlert: false,
  },
  {
    id: "medical_general",
    label: "Medical Emergency",
    icon: "🚑",
    cadNatureCode: "MED_GEN",
    defaultPriority: "P2",
    discipline: ["ems"],
    protocolHints: [
      "Chief complaint",
      "Patient conscious and breathing?",
      "Address + apartment / floor confirmed",
      "Any access issues (locked gate, elevator)?",
    ],
    supervisorAlert: false,
  },
  {
    id: "domestic",
    label: "Domestic Disturbance",
    icon: "🏠",
    cadNatureCode: "DOM",
    defaultPriority: "P1",
    discipline: ["law"],
    protocolHints: [
      "Physical or verbal only?",
      "Weapons present or threatened?",
      "Children in the residence?",
      "Any prior domestic history at address",
    ],
    supervisorAlert: true,
  },
  {
    id: "overdose",
    label: "Drug Overdose",
    icon: "💊",
    cadNatureCode: "OD",
    defaultPriority: "P1",
    discipline: ["ems", "fire"],
    protocolHints: [
      "Conscious and breathing?",
      "Suspected substance if known",
      "Naloxone available on scene?",
      "Exact address — unit / floor",
    ],
    supervisorAlert: false,
  },
  {
    id: "disturbance",
    label: "Disturbance / Noise",
    icon: "📢",
    cadNatureCode: "DIST",
    defaultPriority: "P3",
    discipline: ["law"],
    protocolHints: [
      "Type of disturbance",
      "Number of people involved",
      "Any weapons mentioned",
    ],
    supervisorAlert: false,
  },
  {
    id: "other",
    label: "Other / Manual",
    icon: "📋",
    cadNatureCode: "OTHER",
    defaultPriority: "P4",
    discipline: ["law", "fire", "ems", "multi"],
    protocolHints: [
      "Document nature of call clearly",
      "Confirm location and callback number",
    ],
    supervisorAlert: false,
  },
];

export function getIncidentType(id: string): IncidentTypeDefinition | undefined {
  return INCIDENT_TYPES.find((t) => t.id === id);
}

export const PRIORITY_META: Record<
  IncidentPriority,
  { label: string; color: string; bg: string; border: string; description: string }
> = {
  P1: {
    label: "P1",
    color: "#fca5a5",
    bg: "#450a0a",
    border: "#991b1b",
    description: "Immediate life safety — all resources",
  },
  P2: {
    label: "P2",
    color: "#fcd34d",
    bg: "#451a03",
    border: "#92400e",
    description: "Urgent — expedited response",
  },
  P3: {
    label: "P3",
    color: "#93c5fd",
    bg: "#0c1a2e",
    border: "#1e40af",
    description: "Standard priority",
  },
  P4: {
    label: "P4",
    color: "#a1a1aa",
    bg: "#18181b",
    border: "#3f3f46",
    description: "Non-urgent / informational",
  },
};

/** Canonical PSAP supervisor / admin roles that see override controls in the slide-over. */
export const SUPERVISOR_CREATE_INCIDENT_ROLES = new Set([
  "supervisor",
  "agencyadmin",
  "agencyit",
  "rcsuperadmin",
  "rcadmin",
]);

export function isSupervisorCreateRole(role?: string): boolean {
  return !!role && SUPERVISOR_CREATE_INCIDENT_ROLES.has(role.toLowerCase());
}
