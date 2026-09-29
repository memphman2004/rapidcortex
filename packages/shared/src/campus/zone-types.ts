import type { CampusInstitutionType } from "./institution-type.js";

export const HIGHER_ED_ZONE_DEFAULTS = [
  "Dormitory",
  "Library",
  "Student Center",
  "Parking Structure",
  "Athletic Complex",
  "Administrative Building",
  "Classroom Building",
  "Research Lab",
  "Greek Housing",
  "Dining Hall",
  "Recreation Center",
] as const;

export const K12_ZONE_DEFAULTS = [
  "Main Office / Front Entrance",
  "Classroom Wing",
  "Cafeteria",
  "Gymnasium",
  "Auditorium",
  "Restrooms",
  "Parking Lot",
  "Athletic Field",
  "Portable Classrooms",
  "Bus Loading Zone",
  "Media Center / Library",
  "Visitor Entrance",
] as const;

export function getZoneDefaults(t: CampusInstitutionType): readonly string[] {
  return t === "k12" ? K12_ZONE_DEFAULTS : HIGHER_ED_ZONE_DEFAULTS;
}
