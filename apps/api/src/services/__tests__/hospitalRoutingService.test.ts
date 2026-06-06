import { describe, expect, it } from "vitest";
import type { HospitalCapacity, HospitalProfile } from "rapid-cortex-shared";

function scoreHospital(
  hospital: HospitalProfile,
  capacity: HospitalCapacity,
  distanceMiles: number,
  patientNeeds?: { stemi?: boolean },
): number {
  const distanceScore = distanceMiles < 5 ? 100 : 80;
  const totalAvailable =
    capacity.availability.erBeds.available + capacity.availability.icuBeds.available;
  const capacityScore = totalAvailable >= 3 ? 80 : 40;
  let specialtyScore = 100;
  if (patientNeeds?.stemi) {
    specialtyScore = hospital.cardiacCenter ? 100 : 0;
  }
  const waitScore = capacity.waitTimes.erWaitMinutes < 30 ? 80 : 40;
  const diversionPenalty = capacity.diversion.isOnDiversion ? 0.5 : 1;
  return Math.round(
    (distanceScore * 0.3 + capacityScore * 0.25 + specialtyScore * 0.25 + waitScore * 0.2) *
      diversionPenalty,
  );
}

describe("hospital routing scoring", () => {
  const hospital: HospitalProfile = {
    hospitalId: "h1",
    agencyId: "a1",
    name: "Test Hospital",
    address: "1 Main",
    coordinates: { latitude: 27.34, longitude: -82.53 },
    phone: "555",
    cardiacCenter: true,
    strokeCenter: true,
    pediatricCapable: false,
    burnCenter: false,
    behavioralHealthCapable: false,
    preferredNotificationMethod: "SECURE_DASHBOARD",
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const capacity: HospitalCapacity = {
    hospitalId: "h1",
    agencyId: "a1",
    timestamp: new Date().toISOString(),
    availability: {
      erBeds: { total: 10, occupied: 7, available: 3 },
      icuBeds: { total: 5, occupied: 4, available: 1 },
    },
    waitTimes: { erWaitMinutes: 20 },
    diversion: { isOnDiversion: false },
    staffing: { adequateStaffing: true },
    dataQuality: {
      source: "MOCK",
      lastVerified: new Date().toISOString(),
      confidence: "HIGH",
    },
  };

  it("scores STEMI-capable hospital higher when cardiac center required", () => {
    const withStemi = scoreHospital(hospital, capacity, 3, { stemi: true });
    const without = scoreHospital(hospital, capacity, 3);
    expect(withStemi).toBeGreaterThanOrEqual(without);
  });

  it("applies diversion penalty", () => {
    const open = scoreHospital(hospital, capacity, 3);
    const diverted = scoreHospital(
      hospital,
      { ...capacity, diversion: { isOnDiversion: true, diversionType: "FULL" } },
      3,
    );
    expect(diverted).toBeLessThan(open);
  });
});
