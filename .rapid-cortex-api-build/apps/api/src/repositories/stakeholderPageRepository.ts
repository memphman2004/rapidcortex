import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import type { StakeholderPage } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type StakeholderPageRow = StakeholderPage & { pk: string };

function pk(agencyId: string, pageId: string): string {
  return `${agencyId}#${pageId}`;
}

function toRow(page: StakeholderPage): StakeholderPageRow {
  return { ...page, pk: pk(page.agencyId, page.pageId) };
}

function fromRow(row: StakeholderPageRow): StakeholderPage {
  const { pk: _pk, ...page } = row;
  return page;
}

export class StakeholderPageRepository {
  private requireTable(): string {
    const t = env.stakeholderPagesTable;
    if (!t) throw new Error("STAKEHOLDER_PAGES_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(page: StakeholderPage): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.requireTable(),
        Item: toRow(page),
      }),
    );
  }

  async get(agencyId: string, pageId: string): Promise<StakeholderPage | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.requireTable(),
        Key: { pk: pk(agencyId, pageId) },
      }),
    );
    if (!out.Item) return null;
    return fromRow(out.Item as StakeholderPageRow);
  }

  async getBySlug(slug: string): Promise<StakeholderPage | null> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        IndexName: "slug-index",
        KeyConditionExpression: "slug = :s",
        ExpressionAttributeValues: { ":s": slug },
        Limit: 1,
      }),
    );
    const item = out.Items?.[0];
    if (!item) return null;
    return fromRow(item as StakeholderPageRow);
  }

  async listByIncident(agencyId: string, incidentId: string, limit = 20): Promise<StakeholderPage[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        IndexName: "agencyId-incidentId-index",
        KeyConditionExpression: "agencyId = :a AND incidentId = :i",
        ExpressionAttributeValues: { ":a": agencyId, ":i": incidentId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []).map((i) => fromRow(i as StakeholderPageRow));
  }

  async delete(agencyId: string, pageId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: this.requireTable(),
        Key: { pk: pk(agencyId, pageId) },
        ConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
      }),
    );
  }
}
