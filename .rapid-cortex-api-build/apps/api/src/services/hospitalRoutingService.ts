import type {
  HospitalCapacity,
  HospitalPatientNeeds,
  HospitalProfile,
  HospitalRecommendation,
  HospitalRecommendationLevel,
  UpdateHospitalCapacityBody,
  UserContext,
} from "rapid-cortex-shared";
import {
  calculateDistanceMeters,
  hospitalCapacitySchema,
  updateHospitalCapacityBodySchema,
} from "rapid-cortex-shared";
import { AuthorizationService, AUDIT_EVENT_TYPES, type Permission } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { HospitalCapacityRepository } from "../repositories/hospitalCapacityRepository.js";
import { HospitalProfileRepository } from "../repositories/hospitalProfileRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";

const capacityRepo = new HospitalCapacityRepository();
const profileRepo = new HospitalProfileRepository();
const auditRepo = new AuditRepository();
const authz = new AuthorizationService();

const METERS_PER_MILE = 1609.344;

function assertEnabled(): void {
  if (!env.enableHospitalRouting || !env.hospitalCapacityTable || !env.hospitalProfilesTable) {
    const err = new Error("HOSPITAL_ROUTING_DISABLED");
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
}

function assertPermission(user: UserContext, permission: Permission): void {
  if (!authz.canPerform(user, permission)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function milesBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  return calculateDistanceMeters(lat1, lon1, lat2, lon2) / METERS_PER_MILE;
}

function hasTrauma(profile: HospitalProfile): boolean {
  return Boolean(profile.traumaLevel && profile.traumaLevel !== "NONE");
}

function buildMockCapacity(agencyId: string, hospitalId: string, seed: number): HospitalCapacity {
  const now = new Date().toISOString();
  const erAvailable = Math.max(0, (seed % 5) + 1);
  const icuAvailable = Math.max(0, seed % 3);
  return {
    hospitalId,
    agencyId,
    timestamp: now,
    availability: {
      erBeds: { total: 20, occupied: 20 - erAvailable, available: erAvailable },
      icuBeds: { total: 10, occupied: 10 - icuAvailable, available: icuAvailable },
      traumaBeds: { total: 4, occupied: seed % 4, available: Math.max(0, 4 - (seed % 4)) },
    },
    waitTimes: {
      erWaitMinutes: 10 + (seed % 4) * 15,
      traumaBayMinutes: seed % 2 === 0 ? 5 : 20,
    },
    diversion: {
      isOnDiversion: seed % 7 === 0,
      diversionType: seed % 7 === 0 ? "FULL" : undefined,
      diversionReason: seed % 7 === 0 ? "ER at capacity" : undefined,
    },
    staffing: {
      adequateStaffing: seed % 5 !== 0,
      erPhysicians: 2 + (seed % 3),
      erNurses: 4 + (seed % 4),
    },
    dataQuality: {
      source: env.hospitalRoutingMock ? "MOCK" : "ESTIMATED",
      lastVerified: now,
      confidence: "MEDIUM",
    },
  };
}

export class HospitalRoutingService {
  /** Seed demo hospital profiles when routing is enabled but Emergency Connect has not run yet. */
  async ensureDemoProfiles(user: UserContext): Promise<HospitalProfile[]> {
    const existing = await profileRepo.listByAgency(user.agencyId, false);
    if (existing.length > 0 || !env.hospitalRoutingSeedDemo) return existing;

    const now = new Date().toISOString();
    const seeds: Omit<HospitalProfile, "hospitalId" | "agencyId" | "createdAt" | "updatedAt">[] = [
      {
        name: "Sarasota Memorial Hospital",
        address: "1701 S Tamiami Trl, Sarasota, FL",
        coordinates: { latitude: 27.3364, longitude: -82.5306 },
        phone: "+1-941-917-9000",
        traumaLevel: "LEVEL_2",
        strokeCenter: true,
        cardiacCenter: true,
        pediatricCapable: true,
        burnCenter: false,
        behavioralHealthCapable: true,
        preferredNotificationMethod: "SECURE_DASHBOARD",
        active: true,
      },
      {
        name: "HCA Florida St. Petersburg Hospital",
        address: "6500 38th Ave N, St. Petersburg, FL",
        coordinates: { latitude: 27.79, longitude: -82.68 },
        phone: "+1-727-384-1414",
        traumaLevel: "LEVEL_3",
        strokeCenter: true,
        cardiacCenter: true,
        pediatricCapable: false,
        burnCenter: false,
        behavioralHealthCapable: false,
        preferredNotificationMethod: "MANUAL_CALL_LOG",
        active: true,
      },
      {
        name: "Manatee Memorial Hospital",
        address: "206 2nd St E, Bradenton, FL",
        coordinates: { latitude: 27.4989, longitude: -82.5748 },
        phone: "+1-941-746-5111",
        traumaLevel: "NONE",
        strokeCenter: false,
        cardiacCenter: true,
        pediatricCapable: true,
        burnCenter: false,
        behavioralHealthCapable: true,
        preferredNotificationMethod: "EMAIL_SECURE",
        active: true,
      },
    ];

    for (const seed of seeds) {
      const profile: HospitalProfile = {
        ...seed,
        hospitalId: makeId("hosp"),
        agencyId: user.agencyId,
        createdAt: now,
        updatedAt: now,
      };
      await profileRepo.put(profile);
    }
    return profileRepo.listByAgency(user.agencyId);
  }

  async ensureDemoCapacity(user: UserContext, hospitals: HospitalProfile[]): Promise<void> {
    if (!env.hospitalRoutingSeedDemo || hospitals.length === 0) return;
    let seed = 1;
    for (const hospital of hospitals) {
      const existing = await capacityRepo.getLatest(user.agencyId, hospital.hospitalId);
      if (existing) continue;
      await capacityRepo.put(buildMockCapacity(user.agencyId, hospital.hospitalId, seed++));
    }
  }

  async listCapacity(user: UserContext): Promise<HospitalCapacity[]> {
    assertEnabled();
    assertPermission(user, "hospital_routing.view");
    const hospitals = await this.ensureDemoProfiles(user);
    await this.ensureDemoCapacity(user, hospitals);
    return capacityRepo.listLatestByAgency(
      user.agencyId,
      hospitals.map((h) => h.hospitalId),
    );
  }

  async getCapacity(user: UserContext, hospitalId: string): Promise<HospitalCapacity> {
    assertEnabled();
    assertPermission(user, "hospital_routing.view");
    const profile = await profileRepo.get(user.agencyId, hospitalId);
    if (!profile) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    await this.ensureDemoCapacity(user, [profile]);
    const capacity = await capacityRepo.getLatest(user.agencyId, hospitalId);
    if (!capacity) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    return capacity;
  }

  async updateCapacity(
    user: UserContext,
    hospitalId: string,
    body: UpdateHospitalCapacityBody,
  ): Promise<HospitalCapacity> {
    assertEnabled();
    assertPermission(user, "hospital_routing.manage");
    const parsed = updateHospitalCapacityBodySchema.parse(body);
    const profile = await profileRepo.get(user.agencyId, hospitalId);
    if (!profile) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    const now = new Date().toISOString();
    const capacity: HospitalCapacity = hospitalCapacitySchema.parse({
      hospitalId,
      agencyId: user.agencyId,
      timestamp: now,
      availability: parsed.availability,
      waitTimes: parsed.waitTimes,
      diversion: parsed.diversion,
      staffing: parsed.staffing,
      dataQuality: {
        source: env.hospitalRoutingMock ? "MOCK" : "MANUAL_UPDATE",
        lastVerified: now,
        confidence: "HIGH",
        ...parsed.dataQuality,
      },
    });

    await capacityRepo.put(capacity);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.HOSPITAL_CAPACITY_UPDATED,
      details: { hospitalId, erAvailable: capacity.availability.erBeds.available },
      createdAt: now,
      resourceType: "hospital_capacity",
      resourceId: hospitalId,
    });
    return capacity;
  }

  async getRecommendations(
    user: UserContext,
    latitude: number,
    longitude: number,
    patientNeeds?: HospitalPatientNeeds,
  ): Promise<HospitalRecommendation[]> {
    assertEnabled();
    assertPermission(user, "hospital_routing.view");
    const hospitals = await this.ensureDemoProfiles(user);
    await this.ensureDemoCapacity(user, hospitals);

    const recommendations: HospitalRecommendation[] = [];

    for (const hospital of hospitals) {
      const capacity = await capacityRepo.getLatest(user.agencyId, hospital.hospitalId);
      if (!capacity) continue;

      const distanceMiles = milesBetween(
        latitude,
        longitude,
        hospital.coordinates.latitude,
        hospital.coordinates.longitude,
      );
      const durationMinutes = Math.max(1, Math.round(distanceMiles * 2));
      const durationLightsMinutes = Math.max(1, Math.round(distanceMiles * 1.5));
      const scoring = this.scoreHospital(hospital, capacity, distanceMiles, patientNeeds);
      const match = this.assessMatch(hospital, capacity, patientNeeds);

      recommendations.push({
        hospitalId: hospital.hospitalId,
        hospital,
        capacity,
        routing: { distanceMiles, durationMinutes, durationLightsMinutes },
        scoring,
        match,
        recommendation: this.recommendationLevel(scoring.overallScore, match),
      });
    }

    recommendations.sort((a, b) => b.scoring.overallScore - a.scoring.overallScore);
    return recommendations;
  }

  private scoreHospital(
    hospital: HospitalProfile,
    capacity: HospitalCapacity,
    distanceMiles: number,
    patientNeeds?: HospitalPatientNeeds,
  ): HospitalRecommendation["scoring"] {
    const distanceScore =
      distanceMiles < 5 ? 100 : distanceMiles < 10 ? 80 : distanceMiles < 15 ? 60 : 40;

    const totalAvailable =
      capacity.availability.erBeds.available + capacity.availability.icuBeds.available;
    const capacityScore =
      totalAvailable >= 5 ? 100 : totalAvailable >= 3 ? 80 : totalAvailable >= 1 ? 60 : 20;

    let specialtyScore = 100;
    if (patientNeeds) {
      let required = 0;
      let matches = 0;
      if (patientNeeds.trauma) {
        required++;
        if (hasTrauma(hospital)) matches++;
      }
      if (patientNeeds.stroke) {
        required++;
        if (hospital.strokeCenter) matches++;
      }
      if (patientNeeds.stemi) {
        required++;
        if (hospital.cardiacCenter) matches++;
      }
      if (patientNeeds.burn) {
        required++;
        if (hospital.burnCenter) matches++;
      }
      if (patientNeeds.pediatric) {
        required++;
        if (hospital.pediatricCapable) matches++;
      }
      if (patientNeeds.psychiatric) {
        required++;
        if (hospital.behavioralHealthCapable) matches++;
      }
      specialtyScore = required > 0 ? Math.round((matches / required) * 100) : 100;
    }

    const waitScore =
      capacity.waitTimes.erWaitMinutes < 15
        ? 100
        : capacity.waitTimes.erWaitMinutes < 30
          ? 80
          : capacity.waitTimes.erWaitMinutes < 60
            ? 60
            : 40;

    const historicalScore = 80;
    const diversionPenalty = capacity.diversion.isOnDiversion ? 0.5 : 1;

    const overallScore = Math.round(
      (distanceScore * 0.3 +
        capacityScore * 0.25 +
        specialtyScore * 0.25 +
        waitScore * 0.1 +
        historicalScore * 0.1) *
        diversionPenalty,
    );

    return {
      overallScore,
      factors: {
        distance: distanceScore,
        capacity: capacityScore,
        specialtyMatch: specialtyScore,
        waitTime: waitScore,
        historical: historicalScore,
      },
    };
  }

  private assessMatch(
    hospital: HospitalProfile,
    capacity: HospitalCapacity,
    patientNeeds?: HospitalPatientNeeds,
  ): HospitalRecommendation["match"] {
    const missingCapabilities: string[] = [];
    const warnings: string[] = [];

    if (patientNeeds?.trauma && !hasTrauma(hospital)) missingCapabilities.push("Trauma center");
    if (patientNeeds?.stroke && !hospital.strokeCenter) missingCapabilities.push("Stroke center");
    if (patientNeeds?.stemi && !hospital.cardiacCenter) missingCapabilities.push("STEMI center");
    if (patientNeeds?.burn && !hospital.burnCenter) missingCapabilities.push("Burn center");
    if (patientNeeds?.pediatric && !hospital.pediatricCapable) {
      missingCapabilities.push("Pediatric capable");
    }
    if (patientNeeds?.psychiatric && !hospital.behavioralHealthCapable) {
      missingCapabilities.push("Psychiatric capable");
    }

    if (capacity.availability.erBeds.available === 0) {
      warnings.push("No ER beds available");
    } else if (capacity.availability.erBeds.available <= 2) {
      warnings.push("Limited ER capacity");
    }
    if (capacity.diversion.isOnDiversion) {
      warnings.push(
        capacity.diversion.diversionType
          ? `On ${capacity.diversion.diversionType} diversion`
          : "On diversion",
      );
    }
    if (!capacity.staffing.adequateStaffing) warnings.push("Limited staffing");

    return {
      meetsRequirements: missingCapabilities.length === 0,
      missingCapabilities,
      warnings,
    };
  }

  private recommendationLevel(
    score: number,
    match: HospitalRecommendation["match"],
  ): HospitalRecommendationLevel {
    if (!match.meetsRequirements) return "NOT_RECOMMENDED";
    if (score >= 80) return "OPTIMAL";
    if (score >= 60) return "ACCEPTABLE";
    return "SUBOPTIMAL";
  }
}
