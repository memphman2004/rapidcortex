import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { ContactPerson, UpdateContactBody } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

function table(): string {
  const t = env.contactPersonsTable?.trim();
  if (!t) throw new Error("CONTACT_PERSONS_TABLE_NOT_CONFIGURED");
  return t;
}

export class ContactPersonRepository {
  async put(contact: ContactPerson): Promise<void> {
    await ddb.send(new PutCommand({ TableName: table(), Item: contact }));
  }

  async get(contactId: string): Promise<ContactPerson | null> {
    const r = await ddb.send(new GetCommand({ TableName: table(), Key: { contactId } }));
    return (r.Item as ContactPerson | undefined) ?? null;
  }

  async listByCompany(companyId: string, limit = 200): Promise<ContactPerson[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "company-created-index",
        KeyConditionExpression: "companyId = :c",
        ExpressionAttributeValues: { ":c": companyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return ((r.Items as ContactPerson[]) ?? []).sort((a, b) =>
      `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`),
    );
  }

  async search(q: string, limit = 50): Promise<ContactPerson[]> {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const items: ContactPerson[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await ddb.send(
        new ScanCommand({
          TableName: table(),
          ExclusiveStartKey,
          Limit: 100,
        }),
      );
      for (const raw of (r.Items as ContactPerson[]) ?? []) {
        const hay = [
          raw.firstName,
          raw.lastName,
          raw.email,
          raw.title,
          raw.companyName,
          raw.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (hay.includes(needle)) items.push(raw);
        if (items.length >= limit) break;
      }
      ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey && items.length < limit);
    return items;
  }

  async update(
    contactId: string,
    patch: UpdateContactBody & { lastContactedBy?: string | null; lastContactedAt?: string | null },
  ): Promise<ContactPerson | null> {
    const existing = await this.get(contactId);
    if (!existing) return null;
    const updated: ContactPerson = {
      ...existing,
      firstName: patch.firstName ?? existing.firstName,
      lastName: patch.lastName ?? existing.lastName,
      title: patch.title !== undefined ? patch.title : existing.title,
      department: patch.department !== undefined ? patch.department : existing.department,
      email: patch.email !== undefined ? patch.email : existing.email,
      emailVerified: patch.emailVerified ?? existing.emailVerified,
      phone: patch.phone !== undefined ? patch.phone : existing.phone,
      mobilePhone: patch.mobilePhone !== undefined ? patch.mobilePhone : existing.mobilePhone,
      linkedInUrl: patch.linkedInUrl !== undefined ? patch.linkedInUrl : existing.linkedInUrl,
      location: patch.location !== undefined ? patch.location : existing.location,
      notes: patch.notes !== undefined ? patch.notes : existing.notes,
      outreachStatus: patch.outreachStatus ?? existing.outreachStatus,
      tags: patch.tags ?? existing.tags,
      source: patch.source ?? existing.source,
      updatedAt: new Date().toISOString(),
    };
    if (
      patch.outreachStatus &&
      patch.outreachStatus !== "not_contacted" &&
      patch.outreachStatus !== existing.outreachStatus
    ) {
      updated.lastContactedAt = patch.lastContactedAt ?? new Date().toISOString();
      if (patch.lastContactedBy !== undefined) {
        updated.lastContactedBy = patch.lastContactedBy;
      }
    } else {
      if (patch.lastContactedAt !== undefined) updated.lastContactedAt = patch.lastContactedAt;
      if (patch.lastContactedBy !== undefined) updated.lastContactedBy = patch.lastContactedBy;
    }
    await this.put(updated);
    return updated;
  }

  async delete(contactId: string): Promise<void> {
    await ddb.send(new DeleteCommand({ TableName: table(), Key: { contactId } }));
  }

  async findByEmailInCompany(companyId: string, email: string): Promise<ContactPerson | null> {
    const lower = email.trim().toLowerCase();
    if (!lower) return null;
    const people = await this.listByCompany(companyId);
    return people.find((p) => (p.email ?? "").toLowerCase() === lower) ?? null;
  }
}
