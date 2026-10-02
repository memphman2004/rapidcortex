import { randomUUID } from "node:crypto";
import {
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  ApplicationActivity,
  ApplicationNote,
  ApplicationStatus,
  JobApplication,
  UpdateApplicationBody,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export type ApplicationMetrics = {
  total: number;
  new: number;
  inProgress: number;
  hired: number;
  rejected: number;
};

function tableName(): string {
  const t = env.jobApplicationsTable;
  if (!t) throw new Error("JOB_APPLICATIONS_TABLE is not configured");
  return t;
}

export class JobApplicationRepository {
  async put(item: JobApplication): Promise<JobApplication> {
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: item,
        ConditionExpression: "attribute_not_exists(applicationId)",
      }),
    );
    return item;
  }

  async get(applicationId: string): Promise<JobApplication | null> {
    const { Item } = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: { applicationId },
      }),
    );
    return (Item as JobApplication | undefined) ?? null;
  }

  async list(limit = 500): Promise<JobApplication[]> {
    const items: JobApplication[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const page = await ddb.send(
        new ScanCommand({
          TableName: tableName(),
          ExclusiveStartKey,
          Limit: Math.min(100, limit - items.length),
        }),
      );
      for (const raw of page.Items ?? []) {
        items.push(raw as JobApplication);
        if (items.length >= limit) break;
      }
      ExclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey && items.length < limit);

    items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return items;
  }

  buildMetrics(applications: JobApplication[]): ApplicationMetrics {
    const inProgressStatuses = new Set<ApplicationStatus>([
      "REVIEWING",
      "PHONE_SCREEN",
      "INTERVIEW",
      "OFFER",
    ]);
    return {
      total: applications.length,
      new: applications.filter((a) => a.status === "NEW").length,
      inProgress: applications.filter((a) => inProgressStatuses.has(a.status)).length,
      hired: applications.filter((a) => a.status === "HIRED").length,
      rejected: applications.filter((a) => a.status === "REJECTED").length,
    };
  }

  async addNote(
    applicationId: string,
    note: ApplicationNote,
    activity: ApplicationActivity,
  ): Promise<JobApplication | null> {
    const now = new Date().toISOString();
    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { applicationId },
        UpdateExpression:
          "SET #notes = list_append(if_not_exists(#notes, :empty), :note), #acts = list_append(if_not_exists(#acts, :empty), :act), updatedAt = :now",
        ExpressionAttributeNames: { "#notes": "notes", "#acts": "activities" },
        ExpressionAttributeValues: {
          ":note": [note],
          ":act": [activity],
          ":empty": [],
          ":now": now,
        },
        ConditionExpression: "attribute_exists(applicationId)",
        ReturnValues: "ALL_NEW",
      }),
    );
    return (Attributes as JobApplication | undefined) ?? null;
  }

  async update(
    applicationId: string,
    patch: UpdateApplicationBody,
    opts: {
      authorName: string;
      authorId: string;
      emailWillSend: boolean;
    },
  ): Promise<JobApplication | null> {
    const now = new Date().toISOString();
    const sets: string[] = ["updatedAt = :now"];
    const names: Record<string, string> = {};
    const vals: Record<string, unknown> = { ":now": now };

    if (patch.status) {
      sets.push("#status = :status");
      names["#status"] = "status";
      vals[":status"] = patch.status;

      const act: ApplicationActivity = {
        activityId: randomUUID(),
        type: "status_change",
        description: `Moved to ${patch.status}${patch.statusNote ? ` — ${patch.statusNote}` : ""}`,
        authorName: opts.authorName,
        createdAt: now,
        metadata: {
          newStatus: patch.status,
          ...(patch.statusNote ? { note: patch.statusNote } : {}),
          ...(patch.schedulingLink ? { schedulingLink: patch.schedulingLink } : {}),
          ...(opts.emailWillSend ? { emailQueued: "true" } : {}),
        },
      };
      sets.push("#acts = list_append(if_not_exists(#acts, :empty), :act)");
      names["#acts"] = "activities";
      vals[":act"] = [act];
      vals[":empty"] = [];

      if (opts.emailWillSend) {
        sets.push("lastEmailStatus = :emailStatus", "lastEmailSentAt = :emailAt");
        vals[":emailStatus"] = patch.status;
        vals[":emailAt"] = now;
      }
    }

    if (patch.rating != null) {
      sets.push("rating = :rating");
      vals[":rating"] = patch.rating;
      if (!patch.status) {
        const act: ApplicationActivity = {
          activityId: randomUUID(),
          type: "rating_set",
          description: `Rating set to ${patch.rating}`,
          authorName: opts.authorName,
          createdAt: now,
        };
        sets.push("#acts = list_append(if_not_exists(#acts, :empty), :act)");
        names["#acts"] = "activities";
        vals[":act"] = [act];
        vals[":empty"] = [];
      }
    }

    if (patch.assignedTo) {
      sets.push("assignedTo = :assignedTo");
      vals[":assignedTo"] = patch.assignedTo;
    }
    if (patch.assignedToName) {
      sets.push("assignedToName = :aName");
      vals[":aName"] = patch.assignedToName;
    }

    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { applicationId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
        ExpressionAttributeValues: vals,
        ConditionExpression: "attribute_exists(applicationId)",
        ReturnValues: "ALL_NEW",
      }),
    );
    return (Attributes as JobApplication | undefined) ?? null;
  }

  async appendResumeViewed(
    applicationId: string,
    authorName: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const act: ApplicationActivity = {
      activityId: randomUUID(),
      type: "resume_viewed",
      description: `Resume downloaded by ${authorName}`,
      authorName,
      createdAt: now,
    };
    await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { applicationId },
        UpdateExpression:
          "SET #acts = list_append(if_not_exists(#acts, :empty), :act), updatedAt = :now",
        ExpressionAttributeNames: { "#acts": "activities" },
        ExpressionAttributeValues: { ":act": [act], ":empty": [], ":now": now },
        ConditionExpression: "attribute_exists(applicationId)",
      }),
    );
  }
}
