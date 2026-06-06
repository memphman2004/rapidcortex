import { describe, expect, it, vi, beforeEach } from "vitest";
import type { HospitalRecommendation, MciIncident, UserContext } from "rapid-cortex-shared";

const { getRecommendationsMock } = vi.hoisted(() => ({
  getRecommendationsMock: vi.fn(),
}));

vi.mock("../lib/env.js", () => ({
  env: {
    enableHospitalRouting: true,
    hospitalCapacityTable: "test-capacity",
    hospitalProfilesTable: "test-profiles",
    hospitalRoutingMock: true,
    hospitalRoutingSeedDemo: false,
  },
}));

vi.mock("./hospitalRoutingService.js", () => ({
  HospitalRoutingService: vi.fn(function HospitalRoutingServiceMock() {
    return { getRecommendations: getRecommendationsMock };
  }),
}));

vi.mock("../repositories/hospitalMciRepository.js", () => ({
  HospitalMciRepository: vi.fn().mockImplementation(() => ({
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
  })),
}));

vi.mock("../repositories/auditRepository.js", () => ({
  AuditRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { MciCoordinationService } from "./mciCoordinationService.js";

const user: UserContext = {
  userId: "user-1",
  agencyId: "agency-1",
  role: "agencyadmin",
  email: "admin@test.com",
};

function mockRecommendation(
  hospitalId: string,
  name: string,
  erAvailable: number,
  lat: number,
  lon: number,
): HospitalRecommendation {
  return {
    hospitalId,
    hospital: {
      hospitalId,
      agencyId: "agency-1",
      name,
      address: "123 Main",
      coordinates: { latitude: lat, longitude: lon },
      phone: "+1",
      traumaLevel: hospitalId === "trauma-1" ? "LEVEL_1" : "NONE",
      strokeCenter: false,
      cardiacCenter: false,
      pediatricCapable: true,
      burnCenter: false,
      behavioralHealthCapable: true,
      preferredNotificationMethod: "SECURE_DASHBOARD",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    capacity: {
      hospitalId,
      agencyId: "agency-1",
      timestamp: new Date().toISOString(),
      availability: {
        erBeds: { total: 20, occupied: 20 - erAvailable, available: erAvailable },
        icuBeds: { total: 10, occupied: 8, available: 2 },
      },
      waitTimes: { erWaitMinutes: 20 },
      diversion: { isOnDiversion: false },
      staffing: { adequateStaffing: true },
      dataQuality: {
        source: "MOCK",
        lastVerified: new Date().toISOString(),
        confidence: "HIGH",
      },
    },
    routing: { distanceMiles: 5, durationMinutes: 10, durationLightsMinutes: 8 },
    scoring: {
      overallScore: 80,
      factors: {
        distance: 80,
        capacity: 80,
        specialtyMatch: 80,
        waitTime: 80,
        historical: 80,
      },
    },
    match: { meetsRequirements: true, missingCapabilities: [], warnings: [] },
    recommendation: "OPTIMAL",
  };
}

describe("MciCoordinationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("distributes patients across hospitals by load balancing", async () => {
    getRecommendationsMock.mockResolvedValue([
      mockRecommendation("h1", "Hospital A", 3, 27.34, -82.53),
      mockRecommendation("h2", "Hospital B", 3, 27.5, -82.4),
      mockRecommendation("h3", "Hospital C", 3, 27.6, -82.3),
    ]);

    const incident: MciIncident = {
      incidentId: "mci-1",
      latitude: 27.34,
      longitude: -82.53,
      patients: Array.from({ length: 6 }, (_, i) => ({
        patientId: `p-${i}`,
        latitude: 27.34,
        longitude: -82.53,
        priority: "DELAYED" as const,
      })),
    };

    const service = new MciCoordinationService();
    const plan = await service.createDistributionPlan(user, incident);

    expect(plan.totalPatients).toBe(6);
    expect(plan.summary.hospitalsUsed).toBeGreaterThanOrEqual(2);
    expect(plan.unallocatedPatientIds).toHaveLength(0);
    const loads = plan.allocations.map((a) => a.assignedPatientIds.length);
    expect(Math.max(...loads) - Math.min(...loads.filter((n) => n > 0))).toBeLessThanOrEqual(2);
  });

  it("prioritizes immediate patients for trauma centers", async () => {
    getRecommendationsMock.mockResolvedValue([
      mockRecommendation("trauma-1", "Trauma Center", 2, 27.34, -82.53),
      mockRecommendation("general-1", "General Hospital", 10, 27.35, -82.52),
    ]);

    const incident: MciIncident = {
      incidentId: "mci-2",
      latitude: 27.34,
      longitude: -82.53,
      patients: [
        {
          patientId: "critical-1",
          latitude: 27.34,
          longitude: -82.53,
          priority: "IMMEDIATE",
          needs: { trauma: true },
        },
      ],
    };

    const service = new MciCoordinationService();
    const plan = await service.createDistributionPlan(user, incident);

    const traumaAllocation = plan.allocations.find((a) => a.hospitalId === "trauma-1");
    expect(traumaAllocation?.assignedPatientIds).toContain("critical-1");
  });
});
