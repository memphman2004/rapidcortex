import type { DemoUnit } from "../types";

/** Fictional units. Status always starts available unless a scenario says otherwise. */
export const MAPLEWOOD_UNITS: readonly DemoUnit[] = [
  { id: "MC-14", type: "Law enforcement patrol", agency: "Maplewood County Sheriff", assignment: "General patrol", discipline: "law", status: "available" },
  { id: "MC-07", type: "Law enforcement patrol", agency: "Maplewood County Sheriff", assignment: "General patrol", discipline: "law", status: "available" },
  { id: "RPD-3", type: "Law enforcement patrol", agency: "Ridgemont Police", assignment: "City sector", discipline: "law", status: "available" },
  { id: "RPD-9", type: "Law enforcement patrol", agency: "Ridgemont Police", assignment: "City sector", discipline: "law", status: "available" },
  { id: "ENG-4", type: "Fire engine", agency: "Maplewood County Fire", assignment: "Station 4", discipline: "fire", status: "available" },
  { id: "ENG-7", type: "Fire engine", agency: "Ridgemont Fire", assignment: "Station 7", discipline: "fire", status: "available" },
  { id: "MED-2", type: "ALS ambulance", agency: "Maplewood EMS", assignment: "Primary ALS", discipline: "ems", status: "available" },
  { id: "MED-6", type: "ALS ambulance", agency: "Maplewood EMS", assignment: "Secondary ALS", discipline: "ems", status: "available" },
  { id: "MED-11", type: "BLS ambulance", agency: "Maplewood EMS", assignment: "BLS coverage", discipline: "ems", status: "available" },
  { id: "AIR-1", type: "Medical helicopter", agency: "Regional Medical Center", assignment: "Air medical", discipline: "ems", status: "available" },
];

export function availableUnits(): DemoUnit[] {
  return MAPLEWOOD_UNITS.map((unit) => ({ ...unit, status: "available", incidentId: undefined }));
}
