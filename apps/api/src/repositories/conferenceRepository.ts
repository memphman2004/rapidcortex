import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  PLATFORM_CONFERENCE_AGENCY_ID,
  conferenceSchema,
  type Conference,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

function table(): string {
  const t = env.conferencesTable;
  if (!t) throw new Error("CONFERENCES_TABLE_NOT_CONFIGURED");
  return t;
}

function parseItem(item: unknown): Conference | null {
  const parsed = conferenceSchema.safeParse(item);
  return parsed.success ? parsed.data : null;
}

export class ConferenceRepository {
  async get(conferenceId: string): Promise<Conference | null> {
    const r = await ddb.send(new GetCommand({ TableName: table(), Key: { conferenceId } }));
    return r.Item ? parseItem(r.Item) : null;
  }

  async put(conf: Conference): Promise<void> {
    await ddb.send(new PutCommand({ TableName: table(), Item: conf }));
  }

  async listByAgency(agencyId = PLATFORM_CONFERENCE_AGENCY_ID): Promise<Conference[]> {
    const items: Conference[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await ddb.send(
        new QueryCommand({
          TableName: table(),
          IndexName: "agencyId-startDate-index",
          KeyConditionExpression: "agencyId = :a",
          ExpressionAttributeValues: { ":a": agencyId },
          ExclusiveStartKey,
        }),
      );
      for (const item of r.Items ?? []) {
        const parsed = parseItem(item);
        if (parsed) items.push(parsed);
      }
      ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);
    return items.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
  }
}
