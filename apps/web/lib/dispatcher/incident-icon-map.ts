import type { LucideIcon } from "lucide-react";
import {
  Swords,
  Crosshair,
  Home,
  LockOpen,
  UserCheck,
  AlertOctagon,
  Landmark,
  CarFront,
  UserSearch,
  Gauge,
  UserX,
  CircleStop,
  Wine,
  Scroll,
  Eye,
  ShoppingBag,
  BellRing,
  Building2,
  Flame,
  Car,
  Wind,
  TriangleAlert,
  Waves,
  Building,
  TreePine,
  Zap,
  AirVent,
  HeartPulse,
  Stethoscope,
  Pill,
  Brain,
  Bandage,
  Droplet,
  ShieldAlert,
  Baby,
  Volume2,
  ClipboardList,
  Bell,
  PawPrint,
  KeyRound,
  CloudRain,
  HandHelping,
  ShieldCheck,
  Truck,
  MapPin,
  Tent,
  HeartHandshake,
  UserMinus,
  PersonStanding,
} from "lucide-react";
import type { IncidentPriority } from "@/lib/dispatcher/incident-protocols";

export type IncidentIconDiscipline = "law" | "fire" | "ems" | "other";

export type IncidentGridTab = "all" | "law" | "fire_ems" | "other";

export type IncidentIconEntry = {
  icon: LucideIcon;
  color: string;
  discipline: IncidentIconDiscipline;
  defaultPriority: IncidentPriority;
};

/** Canonical keys from the New Incident grid icon spec. */
const INCIDENT_ICON_MAP_CANONICAL: Record<string, IncidentIconEntry> = {
  // ── LAW (#60A5FA) ──────────────────────────────────────
  "assault-fight": { icon: Swords, color: "#60A5FA", discipline: "law", defaultPriority: "P2" },
  "shots-fired": { icon: Crosshair, color: "#60A5FA", discipline: "law", defaultPriority: "P1" },
  domestic: { icon: Home, color: "#60A5FA", discipline: "law", defaultPriority: "P2" },
  burglary: { icon: LockOpen, color: "#60A5FA", discipline: "law", defaultPriority: "P3" },
  "welfare-check": { icon: UserCheck, color: "#60A5FA", discipline: "law", defaultPriority: "P3" },
  "active-shooter": { icon: AlertOctagon, color: "#60A5FA", discipline: "law", defaultPriority: "P1" },
  robbery: { icon: Landmark, color: "#60A5FA", discipline: "law", defaultPriority: "P1" },
  "hit-and-run": { icon: CarFront, color: "#60A5FA", discipline: "law", defaultPriority: "P2" },
  "suspicious-person": { icon: UserSearch, color: "#60A5FA", discipline: "law", defaultPriority: "P3" },
  "vehicle-pursuit": { icon: Gauge, color: "#60A5FA", discipline: "law", defaultPriority: "P1" },
  "missing-person": { icon: UserX, color: "#60A5FA", discipline: "law", defaultPriority: "P3" },
  "traffic-stop": { icon: CircleStop, color: "#60A5FA", discipline: "law", defaultPriority: "P3" },
  dui: { icon: Wine, color: "#60A5FA", discipline: "law", defaultPriority: "P2" },
  warrant: { icon: Scroll, color: "#60A5FA", discipline: "law", defaultPriority: "P3" },
  stalking: { icon: Eye, color: "#60A5FA", discipline: "law", defaultPriority: "P3" },
  theft: { icon: ShoppingBag, color: "#60A5FA", discipline: "law", defaultPriority: "P3" },
  "alarm-residential": { icon: BellRing, color: "#60A5FA", discipline: "law", defaultPriority: "P3" },
  "alarm-commercial": { icon: Building2, color: "#60A5FA", discipline: "law", defaultPriority: "P3" },

  // ── FIRE (#F87171) ─────────────────────────────────────
  "structure-fire": { icon: Flame, color: "#F87171", discipline: "fire", defaultPriority: "P1" },
  "vehicle-crash": { icon: Car, color: "#F87171", discipline: "fire", defaultPriority: "P2" },
  "gas-leak": { icon: Wind, color: "#F87171", discipline: "fire", defaultPriority: "P2" },
  hazmat: { icon: TriangleAlert, color: "#F87171", discipline: "fire", defaultPriority: "P2" },
  "water-rescue": { icon: Waves, color: "#F87171", discipline: "fire", defaultPriority: "P1" },
  "building-collapse": { icon: Building, color: "#F87171", discipline: "fire", defaultPriority: "P1" },
  "brush-fire": { icon: TreePine, color: "#F87171", discipline: "fire", defaultPriority: "P2" },
  electrical: { icon: Zap, color: "#F87171", discipline: "fire", defaultPriority: "P2" },
  "carbon-monoxide": { icon: AirVent, color: "#F87171", discipline: "fire", defaultPriority: "P2" },

  // ── EMS (#4ADE80) ──────────────────────────────────────
  cardiac: { icon: HeartPulse, color: "#4ADE80", discipline: "ems", defaultPriority: "P1" },
  "medical-emergency": { icon: Stethoscope, color: "#4ADE80", discipline: "ems", defaultPriority: "P3" },
  "drug-overdose": { icon: Pill, color: "#4ADE80", discipline: "ems", defaultPriority: "P2" },
  stroke: { icon: Brain, color: "#4ADE80", discipline: "ems", defaultPriority: "P1" },
  trauma: { icon: Bandage, color: "#4ADE80", discipline: "ems", defaultPriority: "P2" },
  seizure: { icon: Zap, color: "#4ADE80", discipline: "ems", defaultPriority: "P3" },
  diabetic: { icon: Droplet, color: "#4ADE80", discipline: "ems", defaultPriority: "P3" },
  allergic: { icon: ShieldAlert, color: "#4ADE80", discipline: "ems", defaultPriority: "P2" },
  obstetric: { icon: Baby, color: "#4ADE80", discipline: "ems", defaultPriority: "P2" },
  "mental-health": { icon: HeartHandshake, color: "#4ADE80", discipline: "ems", defaultPriority: "P3" },
  unconscious: { icon: UserMinus, color: "#4ADE80", discipline: "ems", defaultPriority: "P1" },
  respiratory: { icon: Wind, color: "#4ADE80", discipline: "ems", defaultPriority: "P2" },
  "fall-injury": { icon: PersonStanding, color: "#4ADE80", discipline: "ems", defaultPriority: "P3" },
  "mvc-injury": { icon: Car, color: "#4ADE80", discipline: "ems", defaultPriority: "P2" },

  // ── OTHER (#C084FC) ────────────────────────────────────
  disturbance: { icon: Volume2, color: "#C084FC", discipline: "other", defaultPriority: "P3" },
  other: { icon: ClipboardList, color: "#C084FC", discipline: "other", defaultPriority: "P4" },
  "alarm-unknown": { icon: Bell, color: "#C084FC", discipline: "other", defaultPriority: "P3" },
  animal: { icon: PawPrint, color: "#C084FC", discipline: "other", defaultPriority: "P4" },
  lockout: { icon: KeyRound, color: "#C084FC", discipline: "other", defaultPriority: "P4" },
  flooding: { icon: CloudRain, color: "#C084FC", discipline: "other", defaultPriority: "P3" },
  "public-assist": { icon: HandHelping, color: "#C084FC", discipline: "other", defaultPriority: "P4" },
  "civil-standby": { icon: ShieldCheck, color: "#C084FC", discipline: "other", defaultPriority: "P4" },
  transport: { icon: Truck, color: "#C084FC", discipline: "other", defaultPriority: "P4" },
  "found-person": { icon: MapPin, color: "#C084FC", discipline: "other", defaultPriority: "P4" },
  homeless: { icon: Tent, color: "#C084FC", discipline: "other", defaultPriority: "P4" },
};

/** Existing protocol IDs that predate kebab-case icon keys. */
const INCIDENT_ICON_ALIASES: Record<string, keyof typeof INCIDENT_ICON_MAP_CANONICAL> = {
  assault: "assault-fight",
  shots_fired: "shots-fired",
  structure_fire: "structure-fire",
  welfare_check: "welfare-check",
  medical_general: "medical-emergency",
  overdose: "drug-overdose",
  mvc: "vehicle-crash",
};

export const INCIDENT_ICON_MAP: Record<string, IncidentIconEntry> = {
  ...INCIDENT_ICON_MAP_CANONICAL,
};

for (const [alias, canonical] of Object.entries(INCIDENT_ICON_ALIASES)) {
  const entry = INCIDENT_ICON_MAP_CANONICAL[canonical];
  if (entry) INCIDENT_ICON_MAP[alias] = entry;
}

export const INCIDENT_ICON_FALLBACK: IncidentIconEntry = {
  icon: ClipboardList,
  color: "#C084FC",
  discipline: "other",
  defaultPriority: "P4",
};

export function getIncidentIconEntry(key: string): IncidentIconEntry {
  return INCIDENT_ICON_MAP[key] ?? INCIDENT_ICON_FALLBACK;
}

export function filterIncidentTypesForGrid<T extends { id: string; label: string }>(
  types: readonly T[],
  search: string,
  tab: IncidentGridTab,
): T[] {
  const q = search.trim().toLowerCase();
  const searchActive = q.length > 0;

  return types.filter((type) => {
    if (searchActive) {
      const idPlain = type.id.toLowerCase().replace(/[_-]+/g, " ");
      return type.label.toLowerCase().includes(q) || type.id.toLowerCase().includes(q) || idPlain.includes(q);
    }
    if (tab === "all") return true;
    const discipline = INCIDENT_ICON_MAP[type.id]?.discipline ?? "other";
    if (tab === "fire_ems") return discipline === "fire" || discipline === "ems";
    return discipline === tab;
  });
}
