import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { GisDatasetRecord } from "rapid-cortex-shared";
import { gisDatasetSk, gisTenantPk } from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";

function tableName(): string {
  const t = process.env.GIS_DATASETS_TABLE?.trim();
  if (!t) throw new Error("GIS_DATASETS_TABLE is not configured");
  return t;
}

type GisRow = GisDatasetRecord & { pk: string; sk: string };

function toRecord(item: Record<string, unknown>): GisDatasetRecord {
  const { pk: _p, sk: _s, ...rest } = item as GisRow;
  return rest as GisDatasetRecord;
}

export class GisDatasetsRepository {
  async put(record: GisDatasetRecord): Promise<void> {
    const row: GisRow = {
      ...record,
      pk: gisTenantPk(record.agencyId),
      sk: gisDatasetSk(record.datasetId),
    };
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: row,
      }),
    );
  }

  async get(agencyId: string, datasetId: string): Promise<GisDatasetRecord | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: { pk: gisTenantPk(agencyId), sk: gisDatasetSk(datasetId) },
      }),
    );
    if (!res.Item) return null;
    return toRecord(res.Item as Record<string, unknown>);
  }

  async listByAgency(agencyId: string): Promise<GisDatasetRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": gisTenantPk(agencyId),
          ":sk": "DATASET#",
        },
      }),
    );
    return (res.Items ?? []).map((i) => toRecord(i as Record<string, unknown>));
  }

  async updateApproval(
    agencyId: string,
    datasetId: string,
    patch: {
      approvalStatus: GisDatasetRecord["approvalStatus"];
      validationStatus?: GisDatasetRecord["validationStatus"];
      approvedBy?: string;
      approvedAt?: string;
      enabled?: boolean;
      updatedAt: string;
    },
  ): Promise<GisDatasetRecord | null> {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { pk: gisTenantPk(agencyId), sk: gisDatasetSk(datasetId) },
        UpdateExpression:
          "SET approvalStatus = :a, updatedAt = :u" +
          (patch.validationStatus ? ", validationStatus = :vs" : "") +
          (patch.approvedBy ? ", approvedBy = :by, approvedAt = :at" : "") +
          (patch.enabled !== undefined ? ", enabled = :en" : ""),
        ExpressionAttributeValues: {
          ":a": patch.approvalStatus,
          ":u": patch.updatedAt,
          ...(patch.validationStatus ? { ":vs": patch.validationStatus } : {}),
          ...(patch.approvedBy ? { ":by": patch.approvedBy, ":at": patch.approvedAt } : {}),
          ...(patch.enabled !== undefined ? { ":en": patch.enabled } : {}),
        },
        ConditionExpression: "attribute_exists(pk)",
        ReturnValues: "ALL_NEW",
      }),
    );
    if (!res.Attributes) return null;
    return toRecord(res.Attributes as Record<string, unknown>);
  }
}
