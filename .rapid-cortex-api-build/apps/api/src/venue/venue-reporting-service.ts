/**
 * Venue form schema + integration import + analytics + CSV export (RFP 2396IP).
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  DEFAULT_VENUE_FORM_SCHEMA,
  type VenueFormSchemaConfig,
  type VenueFormSchemaPutBody,
  type VenueIntegrationImportBody,
} from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { writeVenueRfpAudit } from "./venue-rfp-audit.js";
import type { VenueIncidentRecord } from "./venue-types.js";
import { VENUE_KEYS } from "./venue-types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function venueConfigTable(): string {
  const t = process.env.VENUE_CONFIG_TABLE?.trim();
  if (!t) throw new Error("VENUE_CONFIG_TABLE not set");
  return t;
}

export async function getVenueFormSchema(venueCode: string): Promise<VenueFormSchemaConfig> {
  const code = venueCode.toUpperCase();
  const r = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: { pk: VENUE_KEYS.configPk(code), sk: VENUE_KEYS.formSchemaSk() },
    }),
  );
  if (!r.Item) return { ...DEFAULT_VENUE_FORM_SCHEMA };
  return r.Item as VenueFormSchemaConfig;
}

export async function putVenueFormSchema(params: {
  venueCode: string;
  agencyId: string;
  actorId: string;
  actorRole: string;
  body: VenueFormSchemaPutBody;
}): Promise<VenueFormSchemaConfig> {
  const code = params.venueCode.toUpperCase();
  const now = new Date().toISOString();
  const stored: VenueFormSchemaConfig = {
    ...params.body,
    updatedAt: now,
    updatedBy: params.actorId,
  };
  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: {
        pk: VENUE_KEYS.configPk(code),
        sk: VENUE_KEYS.formSchemaSk(),
        agencyId: params.agencyId,
        venueCode: code,
        ...stored,
      },
    }),
  );
  await writeVenueRfpAudit({
    venueCode: code,
    agencyId: params.agencyId,
    eventType: "FORM_SCHEMA_UPDATED",
    actorId: params.actorId,
    actorRole: params.actorRole,
    resourceType: "form",
    resourceId: "FORM_SCHEMA",
    after: { version: stored.version, categories: stored.categories.length },
  });
  return stored;
}

export async function runVenueIntegrationImport(params: {
  venueCode: string;
  agencyId: string;
  actorId: string;
  actorRole: string;
  body: VenueIntegrationImportBody;
}): Promise<{ imported: number; skipped: number; dryRun: boolean; runId: string }> {
  const code = params.venueCode.toUpperCase();
  const runId = makeId("imp");
  const now = new Date().toISOString();
  let imported = 0;
  let skipped = 0;

  for (const rec of params.body.records) {
    const sk =
      rec.type === "employee"
        ? `EMPLOYEE#${rec.externalId}`
        : `EVENT_IMPORT#${rec.externalId}`;
    if (params.body.dryRun) {
      imported += 1;
      continue;
    }
    try {
      await ddb.send(
        new PutCommand({
          TableName: venueConfigTable(),
          Item: {
            pk: VENUE_KEYS.configPk(code),
            sk,
            agencyId: params.agencyId,
            venueCode: code,
            ...rec,
            source: params.body.source,
            updatedAt: now,
            createdAt: now,
          },
          ConditionExpression: "attribute_not_exists(sk)",
        }),
      );
      imported += 1;
    } catch {
      skipped += 1;
      // update existing
      await ddb.send(
        new PutCommand({
          TableName: venueConfigTable(),
          Item: {
            pk: VENUE_KEYS.configPk(code),
            sk,
            agencyId: params.agencyId,
            venueCode: code,
            ...rec,
            source: params.body.source,
            updatedAt: now,
          },
        }),
      );
      imported += 1;
      skipped -= 1;
    }
  }

  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: {
        pk: VENUE_KEYS.configPk(code),
        sk: VENUE_KEYS.importRunSk(runId, now),
        runId,
        agencyId: params.agencyId,
        venueCode: code,
        source: params.body.source,
        imported,
        skipped,
        dryRun: params.body.dryRun,
        createdAt: now,
        actorId: params.actorId,
      },
    }),
  );

  await writeVenueRfpAudit({
    venueCode: code,
    agencyId: params.agencyId,
    eventType: "IMPORT_RUN",
    actorId: params.actorId,
    actorRole: params.actorRole,
    resourceType: "import",
    resourceId: runId,
    metadata: { imported, skipped, dryRun: params.body.dryRun, source: params.body.source },
  });

  return { imported, skipped, dryRun: params.body.dryRun, runId };
}

export type VenueAnalyticsBundle = {
  venueCode: string;
  startDate: string;
  endDate: string;
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byZone: Record<string, number>;
  byDay: { day: string; count: number }[];
  avgResponseSeconds: number | null;
};

export async function getVenueAnalytics(params: {
  venueCode: string;
  agencyId: string;
  startDate?: string;
  endDate?: string;
}): Promise<VenueAnalyticsBundle> {
  const code = params.venueCode.toUpperCase();
  const end = params.endDate ? new Date(params.endDate) : new Date();
  const start = params.startDate
    ? new Date(params.startDate)
    : new Date(end.getTime() - 30 * 86400_000);

  const r = await ddb.send(
    new QueryCommand({
      TableName: venueConfigTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": VENUE_KEYS.incidentPk(code),
        ":prefix": "INCIDENT#",
      },
      Limit: 1000,
    }),
  );

  const incidents = ((r.Items ?? []) as VenueIncidentRecord[]).filter((row) => {
    if (row.sk.includes("#EVIDENCE#") || row.sk.includes("#UPDATE#") || row.sk.includes("#REPORT#")) {
      return false;
    }
    if (row.agencyId && row.agencyId !== params.agencyId && !params.agencyId.startsWith("rc")) return false;
    const created = Date.parse(row.createdAt ?? "");
    return Number.isFinite(created) && created >= start.getTime() && created <= end.getTime();
  });

  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byZone: Record<string, number> = {};
  const byDayMap = new Map<string, number>();
  let responseSum = 0;
  let responseN = 0;

  for (const inc of incidents) {
    byStatus[inc.status] = (byStatus[inc.status] ?? 0) + 1;
    byType[inc.type] = (byType[inc.type] ?? 0) + 1;
    const zone = inc.zoneCode || "UNKNOWN";
    byZone[zone] = (byZone[zone] ?? 0) + 1;
    const day = (inc.createdAt ?? "").slice(0, 10);
    if (day) byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
    if (inc.dispositionAt) {
      const ms = Date.parse(inc.dispositionAt) - Date.parse(inc.createdAt);
      if (Number.isFinite(ms) && ms > 0) {
        responseSum += ms / 1000;
        responseN += 1;
      }
    }
  }

  return {
    venueCode: code,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    total: incidents.length,
    byStatus,
    byType,
    byZone,
    byDay: [...byDayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count })),
    avgResponseSeconds: responseN ? Math.round(responseSum / responseN) : null,
  };
}

export async function exportVenueIncidentsCsv(params: {
  venueCode: string;
  agencyId: string;
  actorId: string;
  actorRole: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ csv: string; count: number }> {
  const analyticsScope = await getVenueAnalytics(params);
  // Re-query for full rows in window
  const code = params.venueCode.toUpperCase();
  const r = await ddb.send(
    new QueryCommand({
      TableName: venueConfigTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": VENUE_KEYS.incidentPk(code),
        ":prefix": "INCIDENT#",
      },
      Limit: 2000,
    }),
  );
  const start = Date.parse(analyticsScope.startDate);
  const end = Date.parse(analyticsScope.endDate);
  const rows = ((r.Items ?? []) as VenueIncidentRecord[]).filter((row) => {
    if (!row.incidentId || row.sk.includes("#")) {
      // sk is INCIDENT#id — reject compound children
      const parts = String(row.sk).split("#");
      if (parts.length !== 2) return false;
    }
    const created = Date.parse(row.createdAt ?? "");
    return created >= start && created <= end;
  });

  const header = [
    "incidentId",
    "status",
    "type",
    "zoneCode",
    "assignedTo",
    "escalationLevel",
    "approvalStatus",
    "createdAt",
    "updatedAt",
    "disposition",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.incidentId,
        row.status,
        row.type,
        row.zoneCode,
        row.assignedTo,
        row.escalationLevel ?? 0,
        row.approvalStatus ?? "",
        row.createdAt,
        row.updatedAt,
        row.disposition ?? "",
      ]
        .map(escape)
        .join(","),
    );
  }

  await writeVenueRfpAudit({
    venueCode: code,
    agencyId: params.agencyId,
    eventType: "INCIDENT_EXPORTED",
    actorId: params.actorId,
    actorRole: params.actorRole,
    resourceType: "incident",
    resourceId: code,
    metadata: { format: "csv", count: rows.length },
  });

  return { csv: lines.join("\n"), count: rows.length };
}
