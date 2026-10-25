import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { AgencyCADFeature, CadUserGrant } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type AgencyCadRecord = {
  name: string;
  feature: AgencyCADFeature | null;
  grants: Record<string, CadUserGrant>;
};

function asFeature(raw: unknown): AgencyCADFeature | null {
  if (!raw || typeof raw !== "object") return null;
  const cad = (raw as { cad?: unknown }).cad;
  if (!cad || typeof cad !== "object") return null;
  const row = cad as AgencyCADFeature;
  if (typeof row.enabled !== "boolean" || typeof row.maxCadSeats !== "number") return null;
  return row;
}

function asGrants(raw: unknown): Record<string, CadUserGrant> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, CadUserGrant>;
}

/** Reads and writes only the CAD license fields on the existing agency item. */
export class CadModuleRepository {
  async get(agencyId: string): Promise<AgencyCadRecord | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: env.agenciesTable,
        Key: { agencyId },
        ProjectionExpression: "#n, features, cadUserGrants",
        ExpressionAttributeNames: { "#n": "name" },
      }),
    );
    if (!res.Item) return null;
    return {
      name: typeof res.Item.name === "string" && res.Item.name.trim() ? res.Item.name : agencyId,
      feature: asFeature(res.Item.features),
      grants: asGrants(res.Item.cadUserGrants),
    };
  }

  async save(
    agencyId: string,
    feature: AgencyCADFeature,
    grants: Record<string, CadUserGrant>,
  ): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: env.agenciesTable,
        Key: { agencyId },
        ConditionExpression: "attribute_exists(agencyId)",
        UpdateExpression: "SET features.cad = :cad, cadUserGrants = :grants, updatedAt = :now",
        ExpressionAttributeValues: {
          ":cad": feature,
          ":grants": grants,
          ":now": new Date().toISOString(),
        },
      }),
    );
  }
}
