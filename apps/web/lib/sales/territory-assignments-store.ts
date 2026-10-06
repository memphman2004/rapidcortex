/**
 * Persist sales zone → contractor assignments.
 * Prefers PLATFORM_SETTINGS_TABLE; falls back to SALES_CLAIMS_TABLE sentinel row;
 * then in-memory for local/dev.
 */
import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  SALES_TERRITORY_ASSIGNMENTS_CLAIMS_KEY,
  SALES_TERRITORY_ASSIGNMENTS_SETTING_KEY,
  SalesTerritoryAssignmentsConfigSchema,
  emptySalesTerritoryAssignments,
  normalizeSalesTerritoryAssignments,
  type SalesTerritoryAssignmentsConfig,
} from "rapid-cortex-shared";

const g = globalThis as typeof globalThis & {
  __nexcortTerritoryAssignmentsMem?: SalesTerritoryAssignmentsConfig;
  __nexcortTerritoryDdb?: DynamoDBDocumentClient;
};

function trimEnv(...names: string[]): string | null {
  for (const name of names) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  return null;
}

function platformSettingsTable(): string | null {
  return trimEnv("PLATFORM_SETTINGS_TABLE_NAME", "PLATFORM_SETTINGS_TABLE");
}

function claimsTable(): string | null {
  return trimEnv("SALES_CLAIMS_TABLE_NAME");
}

function docClient(): DynamoDBDocumentClient {
  if (!g.__nexcortTerritoryDdb) {
    const client = new DynamoDBClient(
      process.env.AWS_REGION ? { region: process.env.AWS_REGION } : {},
    );
    g.__nexcortTerritoryDdb = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return g.__nexcortTerritoryDdb;
}

function parseConfig(raw: unknown): SalesTerritoryAssignmentsConfig {
  const parsed = SalesTerritoryAssignmentsConfigSchema.safeParse(raw);
  if (!parsed.success) return emptySalesTerritoryAssignments();
  return normalizeSalesTerritoryAssignments(parsed.data);
}

export async function getTerritoryAssignments(): Promise<SalesTerritoryAssignmentsConfig> {
  const settingsTable = platformSettingsTable();
  if (settingsTable) {
    try {
      const out = await docClient().send(
        new GetCommand({
          TableName: settingsTable,
          Key: { settingKey: SALES_TERRITORY_ASSIGNMENTS_SETTING_KEY },
        }),
      );
      if (out.Item?.value) return parseConfig(out.Item.value);
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "territory_assignments_settings_get_failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  const claims = claimsTable();
  if (claims) {
    try {
      const out = await docClient().send(
        new GetCommand({
          TableName: claims,
          Key: { agencySlug: SALES_TERRITORY_ASSIGNMENTS_CLAIMS_KEY },
        }),
      );
      if (out.Item?.assignments) return parseConfig(out.Item.assignments);
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "territory_assignments_claims_get_failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  return g.__nexcortTerritoryAssignmentsMem
    ? normalizeSalesTerritoryAssignments(g.__nexcortTerritoryAssignmentsMem)
    : emptySalesTerritoryAssignments();
}

export async function putTerritoryAssignments(
  value: SalesTerritoryAssignmentsConfig,
  meta?: { updatedByEmail?: string },
): Promise<SalesTerritoryAssignmentsConfig> {
  const normalized = normalizeSalesTerritoryAssignments({
    ...value,
    updatedAt: new Date().toISOString(),
    updatedByEmail: meta?.updatedByEmail,
  });

  const settingsTable = platformSettingsTable();
  if (settingsTable) {
    try {
      await docClient().send(
        new PutCommand({
          TableName: settingsTable,
          Item: {
            settingKey: SALES_TERRITORY_ASSIGNMENTS_SETTING_KEY,
            agencyId: "platform",
            value: normalized,
            updatedAt: normalized.updatedAt,
          },
        }),
      );
      g.__nexcortTerritoryAssignmentsMem = normalized;
      return normalized;
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "territory_assignments_settings_put_failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  const claims = claimsTable();
  if (claims) {
    await docClient().send(
      new PutCommand({
        TableName: claims,
        Item: {
          agencySlug: SALES_TERRITORY_ASSIGNMENTS_CLAIMS_KEY,
          assignments: normalized,
          updatedAt: normalized.updatedAt,
          claimedByEmail: meta?.updatedByEmail ?? "platform",
          _kind: "sales_territory_assignments",
        },
      }),
    );
    g.__nexcortTerritoryAssignmentsMem = normalized;
    return normalized;
  }

  g.__nexcortTerritoryAssignmentsMem = normalized;
  return normalized;
}
