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
  return process.env.BEDROCK_MODEL_PRIMARY?.trim() || "anthropic.claude-3-5-haiku-20241022-v1:0";
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function mockShift(
  date: string,
  shiftStart: number,
  shiftEnd: number,
  predicted: number,
  recommended: number,
  riskLevel: RiskLevel,
  riskReason: string,
): ShiftForecast {
  return shiftForecastSchema.parse({
    date,
    shiftStart,
    shiftEnd,
    predictedCallVolume: predicted,
    confidenceRange: [Math.max(0, predicted - 5), predicted + 8] as [number, number],
    recommendedDispatchers: recommended,
    currentScheduledDispatchers: Math.max(1, recommended - 2),
    riskLevel,
    riskReason,
  });
}

export function mockWeeklyForecast(agencyId: string, dataQualityNote: string | null): WeeklyStaffingForecast {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const forecastStartDate = isoDate(start);
  const shifts: ShiftForecast[] = [];

  for (let day = 0; day < 7; day += 1) {
    const date = isoDate(addDays(start, day));
    const dow = addDays(start, day).getUTCDay();
    const isFriday = dow === 5;
    shifts.push(
      mockShift(
        date,
        isFriday ? 18 : 8,
        isFriday ? 2 : 16,
        isFriday ? 42 : 18,
        isFriday ? 9 : 5,
        isFriday ? "CRITICAL" : day === 2 || day === 4 ? "HIGH" : "NORMAL",
        isFriday
          ? "[MOCK] Expect 40% call volume surge based on historical Friday evening pattern."
          : day === 2 || day === 4
            ? "[MOCK] Elevated weekday volume vs baseline."
            : "[MOCK] Normal staffing range.",
      ),
    );
  }

  const peakRiskShift = shifts.find((s) => s.riskLevel === "CRITICAL") ?? shifts[0]!;
  return weeklyStaffingForecastSchema.parse({
    agencyId,
    generatedAt: new Date().toISOString(),
    forecastStartDate,
    shifts,
    weekSummary: {
      peakRiskShift,
      avgRecommended: Math.round(shifts.reduce((a, s) => a + s.recommendedDispatchers, 0) / shifts.length),
      criticalShiftCount: shifts.filter((s) => s.riskLevel === "CRITICAL").length,
      dataQualityNote,
    },
    modelUsed: "mock",
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
    return mockWeeklyForecast(params.agencyId, params.dataQualityNote);
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
      return mockWeeklyForecast(params.agencyId, "Bedrock returned empty response; using fallback forecast.");
    }

    let parsed: ReturnType<typeof parseForecastJson>;
    try {
      parsed = parseForecastJson(text);
    } catch {
      console.error(JSON.stringify({ type: "staffing.forecast_parse_error", raw: text.slice(0, 200) }));
      return mockWeeklyForecast(params.agencyId, "Could not parse AI forecast; using fallback.");
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
    return mockWeeklyForecast(params.agencyId, "AI forecast unavailable; using statistical fallback.");
  }
}
