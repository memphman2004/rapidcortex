import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { WeeklyStaffingForecast } from "rapid-cortex-shared";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../env.js";

const TTL_DAYS = 90;

function tableName(): string {
  const t = env.staffingForecastTable?.trim();
  if (!t) throw new Error("STAFFING_FORECAST_TABLE not configured");
  return t;
}

export async function saveStaffingForecast(forecast: WeeklyStaffingForecast): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 86_400;
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        ...forecast,
        forecastDate: forecast.forecastStartDate,
        ttl,
      },
    }),
  );
}

export async function getStaffingForecast(
  agencyId: string,
  startDate?: string,
): Promise<WeeklyStaffingForecast | null> {
  const targetStart = startDate ?? new Date().toISOString().slice(0, 10);

  const exact = await ddb.send(
    new GetCommand({
      TableName: tableName(),
      Key: { agencyId, forecastDate: targetStart },
    }),
  );
  if (exact.Item) {
    return exact.Item as WeeklyStaffingForecast;
  }

  const recent = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "agencyId = :a AND forecastDate <= :d",
      ExpressionAttributeValues: {
        ":a": agencyId,
        ":d": targetStart,
      },
      ScanIndexForward: false,
      Limit: 1,
    }),
  );

  const item = recent.Items?.[0];
  return item ? (item as WeeklyStaffingForecast) : null;
}
