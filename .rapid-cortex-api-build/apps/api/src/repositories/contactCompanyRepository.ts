import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { ContactCompany, RelationshipType, UpdateCompanyBody } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

function table(): string {
  const t = env.contactCompaniesTable?.trim();
  if (!t) throw new Error("CONTACT_COMPANIES_TABLE_NOT_CONFIGURED");
  return t;
}

export class ContactCompanyRepository {
  async put(company: ContactCompany): Promise<void> {
    await ddb.send(new PutCommand({ TableName: table(), Item: company }));
  }

  async get(companyId: string): Promise<ContactCompany | null> {
    const r = await ddb.send(new GetCommand({ TableName: table(), Key: { companyId } }));
    return (r.Item as ContactCompany | undefined) ?? null;
  }

  async listAll(limit = 500): Promise<ContactCompany[]> {
    const items: ContactCompany[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await ddb.send(
        new ScanCommand({
          TableName: table(),
          ExclusiveStartKey,
          Limit: Math.min(100, limit - items.length),
        }),
      );
      items.push(...((r.Items as ContactCompany[]) ?? []));
      ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey && items.length < limit);
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  async listByType(relationshipType: RelationshipType, limit = 200): Promise<ContactCompany[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "type-created-index",
        KeyConditionExpression: "relationshipType = :t",
        ExpressionAttributeValues: { ":t": relationshipType },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return ((r.Items as ContactCompany[]) ?? []).sort((a, b) => a.name.localeCompare(b.name));
  }

  async update(companyId: string, patch: UpdateCompanyBody): Promise<ContactCompany | null> {
    const existing = await this.get(companyId);
    if (!existing) return null;
    const updated: ContactCompany = {
      ...existing,
      ...Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      ),
      companyId: existing.companyId,
      contactCount: existing.contactCount,
      addedBy: existing.addedBy,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      verticals: patch.verticals ?? existing.verticals,
      tags: patch.tags ?? existing.tags,
      linkedSignalIds: patch.linkedSignalIds ?? existing.linkedSignalIds,
      linkedProspectIds: patch.linkedProspectIds ?? existing.linkedProspectIds,
      industry: patch.industry !== undefined ? patch.industry : existing.industry,
      website: patch.website !== undefined ? patch.website : existing.website,
      hq: patch.hq !== undefined ? patch.hq : existing.hq,
      phone: patch.phone !== undefined ? patch.phone : existing.phone,
      linkedInUrl: patch.linkedInUrl !== undefined ? patch.linkedInUrl : existing.linkedInUrl,
      notes: patch.notes !== undefined ? patch.notes : existing.notes,
      name: patch.name ?? existing.name,
      relationshipType: patch.relationshipType ?? existing.relationshipType,
    };
    await this.put(updated);
    return updated;
  }

  async bumpContactCount(companyId: string, delta: number): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { companyId },
        UpdateExpression: "SET contactCount = if_not_exists(contactCount, :z) + :d, updatedAt = :u",
        ExpressionAttributeValues: {
          ":d": delta,
          ":z": 0,
          ":u": new Date().toISOString(),
        },
      }),
    );
  }

  async touchActivity(companyId: string, at = new Date().toISOString()): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { companyId },
        UpdateExpression: "SET lastActivityAt = :a, updatedAt = :u",
        ExpressionAttributeValues: { ":a": at, ":u": at },
      }),
    );
  }

  async delete(companyId: string): Promise<void> {
    await ddb.send(new DeleteCommand({ TableName: table(), Key: { companyId } }));
  }

  async findByName(name: string): Promise<ContactCompany | null> {
    const lower = name.trim().toLowerCase();
    if (!lower) return null;
    const all = await this.listAll(1000);
    return all.find((c) => c.name.toLowerCase() === lower) ?? null;
  }
}
