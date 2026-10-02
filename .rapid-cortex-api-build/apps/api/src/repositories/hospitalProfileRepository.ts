import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { HospitalProfile } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type HospitalProfileRow = HospitalProfile & {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
};

function pk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}

function sk(hospitalId: string): string {
  return `HOSPITAL#${hospitalId}`;
}

function toRow(profile: HospitalProfile): HospitalProfileRow {
  const trauma = profile.traumaLevel ?? "NONE";
  return {
    ...profile,
    pk: pk(profile.agencyId),
    sk: sk(profile.hospitalId),
    gsi1pk: "CAPABILITIES",
    gsi1sk: `TRAUMA#${trauma}#${profile.name}`,
  };
}

function fromRow(row: HospitalProfileRow): HospitalProfile {
  const { pk: _pk, sk: _sk, gsi1pk: _g1, gsi1sk: _g2, ...profile } = row;
  return profile;
}

export class HospitalProfileRepository {
  private requireTable(): string {
    const t = env.hospitalProfilesTable;
    if (!t) throw new Error("HOSPITAL_PROFILES_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(profile: HospitalProfile): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.requireTable(),
        Item: toRow(profile),
      }),
    );
  }

  async get(agencyId: string, hospitalId: string): Promise<HospitalProfile | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.requireTable(),
        Key: { pk: pk(agencyId), sk: sk(hospitalId) },
      }),
    );
    if (!out.Item) return null;
    return fromRow(out.Item as HospitalProfileRow);
  }

  async listByAgency(agencyId: string, activeOnly = true): Promise<HospitalProfile[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": pk(agencyId),
          ":prefix": "HOSPITAL#",
        },
        Limit: 200,
      }),
    );
    const items = (out.Items ?? []).map((row) => fromRow(row as HospitalProfileRow));
    return activeOnly ? items.filter((h) => h.active) : items;
  }
}
