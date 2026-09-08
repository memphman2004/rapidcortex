import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  AlertChannel,
  AlertDispatchJob,
  AlertOrganization,
  AlertRecipient,
  AlertRecipientGroup,
  AlertTemplate,
  AlertVertical,
} from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";
import { env } from "../lib/env.js";

function table(): string {
  const t = env.verticalAlertsTable;
  if (!t) throw new Error("VERTICAL_ALERTS_TABLE is not configured");
  return t;
}

export const ALERT_SK = {
  org: (organizationId: string) => `ORG#${organizationId}`,
  group: (groupId: string) => `GROUP#${groupId}`,
  template: (templateId: string) => `TPL#${templateId}`,
  recipient: (recipientId: string) => `REC#${recipientId}`,
  job: (jobId: string) => `JOB#${jobId}`,
  dnc: (e164: string) => `DNC#${e164}`,
  importJob: (importJobId: string) => `IMPORT#${importJobId}`,
  delivery: (jobId: string, recipientId: string, channel: AlertChannel) =>
    `DELIVERY#${jobId}#${recipientId}#${channel}`,
  ack: (jobId: string, userId: string) => `ACK#${jobId}#${userId}`,
  dispatchHour: (organizationId: string, hourKey: string) => `RATE#${organizationId}#${hourKey}`,
  criticalLock: (organizationId: string) => `CRITLOCK#${organizationId}`,
};

type BaseItem = {
  agencyId: string;
  sk: string;
  organizationId: string;
  gsi1pk: string;
  gsi1sk: string;
};

function withKeys(agencyId: string, organizationId: string, sk: string, rest: Record<string, unknown>) {
  return {
    agencyId,
    sk,
    organizationId,
    gsi1pk: organizationId,
    gsi1sk: sk,
    ...rest,
  };
}

async function put(item: Record<string, unknown>): Promise<void> {
  await ddb.send(new PutCommand({ TableName: table(), Item: item }));
}

async function getItem<T>(agencyId: string, sk: string): Promise<T | null> {
  const out = await ddb.send(
    new GetCommand({ TableName: table(), Key: { agencyId, sk } }),
  );
  return (out.Item as T | undefined) ?? null;
}

async function queryPrefix<T>(agencyId: string, prefix: string): Promise<T[]> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: table(),
      KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
      ExpressionAttributeValues: { ":a": agencyId, ":p": prefix },
    }),
  );
  return (out.Items ?? []) as T[];
}

export const alertsStore = {
  async putOrganization(org: AlertOrganization): Promise<void> {
    await put(
      withKeys(org.agencyId, org.organizationId, ALERT_SK.org(org.organizationId), {
        entityType: "ORG",
        ...org,
      }),
    );
  },

  async getOrganization(agencyId: string, organizationId: string): Promise<AlertOrganization | null> {
    const item = await getItem<AlertOrganization & BaseItem>(agencyId, ALERT_SK.org(organizationId));
    return item;
  },

  async listOrganizations(agencyId: string): Promise<AlertOrganization[]> {
    return queryPrefix<AlertOrganization>(agencyId, "ORG#");
  },

  async putGroup(group: AlertRecipientGroup): Promise<void> {
    await put(
      withKeys(group.agencyId, group.organizationId, ALERT_SK.group(group.groupId), {
        entityType: "GROUP",
        ...group,
      }),
    );
  },

  async listGroups(agencyId: string): Promise<AlertRecipientGroup[]> {
    return queryPrefix<AlertRecipientGroup>(agencyId, "GROUP#");
  },

  async putTemplate(tpl: AlertTemplate): Promise<void> {
    await put(
      withKeys(tpl.agencyId, tpl.organizationId, ALERT_SK.template(tpl.templateId), {
        entityType: "TPL",
        ...tpl,
      }),
    );
  },

  async getTemplate(agencyId: string, templateId: string): Promise<AlertTemplate | null> {
    return getItem<AlertTemplate>(agencyId, ALERT_SK.template(templateId));
  },

  async listTemplates(agencyId: string): Promise<AlertTemplate[]> {
    return queryPrefix<AlertTemplate>(agencyId, "TPL#");
  },

  async putRecipient(rec: AlertRecipient): Promise<void> {
    await put(
      withKeys(rec.agencyId, rec.organizationId, ALERT_SK.recipient(rec.recipientId), {
        entityType: "REC",
        ...rec,
      }),
    );
  },

  async getRecipient(agencyId: string, recipientId: string): Promise<AlertRecipient | null> {
    return getItem<AlertRecipient>(agencyId, ALERT_SK.recipient(recipientId));
  },

  async listRecipients(agencyId: string): Promise<AlertRecipient[]> {
    return queryPrefix<AlertRecipient>(agencyId, "REC#");
  },

  async deleteRecipient(agencyId: string, recipientId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: table(),
        Key: { agencyId, sk: ALERT_SK.recipient(recipientId) },
        ConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
      }),
    );
  },

  async putJob(job: AlertDispatchJob): Promise<void> {
    await put(
      withKeys(job.agencyId, job.organizationId, ALERT_SK.job(job.jobId), {
        entityType: "JOB",
        ...job,
      }),
    );
  },

  async getJob(agencyId: string, jobId: string): Promise<AlertDispatchJob | null> {
    return getItem<AlertDispatchJob>(agencyId, ALERT_SK.job(jobId));
  },

  async listJobs(agencyId: string): Promise<AlertDispatchJob[]> {
    const jobs = await queryPrefix<AlertDispatchJob>(agencyId, "JOB#");
    return jobs.sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt));
  },

  async putDnc(agencyId: string, organizationId: string, e164: string): Promise<void> {
    await put(
      withKeys(agencyId, organizationId, ALERT_SK.dnc(e164), {
        entityType: "DNC",
        phoneE164: e164,
        createdAt: new Date().toISOString(),
      }),
    );
  },

  async isDnc(agencyId: string, e164: string): Promise<boolean> {
    const item = await getItem(agencyId, ALERT_SK.dnc(e164));
    return Boolean(item);
  },

  async deleteDnc(agencyId: string, e164: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: table(),
        Key: { agencyId, sk: ALERT_SK.dnc(e164) },
      }),
    );
  },

  async putDelivery(params: {
    agencyId: string;
    organizationId: string;
    jobId: string;
    recipientId: string;
    channel: AlertChannel;
    status: string;
    reason?: string;
  }): Promise<void> {
    await put(
      withKeys(
        params.agencyId,
        params.organizationId,
        ALERT_SK.delivery(params.jobId, params.recipientId, params.channel),
        {
          entityType: "DELIVERY",
          jobId: params.jobId,
          recipientId: params.recipientId,
          channel: params.channel,
          status: params.status,
          reason: params.reason,
          createdAt: new Date().toISOString(),
        },
      ),
    );
  },

  async listDeliveries(agencyId: string, jobId: string): Promise<Array<Record<string, unknown>>> {
    return queryPrefix(agencyId, `DELIVERY#${jobId}#`);
  },

  async listAcks(agencyId: string, jobId: string): Promise<Array<{ userId?: string; acknowledgedAt?: string }>> {
    return queryPrefix(agencyId, `ACK#${jobId}#`);
  },

  async putAck(params: {
    agencyId: string;
    organizationId: string;
    jobId: string;
    userId: string;
  }): Promise<void> {
    await put(
      withKeys(params.agencyId, params.organizationId, ALERT_SK.ack(params.jobId, params.userId), {
        entityType: "ACK",
        jobId: params.jobId,
        userId: params.userId,
        acknowledgedAt: new Date().toISOString(),
      }),
    );
  },

  async incrementHourlyDispatch(organizationId: string, agencyId: string): Promise<number> {
    const hourKey = new Date().toISOString().slice(0, 13);
    const sk = ALERT_SK.dispatchHour(organizationId, hourKey);
    const out = await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { agencyId, sk },
        UpdateExpression:
          "SET #c = if_not_exists(#c, :z) + :one, organizationId = if_not_exists(organizationId, :org), gsi1pk = if_not_exists(gsi1pk, :org), gsi1sk = if_not_exists(gsi1sk, :sk), entityType = if_not_exists(entityType, :t)",
        ExpressionAttributeNames: { "#c": "count" },
        ExpressionAttributeValues: {
          ":z": 0,
          ":one": 1,
          ":org": organizationId,
          ":sk": sk,
          ":t": "RATE",
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    return Number(out.Attributes?.count ?? 1);
  },

  async getCriticalLock(agencyId: string, organizationId: string): Promise<{ until: string } | null> {
    return getItem<{ until: string }>(agencyId, ALERT_SK.criticalLock(organizationId));
  },

  async putCriticalLock(agencyId: string, organizationId: string, untilIso: string): Promise<void> {
    await put(
      withKeys(agencyId, organizationId, ALERT_SK.criticalLock(organizationId), {
        entityType: "CRITLOCK",
        until: untilIso,
      }),
    );
  },

  async findRecipientByPhoneOrEmail(
    agencyId: string,
    phoneE164?: string,
    email?: string,
  ): Promise<AlertRecipient | null> {
    const all = await this.listRecipients(agencyId);
    if (phoneE164) {
      const hit = all.find((r) => r.phoneE164 === phoneE164);
      if (hit) return hit;
    }
    if (email) {
      const hit = all.find((r) => r.email === email);
      if (hit) return hit;
    }
    return null;
  },
};

export type { AlertVertical };
