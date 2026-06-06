import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { HospitalPreAlert, HospitalPreAlertStatus } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type HospitalPreAlertRow = HospitalPreAlert & {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
  gsi2pk: string;
  gsi2sk: string;
};

function pk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}

function sk(alertId: string): string {
  return `ALERT#${alertId}`;
}

function gsi1pk(hospitalId: string): string {
  return `HOSPITAL#${hospitalId}`;
}

function gsi1sk(status: HospitalPreAlertStatus, createdAt: string): string {
  return `STATUS#${status}#${createdAt}`;
}

function gsi2pk(incidentId: string): string {
  return `INCIDENT#${incidentId}`;
}

function gsi2sk(createdAt: string): string {
  return `CREATED#${createdAt}`;
}

function toRow(alert: HospitalPreAlert): HospitalPreAlertRow {
  return {
    ...alert,
    pk: pk(alert.agencyId),
    sk: sk(alert.alertId),
    gsi1pk: gsi1pk(alert.hospitalId),
    gsi1sk: gsi1sk(alert.status, alert.createdAt),
    gsi2pk: gsi2pk(alert.incidentId),
    gsi2sk: gsi2sk(alert.createdAt),
  };
}

function fromRow(row: HospitalPreAlertRow): HospitalPreAlert {
  const {
    pk: _pk,
    sk: _sk,
    gsi1pk: _g1pk,
    gsi1sk: _g1sk,
    gsi2pk: _g2pk,
    gsi2sk: _g2sk,
    ...alert
  } = row;
  return alert;
}

export class HospitalPreAlertRepository {
  private requireTable(): string {
    const t = env.hospitalPreAlertsTable;
    if (!t) throw new Error("HOSPITAL_PREALERTS_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(alert: HospitalPreAlert): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.requireTable(),
        Item: toRow(alert),
        ConditionExpression: "attribute_not_exists(pk) OR attribute_exists(pk)",
      }),
    );
  }

  async get(agencyId: string, alertId: string): Promise<HospitalPreAlert | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.requireTable(),
        Key: { pk: pk(agencyId), sk: sk(alertId) },
      }),
    );
    if (!out.Item) return null;
    return fromRow(out.Item as HospitalPreAlertRow);
  }

  async listByAgency(agencyId: string, limit = 100): Promise<HospitalPreAlert[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": pk(agencyId),
          ":prefix": "ALERT#",
        },
        ScanIndexForward: false,
        Limit: Math.min(limit, 200),
      }),
    );
    return (out.Items ?? []).map((row) => fromRow(row as HospitalPreAlertRow));
  }

  async listByIncident(incidentId: string, limit = 50): Promise<HospitalPreAlert[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        IndexName: "GSI2",
        KeyConditionExpression: "gsi2pk = :inc",
        ExpressionAttributeValues: { ":inc": gsi2pk(incidentId) },
        ScanIndexForward: false,
        Limit: Math.min(limit, 100),
      }),
    );
    return (out.Items ?? []).map((row) => fromRow(row as HospitalPreAlertRow));
  }

  async listByHospital(hospitalId: string, limit = 50): Promise<HospitalPreAlert[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        IndexName: "GSI1",
        KeyConditionExpression: "gsi1pk = :hid",
        ExpressionAttributeValues: { ":hid": gsi1pk(hospitalId) },
        ScanIndexForward: false,
        Limit: Math.min(limit, 100),
      }),
    );
    return (out.Items ?? []).map((row) => fromRow(row as HospitalPreAlertRow));
  }

  async update(
    agencyId: string,
    alertId: string,
    patch: Partial<HospitalPreAlert>,
  ): Promise<HospitalPreAlert | null> {
    const existing = await this.get(agencyId, alertId);
    if (!existing) return null;
    const next: HospitalPreAlert = {
      ...existing,
      ...patch,
      alertId: existing.alertId,
      agencyId: existing.agencyId,
      updatedAt: new Date().toISOString(),
    };
    await ddb.send(
      new PutCommand({
        TableName: this.requireTable(),
        Item: toRow(next),
      }),
    );
    return next;
  }

  async updateStatus(
    agencyId: string,
    alertId: string,
    status: HospitalPreAlertStatus,
    extra?: Partial<HospitalPreAlert>,
  ): Promise<HospitalPreAlert | null> {
    return this.update(agencyId, alertId, { status, ...extra });
  }
}
