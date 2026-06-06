import type { Hl7Department, Hl7PatientEvent } from "rapid-cortex-shared";

export type HospitalKey = `${string}#${string}`;

function hospitalKey(agencyId: string, hospitalId: string): HospitalKey {
  return `${agencyId}#${hospitalId}`;
}

export class BedAggregator {
  private readonly occupied = new Map<HospitalKey, Map<Hl7Department, number>>();

  apply(agencyId: string, hospitalId: string, department: Hl7Department, event: Hl7PatientEvent): void {
    const key = hospitalKey(agencyId, hospitalId);
    if (!this.occupied.has(key)) {
      this.occupied.set(key, new Map());
    }
    const deptMap = this.occupied.get(key)!;
    const current = deptMap.get(department) ?? 0;

    if (event === "admit") {
      deptMap.set(department, current + 1);
    } else if (event === "discharge") {
      deptMap.set(department, Math.max(0, current - 1));
    } else if (event === "transfer") {
      deptMap.set(department, current);
    }
  }

  getOccupied(agencyId: string, hospitalId: string, department: Hl7Department): number {
    const key = hospitalKey(agencyId, hospitalId);
    return this.occupied.get(key)?.get(department) ?? 0;
  }
}
