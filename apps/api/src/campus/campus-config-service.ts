import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { CampusAnalytics, CampusBuilding, CampusConfig, CampusZone } from "./campus-types.js";
import { CAMPUS_KEYS } from "./campus-types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function campusConfigTable(): string {
  const t = process.env.CAMPUS_CONFIG_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_CONFIG_TABLE not set");
  return t;
}

function campusIncidentsTable(): string {
  const t = process.env.CAMPUS_INCIDENTS_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_INCIDENTS_TABLE not set");
  return t;
}

export async function getCampusConfig(campusCode: string): Promise<CampusConfig | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: campusConfigTable(),
      Key: {
        pk: CAMPUS_KEYS.configPk(campusCode),
        sk: CAMPUS_KEYS.settingsSk(),
      },
    }),
  );
  return (result.Item as CampusConfig) ?? null;
}

export async function getCampusBuildings(campusCode: string): Promise<CampusBuilding[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: campusConfigTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": CAMPUS_KEYS.configPk(campusCode),
        ":prefix": "BUILDING#",
      },
    }),
  );

  const buildings = (result.Items ?? []) as CampusBuilding[];
  for (const building of buildings) {
    const zoneResult = await ddb.send(
      new QueryCommand({
        TableName: campusConfigTable(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": CAMPUS_KEYS.configPk(campusCode),
          ":prefix": `ZONE#${building.code}-`,
        },
      }),
    );
    building.zones = (zoneResult.Items ?? []) as CampusZone[];
  }

  return buildings;
}

export async function getCampusZone(campusCode: string, zoneCode: string): Promise<CampusZone | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: campusConfigTable(),
      Key: {
        pk: CAMPUS_KEYS.configPk(campusCode),
        sk: CAMPUS_KEYS.zoneSk(zoneCode),
      },
    }),
  );
  return (result.Item as CampusZone) ?? null;
}

export async function getCampusAnalytics(
  campusCode: string,
  range: "today" | "week" | "month",
): Promise<CampusAnalytics> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: campusIncidentsTable(),
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": CAMPUS_KEYS.incidentPk(campusCode),
      },
      ScanIndexForward: false,
      Limit: 200,
    }),
  );

  const all = ((result.Items ?? []).filter(
    (i) => typeof (i as { sk?: string }).sk === "string" && String((i as { sk: string }).sk).startsWith("INCIDENT#"),
  ) ?? []) as Array<{
    type: string;
    status: string;
    confidential: boolean;
    source: string;
    createdAt: string;
    resolvedAt?: string;
    buildingLabel: string;
  }>;

  const now = new Date();
  const rangeMs = range === "today" ? 86400000 : range === "week" ? 604800000 : 2592000000;
  const cutoff = new Date(now.getTime() - rangeMs).toISOString();
  const inRange = all.filter((i) => i.createdAt >= cutoff);

  const byType = {
    medical: 0,
    security: 0,
    mental_health: 0,
    suspicious_activity: 0,
    wellness_check: 0,
    property_crime: 0,
    maintenance: 0,
    active_threat: 0,
    other: 0,
  };
  const byBuilding: Record<string, number> = {};

  for (const i of inRange) {
    if (i.type in byType) {
      byType[i.type as keyof typeof byType] = byType[i.type as keyof typeof byType] + 1;
    }
    byBuilding[i.buildingLabel] = (byBuilding[i.buildingLabel] ?? 0) + 1;
  }

  const today = new Date().toISOString().slice(0, 10);

  return {
    totalIncidents: inRange.length,
    openIncidents: inRange.filter((i) => ["open", "assigned", "responding"].includes(i.status)).length,
    respondingNow: inRange.filter((i) => i.status === "responding").length,
    resolvedToday: all.filter((i) => i.status === "resolved" && i.resolvedAt?.startsWith(today)).length,
    confidentialReports: inRange.filter((i) => i.confidential).length,
    byType,
    byBuilding: Object.entries(byBuilding)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([buildingLabel, count]) => ({ buildingLabel, count })),
    bySource: {
      qr: inRange.filter((i) => i.source === "qr").length,
      sms: inRange.filter((i) => i.source === "sms").length,
      manual: inRange.filter((i) => i.source === "manual").length,
      phone: inRange.filter((i) => i.source === "phone").length,
    },
    avgResponseMinutes: 0,
    escalatedToCore: inRange.filter((i) => i.status === "escalated").length,
    referredToCounseling: inRange.filter((i) => i.status === "referred").length,
  };
}
