import type { HourlyBucket, StaffingScheduledEvent } from "rapid-cortex-shared";

export const STAFFING_SYSTEM_PROMPT = `You are a 911 dispatch staffing analyst. Given historical call volume buckets, generate a 7-day shift-level staffing forecast.

Rules:
- Apply the industry standard of 1 dispatcher per 3–4 simultaneous calls, factoring in break coverage (add 20%).
- Each shift must include: date (YYYY-MM-DD), shiftStart (hour 0–23), shiftEnd (hour 0–23), predictedCallVolume, confidenceRange [low, high], recommendedDispatchers (integer >= 1), currentScheduledDispatchers (null if unknown), riskLevel (CRITICAL|HIGH|NORMAL|LOW), riskReason (plain English, <= 200 chars).
- riskLevel CRITICAL when predicted volume exceeds comfortable staffing by >40%; HIGH when >20%; NORMAL otherwise; LOW when volume is well below capacity.
- Return valid JSON only matching this shape:
{"shifts":[...],"weekSummary":{"peakRiskShift":{...same shift fields...},"avgRecommended":number,"criticalShiftCount":number,"dataQualityNote":string|null}}
No markdown, no text outside JSON.`;

export function buildStaffingUserPrompt(params: {
  agencyName: string;
  buckets: HourlyBucket[];
  forecastDays: number;
  shiftLengthHours: number;
  scheduledEvents: StaffingScheduledEvent[];
  dataQualityNote: string | null;
}): string {
  return [
    `Agency: ${params.agencyName}`,
    `Forecast horizon: ${params.forecastDays} days`,
    `Shift length: ${params.shiftLengthHours} hours`,
    params.dataQualityNote ? `Data quality: ${params.dataQualityNote}` : "",
    params.scheduledEvents.length
      ? `Known upcoming events:\n${JSON.stringify(params.scheduledEvents)}`
      : "Known upcoming events: none",
    "",
    "Historical hourly buckets (dayOfWeek 0=Sun … 6=Sat):",
    JSON.stringify(params.buckets),
    "",
    "Generate the staffing forecast JSON.",
  ]
    .filter(Boolean)
    .join("\n");
}
