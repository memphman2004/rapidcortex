import {
  BedrockRuntimeClient,
  ConverseCommand,
  ServiceUnavailableException,
  ThrottlingException,
} from "@aws-sdk/client-bedrock-runtime";
import {
  type HourlyBucket,
  type RiskLevel,
  type ShiftForecast,
  type StaffingScheduledEvent,
  type WeeklyStaffingForecast,
  weeklyStaffingForecastSchema,
  shiftForecastSchema,
} from "rapid-cortex-shared";
import { STAFFING_SYSTEM_PROMPT, buildStaffingUserPrompt } from "./prompt.js";
import { env } from "../env.js";

function modelId(): string {
  return (
    process.env.BEDROCK_MODEL_PRIMARY?.trim() ||
    "us.anthropic.claude-haiku-4-5-20251001-v1:0"
  );
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function historicalShift(
  date: string,
  shiftStart: number,
  shiftEnd: number,
  predicted: number,
  p95: number,
  sampleCount: number,
): ShiftForecast {
  const recommended = Math.max(1, Math.ceil(predicted / 15));
  const riskLevel: RiskLevel =
    sampleCount === 0 ? "LOW" : predicted >= p95 && p95 > 0 ? "HIGH" : predicted >= 30 ? "HIGH" : "NORMAL";
  const riskReason =
    sampleCount === 0
      ? "No historical call volume for this shift."
      : `Historical average ${predicted.toFixed(1)} calls (p95 ${p95.toFixed(1)}) across ${sampleCount} samples.`;
  const low = Math.min(predicted, p95);
  const high = Math.max(predicted, p95);
  return shiftForecastSchema.parse({
    date,
    shiftStart,
    shiftEnd,
    predictedCallVolume: predicted,
    confidenceRange: [low, high] as [number, number],
    recommendedDispatchers: recommended,
    currentScheduledDispatchers: null,
    riskLevel,
    riskReason,
  });
}

/** Forecast from stored hourly history. Does not invent a Friday surge or a scheduled roster. */
export function statisticalWeeklyForecast(params: {
  agencyId: string;
  buckets: HourlyBucket[];
  forecastDays: number;
  shiftLengthHours: number;
  dataQualityNote: string | null;
}): WeeklyStaffingForecast {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const days = Math.min(14, Math.max(1, params.forecastDays || 7));
  const length = Math.min(24, Math.max(1, params.shiftLengthHours || 8));
  const shifts: ShiftForecast[] = [];

  for (let day = 0; day < days; day += 1) {
    const dateObj = addDays(start, day);
    const dow = dateObj.getUTCDay();
    for (let hour = 0; hour < 24; hour += length) {
      const end = Math.min(24, hour + length);
      const window = params.buckets.filter(
        (bucket) => bucket.dayOfWeek === dow && bucket.hourOfDay >= hour && bucket.hourOfDay < end,
      );
      const predicted = window.reduce((sum, bucket) => sum + bucket.avgCallVolume, 0);
      const p95 = window.reduce((sum, bucket) => sum + bucket.p95CallVolume, 0);
      const samples = window.reduce((sum, bucket) => sum + bucket.sampleCount, 0);
      shifts.push(historicalShift(isoDate(dateObj), hour, end === 24 ? 0 : end, predicted, p95, samples));
    }
  }

  const rank: Record<RiskLevel, number> = { LOW: 0, NORMAL: 1, HIGH: 2, CRITICAL: 3 };
  const peakRiskShift = shifts.reduce((peak, shift) =>
    rank[shift.riskLevel] > rank[peak.riskLevel] ? shift : peak,
  );
  return weeklyStaffingForecastSchema.parse({
    agencyId: params.agencyId,
    generatedAt: new Date().toISOString(),
    forecastStartDate: isoDate(start),
    shifts,
    weekSummary: {
      peakRiskShift,
      avgRecommended: Math.round(shifts.reduce((sum, shift) => sum + shift.recommendedDispatchers, 0) / shifts.length),
      criticalShiftCount: shifts.filter((shift) => shift.riskLevel === "CRITICAL").length,
      dataQualityNote: params.dataQualityNote,
    },
    modelUsed: "historical-buckets",
  });
}

function parseForecastJson(text: string): { shifts: ShiftForecast[]; weekSummary: WeeklyStaffingForecast["weekSummary"] } {
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  const slice = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
  const parsed = JSON.parse(slice) as {
    shifts: unknown[];
    weekSummary: WeeklyStaffingForecast["weekSummary"];
  };
  return {
    shifts: parsed.shifts.map((s) => shiftForecastSchema.parse(s)),
    weekSummary: parsed.weekSummary,
  };
}

export async function forecastStaffingWithBedrock(params: {
  agencyId: string;
  agencyName: string;
  buckets: HourlyBucket[];
  forecastDays: number;
  shiftLengthHours: number;
  scheduledEvents: StaffingScheduledEvent[];
  dataQualityNote: string | null;
}): Promise<WeeklyStaffingForecast> {
  if (env.predictiveStaffingMock) {
    return statisticalWeeklyForecast(params);
  }

  const client = new BedrockRuntimeClient({ region: env.region });
  const userPrompt = buildStaffingUserPrompt({
    agencyName: params.agencyName,
    buckets: params.buckets,
    forecastDays: params.forecastDays,
    shiftLengthHours: params.shiftLengthHours,
    scheduledEvents: params.scheduledEvents,
    dataQualityNote: params.dataQualityNote,
  });

  try {
    const out = await client.send(
      new ConverseCommand({
        modelId: modelId(),
        system: [{ text: STAFFING_SYSTEM_PROMPT }],
        messages: [{ role: "user", content: [{ text: userPrompt }] }],
        inferenceConfig: { maxTokens: 4096, temperature: 0 },
      }),
    );

    const blocks = out.output?.message?.content;
    const text = blocks?.map((b) => ("text" in b ? b.text : "")).join("")?.trim() ?? "";
    if (!text) {
      return statisticalWeeklyForecast({
        ...params,
        dataQualityNote: "Bedrock returned an empty response. Forecast uses historical call volume only.",
      });
    }

    let parsed: ReturnType<typeof parseForecastJson>;
    try {
      parsed = parseForecastJson(text);
    } catch {
      console.error(JSON.stringify({ type: "staffing.forecast_parse_error", raw: text.slice(0, 200) }));
      return statisticalWeeklyForecast({
        ...params,
        dataQualityNote: "Could not parse the AI forecast. Forecast uses historical call volume only.",
      });
    }

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);

    return weeklyStaffingForecastSchema.parse({
      agencyId: params.agencyId,
      generatedAt: new Date().toISOString(),
      forecastStartDate: isoDate(start),
      shifts: parsed.shifts,
      weekSummary: parsed.weekSummary,
      modelUsed: modelId(),
    });
  } catch (error) {
    if (error instanceof ThrottlingException || error instanceof ServiceUnavailableException) {
      console.warn(JSON.stringify({ type: "staffing.bedrock_throttle", message: String(error) }));
    } else {
      console.error(JSON.stringify({ type: "staffing.bedrock_error", message: String(error) }));
    }
    return statisticalWeeklyForecast({
      ...params,
      dataQualityNote: "AI forecast unavailable. Forecast uses historical call volume only.",
    });
  }
}
