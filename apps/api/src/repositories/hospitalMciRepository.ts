import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { MciDistributionPlan } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type MciPlanRow = MciDistributionPlan & {
  pk: string;
  sk: string;
};

function pk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}

function sk(incidentId: string): string {
  return `MCI#${incidentId}`;
}

function toRow(plan: MciDistributionPlan): MciPlanRow {
  return { ...plan, pk: pk(plan.agencyId), sk: sk(plan.incidentId) };
}

function fromRow(row: MciPlanRow): MciDistributionPlan {
  const { pk: _pk, sk: _sk, ...plan } = row;
  return plan;
}

export class HospitalMciRepository {
  private requireTable(): string {
    const t = env.hospitalCapacityTable;
    if (!t) throw new Error("HOSPITAL_CAPACITY_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(plan: MciDistributionPlan): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.requireTable(),
        Item: toRow(plan),
      }),
    );
  }

  async get(agencyId: string, incidentId: string): Promise<MciDistributionPlan | null> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        KeyConditionExpression: "pk = :pk AND sk = :sk",
        ExpressionAttributeValues: {
          ":pk": pk(agencyId),
          ":sk": sk(incidentId),
        },
        Limit: 1,
      }),
    );
    const row = out.Items?.[0] as MciPlanRow | undefined;
    return row ? fromRow(row) : null;
  }
}
