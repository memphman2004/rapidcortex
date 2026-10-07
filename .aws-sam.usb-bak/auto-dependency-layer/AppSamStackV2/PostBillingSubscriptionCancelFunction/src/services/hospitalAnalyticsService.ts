import type {
  HospitalCapacity,
  HospitalDailyMetrics,
  HospitalPerformanceScore,
  UserContext,
} from "rapid-cortex-shared";
import { hospitalDailyMetricsSchema, hospitalPerformanceScoreSchema } from "rapid-cortex-shared";
import { AuthorizationService, type Permission } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { HospitalAnalyticsRepository } from "../repositories/hospitalAnalyticsRepository.js";
import { HospitalCapacityRepository } from "../repositories/hospitalCapacityRepository.js";
import { HospitalProfileRepository } from "../repositories/hospitalProfileRepository.js";

const capacityRepo = new HospitalCapacityRepository();
const analyticsRepo = new HospitalAnalyticsRepository();
const profileRepo = new HospitalProfileRepository();
const authz = new AuthorizationService();

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

function analyzeDiversionPeriods(capacityData: HospitalCapacity[]): HospitalDailyMetrics["diversion"] {
  let totalMinutes = 0;
  let incidents = 0;
  let longestDuration = 0;
  let currentStart: Date | null = null;

  for (const item of capacityData) {
    const timestamp = new Date(item.timestamp);
    if (item.diversion.isOnDiversion) {
      if (!currentStart) {
        currentStart = timestamp;
        incidents++;
      }
    } else if (currentStart) {
      const duration = (timestamp.getTime() - currentStart.getTime()) / 60000;
      totalMinutes += duration;
      longestDuration = Math.max(longestDuration, duration);
      currentStart = null;
    }
  }

  if (currentStart && capacityData.length > 0) {
    const last = new Date(capacityData[capacityData.length - 1]!.timestamp);
    const duration = (last.getTime() - currentStart.getTime()) / 60000;
    totalMinutes += duration;
    longestDuration = Math.max(longestDuration, duration);
  }

  return {
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    incidents,
    longestDurationMinutes: Math.round(longestDuration),
  };
}

function estimateTransports(capacityData: HospitalCapacity[]): number {
  let transports = 0;
  for (let i = 1; i < capacityData.length; i++) {
    const prev = capacityData[i - 1]!;
    const curr = capacityData[i]!;
    const delta = curr.availability.erBeds.occupied - prev.availability.erBeds.occupied;
    if (delta > 0) transports += delta;
  }
  return transports;
}

export class HospitalAnalyticsService {
  async aggregateDailyMetrics(
    user: UserContext,
    hospitalId: string,
    date: string,
  ): Promise<HospitalDailyMetrics | null> {
    assertEnabled();
    assertPermission(user, "hospital_routing.analytics_view");

    const profile = await profileRepo.get(user.agencyId, hospitalId);
    if (!profile) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;
    const snapshots = await capacityRepo.listSnapshotsInRange(
      user.agencyId,
      hospitalId,
      startOfDay,
      endOfDay,
    );

    if (snapshots.length === 0) return null;

    const dataPoints = snapshots.length;
    const avgErBedsAvailable =
      snapshots.reduce((sum, s) => sum + s.availability.erBeds.available, 0) / dataPoints;
    const avgIcuBedsAvailable =
      snapshots.reduce((sum, s) => sum + s.availability.icuBeds.available, 0) / dataPoints;
    const avgOccupancyRate =
      snapshots.reduce((sum, s) => {
        const total = s.availability.erBeds.total || 1;
        return sum + s.availability.erBeds.occupied / total;
      }, 0) / dataPoints;

    const waitTimes = snapshots.map((s) => s.waitTimes.erWaitMinutes);
    const avgWaitMinutes = waitTimes.reduce((a, b) => a + b, 0) / dataPoints;

    const metrics = hospitalDailyMetricsSchema.parse({
      hospitalId,
      agencyId: user.agencyId,
      date,
      capacity: {
        avgErBedsAvailable: Math.round(avgErBedsAvailable * 10) / 10,
        avgIcuBedsAvailable: Math.round(avgIcuBedsAvailable * 10) / 10,
        avgOccupancyRate: Math.round(avgOccupancyRate * 100) / 100,
      },
      wait: {
        avgWaitMinutes: Math.round(avgWaitMinutes),
        maxWaitMinutes: Math.max(...waitTimes),
        minWaitMinutes: Math.min(...waitTimes),
      },
      diversion: analyzeDiversionPeriods(snapshots),
      volume: { estimatedTransports: estimateTransports(snapshots) },
      dataPoints,
    });

    await analyticsRepo.putDailyMetrics(metrics);
    return metrics;
  }

  async getDailyMetrics(
    user: UserContext,
    hospitalId: string,
    days: number,
  ): Promise<HospitalDailyMetrics[]> {
    assertEnabled();
    assertPermission(user, "hospital_routing.analytics_view");

    const endDate = new Date().toISOString().split("T")[0]!;
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0]!;
    return analyticsRepo.listDailyMetrics(user.agencyId, hospitalId, startDate, endDate);
  }

  async calculatePerformanceScore(
    user: UserContext,
    hospitalId: string,
    days: number,
  ): Promise<HospitalPerformanceScore> {
    assertEnabled();
    assertPermission(user, "hospital_routing.analytics_view");

    const profile = await profileRepo.get(user.agencyId, hospitalId);
    if (!profile) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    let metrics = await this.getDailyMetrics(user, hospitalId, days);
    if (metrics.length === 0) {
      const end = new Date();
      for (let i = 0; i < Math.min(days, 7); i++) {
        const d = new Date(end.getTime() - i * 86400000).toISOString().split("T")[0]!;
        await this.aggregateDailyMetrics(user, hospitalId, d);
      }
      metrics = await this.getDailyMetrics(user, hospitalId, days);
    }

    if (metrics.length === 0) {
      const err = new Error("NO_ANALYTICS_DATA");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    const avgDailyCapacity =
      metrics.reduce((sum, m) => sum + m.capacity.avgErBedsAvailable, 0) / metrics.length;
    const avgWaitTime = metrics.reduce((sum, m) => sum + m.wait.avgWaitMinutes, 0) / metrics.length;
    const totalDiversionHours = metrics.reduce((sum, m) => sum + m.diversion.totalHours, 0);
    const diversionRate = (totalDiversionHours / (days * 24)) * 100;
    const uptimePercent = Math.max(0, 100 - diversionRate);

    const availabilityScore = Math.min(100, (avgDailyCapacity / 10) * 100);
    const speedScore = Math.max(0, 100 - avgWaitTime * 2);
    const reliabilityScore = Math.max(0, 100 - diversionRate * 5);
    const overallScore = Math.round(
      availabilityScore * 0.4 + speedScore * 0.3 + reliabilityScore * 0.3,
    );

    const midpoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, midpoint);
    const secondHalf = metrics.slice(midpoint);
    const firstAvg =
      firstHalf.length > 0
        ? firstHalf.reduce((s, m) => s + m.capacity.avgErBedsAvailable, 0) / firstHalf.length
        : 0;
    const secondAvg =
      secondHalf.length > 0
        ? secondHalf.reduce((s, m) => s + m.capacity.avgErBedsAvailable, 0) / secondHalf.length
        : 0;
    const change = secondAvg - firstAvg;

    let trend: HospitalPerformanceScore["trend"];
    if (change > 1) trend = "IMPROVING";
    else if (change < -1) trend = "DECLINING";
    else trend = "STABLE";

    return hospitalPerformanceScoreSchema.parse({
      hospitalId,
      hospitalName: profile.name,
      periodDays: days,
      scores: {
        availability: Math.round(availabilityScore),
        speed: Math.round(speedScore),
        reliability: Math.round(reliabilityScore),
        overall: overallScore,
      },
      metrics: {
        avgDailyCapacity: Math.round(avgDailyCapacity * 10) / 10,
        avgWaitTime: Math.round(avgWaitTime),
        diversionRate: Math.round(diversionRate * 10) / 10,
        uptimePercent: Math.round(uptimePercent * 10) / 10,
      },
      rank: 0,
      trend,
    });
  }

  async getPerformanceLeaderboard(
    user: UserContext,
    days: number,
  ): Promise<HospitalPerformanceScore[]> {
    assertEnabled();
    assertPermission(user, "hospital_routing.analytics_view");

    const hospitals = await profileRepo.listByAgency(user.agencyId, false);
    const scores: HospitalPerformanceScore[] = [];

    for (const hospital of hospitals) {
      try {
        const score = await this.calculatePerformanceScore(user, hospital.hospitalId, days);
        scores.push(score);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg !== "NO_ANALYTICS_DATA" && msg !== "NOT_FOUND") {
          console.error(`analytics score failed for ${hospital.hospitalId}`, e);
        }
      }
    }

    scores.sort((a, b) => b.scores.overall - a.scores.overall);
    scores.forEach((score, index) => {
      score.rank = index + 1;
    });
    return scores;
  }
}
