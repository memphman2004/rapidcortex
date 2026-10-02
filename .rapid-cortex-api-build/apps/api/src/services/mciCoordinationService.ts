import type {
  HospitalPatientNeeds,
  HospitalProfile,
  HospitalRecommendation,
  MciDistributionPlan,
  MciHospitalAllocation,
  MciIncident,
  MciPatient,
  MciTriagePriority,
  UserContext,
} from "rapid-cortex-shared";
import { calculateDistanceMeters, mciDistributionPlanSchema } from "rapid-cortex-shared";
import { AuthorizationService, AUDIT_EVENT_TYPES, type Permission } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { HospitalMciRepository } from "../repositories/hospitalMciRepository.js";
import { HospitalRoutingService } from "./hospitalRoutingService.js";

const METERS_PER_MILE = 1609.344;
const routingService = new HospitalRoutingService();
const mciRepo = new HospitalMciRepository();
const auditRepo = new AuditRepository();
const authz = new AuthorizationService();

const PRIORITY_ORDER: Record<MciTriagePriority, number> = {
  IMMEDIATE: 0,
  DELAYED: 1,
  MINIMAL: 2,
  EXPECTANT: 3,
};

interface AllocationState {
  hospitalId: string;
  hospitalName: string;
  hospital: HospitalProfile;
  recommendation: HospitalRecommendation;
  assignedPatients: MciPatient[];
  currentLoad: number;
  availableCapacity: number;
}

function assertEnabled(): void {
  if (!env.enableHospitalRouting || !env.hospitalCapacityTable) {
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

function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return calculateDistanceMeters(lat1, lon1, lat2, lon2) / METERS_PER_MILE;
}

function hasTrauma(profile: HospitalProfile): boolean {
  return Boolean(profile.traumaLevel && profile.traumaLevel !== "NONE");
}

function toPatientNeeds(needs?: MciPatient["needs"]): HospitalPatientNeeds | undefined {
  if (!needs) return undefined;
  return {
    trauma: needs.trauma,
    burn: needs.burn,
    pediatric: needs.pediatric,
    psychiatric: needs.psychiatric,
    stroke: needs.stroke,
    stemi: needs.stemi,
  };
}

export class MciCoordinationService {
  async createDistributionPlan(user: UserContext, incident: MciIncident): Promise<MciDistributionPlan> {
    assertEnabled();
    assertPermission(user, "hospital_routing.manage");
    const startTime = Date.now();
    const now = new Date().toISOString();

    const recommendations = await routingService.getRecommendations(
      user,
      incident.latitude,
      incident.longitude,
    );

    const available = recommendations.filter(
      (rec) =>
        !rec.capacity.diversion.isOnDiversion || rec.capacity.diversion.diversionType !== "FULL",
    );

    const warnings: string[] = [];
    if (available.length === 0) {
      const plan = this.buildPlan({
        user,
        incident,
        allocations: [],
        unallocated: incident.patients,
        warnings: ["No hospitals available — all on full diversion"],
        startTime,
        now,
        status: "DRAFT",
      });
      await mciRepo.put(plan);
      await this.auditCreated(user, plan);
      return plan;
    }

    const allocations: AllocationState[] = available.map((rec) => ({
      hospitalId: rec.hospitalId,
      hospitalName: rec.hospital.name,
      hospital: rec.hospital,
      recommendation: rec,
      assignedPatients: [],
      currentLoad: 0,
      availableCapacity: rec.capacity.availability.erBeds.available,
    }));

    const sortedPatients = [...incident.patients].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
    const unallocated: MciPatient[] = [];

    for (const patient of sortedPatients) {
      const target = this.findBestHospital(patient, allocations, incident);
      if (target) {
        target.assignedPatients.push(patient);
        target.currentLoad++;
        target.availableCapacity--;
      } else {
        unallocated.push(patient);
        warnings.push(
          `Could not allocate patient ${patient.patientId} (${patient.priority}) — no suitable hospital with capacity`,
        );
      }
    }

    for (const allocation of allocations) {
      if (allocation.availableCapacity < 0) {
        warnings.push(
          `${allocation.hospitalName} assigned ${allocation.assignedPatients.length} patients but only had ${allocation.recommendation.capacity.availability.erBeds.available} ER beds available`,
        );
      }
    }

    const plan = this.buildPlan({
      user,
      incident,
      allocations,
      unallocated,
      warnings,
      startTime,
      now,
      status: "DRAFT",
    });
    await mciRepo.put(plan);
    await this.auditCreated(user, plan);
    return plan;
  }

  async getPlan(user: UserContext, incidentId: string): Promise<MciDistributionPlan | null> {
    assertEnabled();
    assertPermission(user, "hospital_routing.view");
    return mciRepo.get(user.agencyId, incidentId);
  }

  async activatePlan(user: UserContext, incidentId: string): Promise<MciDistributionPlan> {
    assertEnabled();
    assertPermission(user, "hospital_routing.manage");
    const existing = await mciRepo.get(user.agencyId, incidentId);
    if (!existing) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const now = new Date().toISOString();
    const activated = mciDistributionPlanSchema.parse({
      ...existing,
      status: "ACTIVE",
      updatedAt: now,
    });
    await mciRepo.put(activated);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.HOSPITAL_MCI_PLAN_ACTIVATED,
      details: {
        incidentId,
        planId: activated.planId,
        totalPatients: activated.totalPatients,
        hospitalsUsed: activated.summary.hospitalsUsed,
      },
      createdAt: now,
      resourceType: "mci_plan",
      resourceId: activated.planId,
    });
    return activated;
  }

  async getMciStatus(user: UserContext, incidentId: string) {
    assertEnabled();
    assertPermission(user, "hospital_routing.view");
    const plan = await mciRepo.get(user.agencyId, incidentId);
    if (!plan) {
      return {
        totalPatients: 0,
        transported: 0,
        inProgress: 0,
        pending: 0,
        hospitalBreakdown: [] as Array<{
          hospitalId: string;
          hospitalName: string;
          assigned: number;
          delivered: number;
          enroute: number;
        }>,
      };
    }

    return {
      totalPatients: plan.totalPatients,
      transported: 0,
      inProgress: 0,
      pending: plan.totalPatients,
      hospitalBreakdown: plan.allocations.map((a) => ({
        hospitalId: a.hospitalId,
        hospitalName: a.hospitalName,
        assigned: a.assignedPatientIds.length,
        delivered: 0,
        enroute: 0,
      })),
    };
  }

  private findBestHospital(
    patient: MciPatient,
    allocations: AllocationState[],
    incident: MciIncident,
  ): AllocationState | null {
    const needs = toPatientNeeds(patient.needs);
    let candidates = allocations.filter((a) => this.meetsNeeds(patient, a, needs));

    if (candidates.length === 0) {
      candidates = allocations.filter((a) => a.availableCapacity > 0);
    }
    if (candidates.length === 0) return null;

    const scored = candidates
      .map((allocation) => ({
        allocation,
        score: this.scoreCandidate(patient, allocation, incident),
      }))
      .sort((a, b) => b.score - a.score);

    return scored[0]?.allocation ?? null;
  }

  private meetsNeeds(
    patient: MciPatient,
    allocation: AllocationState,
    needs?: HospitalPatientNeeds,
  ): boolean {
    if (allocation.availableCapacity <= 0) return false;
    const hospital = allocation.hospital;

    if (needs?.trauma && !hasTrauma(hospital)) {
      if (patient.priority === "IMMEDIATE") return false;
    }
    if (needs?.burn && !hospital.burnCenter) {
      if (patient.priority === "IMMEDIATE") return false;
    }
    if (needs?.pediatric && !hospital.pediatricCapable) return false;

    return true;
  }

  private scoreCandidate(
    patient: MciPatient,
    allocation: AllocationState,
    incident: MciIncident,
  ): number {
    let score = 100;
    const hospital = allocation.hospital;
    const needs = patient.needs;

    score -= allocation.currentLoad * 10;

    const distanceMiles = milesBetween(
      patient.latitude,
      patient.longitude,
      hospital.coordinates.latitude,
      hospital.coordinates.longitude,
    );
    score -= distanceMiles * 2;

    if (needs?.trauma && hasTrauma(hospital)) score += 20;
    if (needs?.burn && hospital.burnCenter) score += 20;
    if (needs?.pediatric && hospital.pediatricCapable) score += 15;
    if (allocation.availableCapacity > 3) score += 10;

    if (patient.priority === "IMMEDIATE" && hasTrauma(hospital)) score += 30;
    if (patient.priority === "MINIMAL") score += distanceMiles;

    const incidentDistance = milesBetween(
      incident.latitude,
      incident.longitude,
      hospital.coordinates.latitude,
      hospital.coordinates.longitude,
    );
    score -= incidentDistance * 0.5;

    return score;
  }

  private buildPlan(input: {
    user: UserContext;
    incident: MciIncident;
    allocations: AllocationState[];
    unallocated: MciPatient[];
    warnings: string[];
    startTime: number;
    now: string;
    status: "DRAFT" | "ACTIVE";
  }): MciDistributionPlan {
    const planAllocations: MciHospitalAllocation[] = input.allocations
      .map((a) => {
        const immediate = a.assignedPatients.filter((p) => p.priority === "IMMEDIATE").length;
        const delayed = a.assignedPatients.filter((p) => p.priority === "DELAYED").length;
        const minimal = a.assignedPatients.filter((p) => p.priority === "MINIMAL").length;
        const expectant = a.assignedPatients.filter((p) => p.priority === "EXPECTANT").length;

        const parts = [
          a.assignedPatients.length > 0 ? `${a.assignedPatients.length} patients assigned` : null,
          immediate > 0 ? `${immediate} immediate` : null,
          delayed > 0 ? `${delayed} delayed` : null,
          minimal > 0 ? `${minimal} minimal` : null,
          expectant > 0 ? `${expectant} expectant` : null,
        ].filter(Boolean);

        return {
          hospitalId: a.hospitalId,
          hospitalName: a.hospitalName,
          latitude: a.hospital.coordinates.latitude,
          longitude: a.hospital.coordinates.longitude,
          traumaLevel: a.hospital.traumaLevel,
          assignedPatientIds: a.assignedPatients.map((p) => p.patientId),
          currentLoad: a.currentLoad,
          availableCapacity: a.availableCapacity,
          reasoning:
            a.assignedPatients.length === 0 ? "No patients assigned" : parts.join(" • "),
        };
      })
      .sort((a, b) => b.assignedPatientIds.length - a.assignedPatientIds.length);

    const hospitalsUsed = planAllocations.filter((a) => a.assignedPatientIds.length > 0).length;
    const maxHospitalLoad = Math.max(
      ...planAllocations.map((a) => a.assignedPatientIds.length),
      0,
    );

    return mciDistributionPlanSchema.parse({
      planId: makeId("mci"),
      agencyId: input.user.agencyId,
      incidentId: input.incident.incidentId,
      status: input.status,
      totalPatients: input.incident.patients.length,
      allocations: planAllocations,
      unallocatedPatientIds: input.unallocated.map((p) => p.patientId),
      patients: input.incident.patients,
      summary: {
        hospitalsUsed,
        avgPatientsPerHospital:
          hospitalsUsed > 0
            ? Math.round((input.incident.patients.length / hospitalsUsed) * 10) / 10
            : 0,
        maxHospitalLoad,
        allocationTimeMs: Date.now() - input.startTime,
      },
      warnings: input.warnings,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  private async auditCreated(user: UserContext, plan: MciDistributionPlan): Promise<void> {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.HOSPITAL_MCI_PLAN_CREATED,
      details: {
        incidentId: plan.incidentId,
        planId: plan.planId,
        totalPatients: plan.totalPatients,
        hospitalsUsed: plan.summary.hospitalsUsed,
        unallocated: plan.unallocatedPatientIds.length,
      },
      createdAt: plan.createdAt,
      resourceType: "mci_plan",
      resourceId: plan.planId,
    });
  }
}
