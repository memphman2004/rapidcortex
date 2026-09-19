import type { APCOUnitStatusCode } from "../eido/types.js";
import type { AVLStore } from "./store.js";
import type { UnitLocation } from "./types.js";

export async function getRegionalUnits(
  store: AVLStore,
  agencyIds: string[],
  statuses?: APCOUnitStatusCode[],
): Promise<UnitLocation[]> {
  return store.list(agencyIds, statuses);
}

export async function getUnitHistory(
  _agencyId: string,
  _unitId: string,
  _minutes: number,
): Promise<UnitLocation[]> {
  return [];
}
