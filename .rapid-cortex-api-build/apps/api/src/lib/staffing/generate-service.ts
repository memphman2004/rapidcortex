import type { WeeklyStaffingForecast } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { makeId } from "../ids.js";
import { env } from "../env.js";
import { aggregateCallVolumeHistory } from "./aggregator.js";
import { forecastStaffingWithBedrock } from "./forecaster.js";
import { saveStaffingForecast } from "./forecast-store.js";

const agencyRepo = new AgencyRepository();
const auditRepo = new AuditRepository();

export async function generateStaffingForecastForAgency(
  agencyId: string,
  actorId: string,
  actorRole: string,
): Promise<WeeklyStaffingForecast | null> {
  if (!env.enablePredictiveStaffing) return null;

  const tenant = await agencyRepo.get(agencyId);
  if (!tenant?.config.staffing?.enabled) return null;

  const lookbackDays = 90;
  const forecastDays = tenant.config.staffing.forecastDays ?? 7;
  const shiftLengthHours = tenant.config.staffing.shiftLengthHours ?? 8;
  const scheduledEvents = tenant.config.staffing.scheduledEvents ?? [];

  const aggregated = await aggregateCallVolumeHistory(agencyId, lookbackDays);
  const forecast = await forecastStaffingWithBedrock({
    agencyId,
    agencyName: tenant.name,
    buckets: aggregated.buckets,
    forecastDays,
    shiftLengthHours,
    scheduledEvents,
    dataQualityNote: aggregated.dataQualityNote,
  });

  if (aggregated.dataQualityNote && !forecast.weekSummary.dataQualityNote) {
    forecast.weekSummary.dataQualityNote = aggregated.dataQualityNote;
  }

  await saveStaffingForecast(forecast);

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.STAFFING_FORECAST_GENERATED,
    details: {
      actorRole,
      forecastStartDate: forecast.forecastStartDate,
      criticalShiftCount: forecast.weekSummary.criticalShiftCount,
      modelUsed: forecast.modelUsed,
      incidentSampleCount: aggregated.incidentCount,
    },
    createdAt: new Date().toISOString(),
    resourceType: "staffing_forecast",
    resourceId: forecast.forecastStartDate,
  });

  return forecast;
}

export async function generateStaffingForecastsScheduled(): Promise<{ generated: number; skipped: number }> {
  const agencyIds = await agencyRepo.listAgencyIds();
  let generated = 0;
  let skipped = 0;

  for (const agencyId of agencyIds) {
    try {
      const result = await generateStaffingForecastForAgency(agencyId, "system", "platform_superadmin");
      if (result) generated += 1;
      else skipped += 1;
    } catch (error) {
      console.error(JSON.stringify({ type: "staffing.scheduled_generate_error", agencyId, error: String(error) }));
      skipped += 1;
    }
  }

  return { generated, skipped };
}
