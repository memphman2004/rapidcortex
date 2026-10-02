/**
 * cad-mesh-tables.ts
 * DynamoDB table definitions, SQS queue helpers, and shared
 * infrastructure utilities for the NexCortiQ CAD mesh.
 *
 * All table names are resolved from environment variables so
 * dev / staging / prod resolve without code changes.
 */

import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  SQSClient,
  SendMessageCommand,
  GetQueueUrlCommand,
  CreateQueueCommand,
  GetQueueAttributesCommand,
  QueueDoesNotExist,
} from '@aws-sdk/client-sqs';
import {
  CreateEventSourceMappingCommand,
  ListEventSourceMappingsCommand,
  ResourceConflictException,
  LambdaClient,
} from '@aws-sdk/client-lambda';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { randomUUID } from 'crypto';
import type {
  AgencyTrustRelationship,
  AgencySharingPolicy,
  SharedIncident,
  CADShareAuditEntry,
  TrustStatus,
} from 'rapid-cortex-shared';

// ── Clients ──────────────────────────────────────────────────────────────────

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
export const ddb = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

export const sqs = new SQSClient({ region: process.env.AWS_REGION });
const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION });

// ── Table name resolution ────────────────────────────────────────────────────

export const Tables = {
  trust:          process.env.CAD_MESH_TRUST_TABLE!,
  policies:       process.env.CAD_MESH_POLICY_TABLE!,
  sharedIncidents:process.env.CAD_MESH_SHARED_INCIDENTS_TABLE!,
  audit:          process.env.CAD_MESH_AUDIT_TABLE!,
} as const;

export const Queues = {
  deliveryPrefix: process.env.CAD_MESH_DELIVERY_QUEUE_PREFIX ?? 'rapid-cortex-cad-mesh-delivery-',
  dlqPrefix:      process.env.CAD_MESH_DLQ_PREFIX ?? 'rapid-cortex-cad-mesh-dlq-',
} as const;

export const EventBus = {
  name: process.env.CAD_MESH_EVENT_BUS ?? '',
  source: 'rapid-cortex.cad-mesh',
} as const;

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });

// ── Key helpers ──────────────────────────────────────────────────────────────

export const TrustKeys = {
  pk: (agencyId: string) => `AGENCY#${agencyId}`,
  sk: (partnerAgencyId: string) => `TRUST#${partnerAgencyId}`,
  gsi1pk: (status: TrustStatus) => `STATUS#${status}`,
  gsi1sk: (updatedAt: string) => `UPDATED#${updatedAt}`,
};

export const PolicyKeys = {
  pk: (agencyId: string) => `POLICY#${agencyId}`,
  sk: (partnerAgencyId: string) => `PARTNER#${partnerAgencyId}`,
};

export const SharedIncidentKeys = {
  pk: (receiverAgencyId: string) => `RECEIVER#${receiverAgencyId}`,
  sk: (sourceAgencyId: string, incidentId: string, timestamp: string) =>
    `SHARED#${sourceAgencyId}#INCIDENT#${incidentId}#${timestamp}`,
};

export const AuditKeys = {
  pk: (agencyId: string) => `AGENCY#${agencyId}`,
  sk: (timestamp: string, shareId: string) => `AUDIT#${timestamp}#${shareId}`,
};

// ── Trust Repository ─────────────────────────────────────────────────────────

export const TrustRepo = {

  async get(agencyId: string, partnerAgencyId: string): Promise<AgencyTrustRelationship | null> {
    const res = await ddb.send(new GetCommand({
      TableName: Tables.trust,
      Key: {
        pk: TrustKeys.pk(agencyId),
        sk: TrustKeys.sk(partnerAgencyId),
      },
    }));
    return (res.Item as AgencyTrustRelationship) ?? null;
  },

  async listByAgency(agencyId: string): Promise<AgencyTrustRelationship[]> {
    const res = await ddb.send(new QueryCommand({
      TableName: Tables.trust,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': TrustKeys.pk(agencyId),
        ':prefix': 'TRUST#',
      },
    }));
    return (res.Items ?? []) as AgencyTrustRelationship[];
  },

  /**
   * Creates the bilateral trust record atomically.
   * Both sides are written or neither is.
   */
  async createBilateral(
    trust: Omit<AgencyTrustRelationship, 'pk' | 'sk' | 'gsi1pk' | 'gsi1sk'>,
  ): Promise<void> {
    const now = new Date().toISOString();
    const baseItem = { ...trust, createdAt: now, updatedAt: now };

    const sideA: AgencyTrustRelationship = {
      ...baseItem,
      agencyId: trust.agencyId,
      agencyName: trust.agencyName,
      partnerAgencyId: trust.partnerAgencyId,
      partnerAgencyName: trust.partnerAgencyName,
      status: 'pending_initiator',
      pk: TrustKeys.pk(trust.agencyId),
      sk: TrustKeys.sk(trust.partnerAgencyId),
      gsi1pk: TrustKeys.gsi1pk('pending_initiator'),
      gsi1sk: TrustKeys.gsi1sk(now),
    };

    const sideB: AgencyTrustRelationship = {
      ...baseItem,
      agencyId: trust.partnerAgencyId,
      agencyName: trust.partnerAgencyName,
      partnerAgencyId: trust.agencyId,
      partnerAgencyName: trust.agencyName,
      status: 'pending_acceptor',
      pk: TrustKeys.pk(trust.partnerAgencyId),
      sk: TrustKeys.sk(trust.agencyId),
      gsi1pk: TrustKeys.gsi1pk('pending_acceptor'),
      gsi1sk: TrustKeys.gsi1sk(now),
    };

    await ddb.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: Tables.trust,
            Item: sideA,
            ConditionExpression: 'attribute_not_exists(pk) OR #status = :revoked',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':revoked': 'revoked' },
          },
        },
        {
          Put: {
            TableName: Tables.trust,
            Item: sideB,
            ConditionExpression: 'attribute_not_exists(pk) OR #status = :revoked',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':revoked': 'revoked' },
          },
        },
      ],
    }));
  },

  async updateStatusBilateral(
    agencyId: string,
    partnerAgencyId: string,
    status: TrustStatus,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const now = new Date().toISOString();
    const update = {
      UpdateExpression: 'SET #status = :status, updatedAt = :now, gsi1pk = :gsi1pk, gsi1sk = :gsi1sk' +
        (Object.keys(extra).length ? ', ' + Object.keys(extra).map((k, i) => `#e${i} = :e${i}`).join(', ') : ''),
      ExpressionAttributeNames: {
        '#status': 'status',
        ...Object.fromEntries(Object.keys(extra).map((k, i) => [`#e${i}`, k])),
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':now': now,
        ':gsi1pk': TrustKeys.gsi1pk(status),
        ':gsi1sk': TrustKeys.gsi1sk(now),
        ...Object.fromEntries(Object.values(extra).map((v, i) => [`:e${i}`, v])),
      },
    };

    const withCondition = {
      ...update,
      ConditionExpression: 'attribute_exists(pk)',
    };

    await ddb.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: Tables.trust,
            Key: { pk: TrustKeys.pk(agencyId), sk: TrustKeys.sk(partnerAgencyId) },
            ...withCondition,
          },
        },
        {
          Update: {
            TableName: Tables.trust,
            Key: { pk: TrustKeys.pk(partnerAgencyId), sk: TrustKeys.sk(agencyId) },
            ...withCondition,
          },
        },
      ],
    }));
  },
};

// ── Policy Repository ────────────────────────────────────────────────────────

export const PolicyRepo = {

  async get(agencyId: string, partnerAgencyId: string): Promise<AgencySharingPolicy | null> {
    const res = await ddb.send(new GetCommand({
      TableName: Tables.policies,
      Key: {
        pk: PolicyKeys.pk(agencyId),
        sk: PolicyKeys.sk(partnerAgencyId),
      },
    }));
    return (res.Item as AgencySharingPolicy) ?? null;
  },

  async listByAgency(agencyId: string): Promise<AgencySharingPolicy[]> {
    const res = await ddb.send(new QueryCommand({
      TableName: Tables.policies,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': PolicyKeys.pk(agencyId),
        ':prefix': 'PARTNER#',
      },
    }));
    return (res.Items ?? []) as AgencySharingPolicy[];
  },

  async upsert(policy: AgencySharingPolicy): Promise<void> {
    await ddb.send(new PutCommand({
      TableName: Tables.policies,
      Item: policy,
    }));
  },

  /** Default policy created when a trust relationship goes active */
  defaultPolicy(agencyId: string, partnerAgencyId: string, userId: string): AgencySharingPolicy {
    const now = new Date().toISOString();
    return {
      pk: PolicyKeys.pk(agencyId),
      sk: PolicyKeys.sk(partnerAgencyId),
      agencyId,
      partnerAgencyId,
      enabled: true,
      sharingMode: 'automatic',
      shareIncidentTypes: ['*'],
      sharePriorityThreshold: 3,   // Share P1, P2, P3 by default
      shareFields: {
        location: true,
        incidentType: true,
        priority: true,
        unitStatus: true,
        narrative: false,          // Narrative off by default — agency explicitly enables
        aiSummary: true,
        transcript: false,         // Transcript off by default
        confidenceScore: true,
        extractedEntities: false,
      },
      writebackEnabled: false,     // Write-back off by default (Phase 3)
      writebackMode: 'assisted',   // Requires dispatcher approval when enabled
      writebackFields: {
        incidentType: true,
        priority: true,
        location: true,
        narrative: false,
        unitStatus: true,
      },
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    };
  },
};

// ── Shared Incident Repository ───────────────────────────────────────────────

export const SharedIncidentRepo = {

  async put(incident: SharedIncident): Promise<void> {
    await ddb.send(new PutCommand({
      TableName: Tables.sharedIncidents,
      Item: incident,
    }));
  },

  async list(receiverAgencyId: string, limit = 50): Promise<SharedIncident[]> {
    const res = await ddb.send(new QueryCommand({
      TableName: Tables.sharedIncidents,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': SharedIncidentKeys.pk(receiverAgencyId),
        ':prefix': 'SHARED#',
      },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return (res.Items ?? []) as SharedIncident[];
  },

  async getByShareId(receiverAgencyId: string, shareId: string): Promise<SharedIncident | null> {
    const res = await ddb.send(new QueryCommand({
      TableName: Tables.sharedIncidents,
      IndexName: 'by-share-id',
      KeyConditionExpression: 'shareId = :shareId AND receiverAgencyId = :agencyId',
      ExpressionAttributeValues: {
        ':shareId': shareId,
        ':agencyId': receiverAgencyId,
      },
      Limit: 1,
    }));
    return (res.Items?.[0] as SharedIncident | undefined) ?? null;
  },

  async updateWritebackStatus(
    receiverAgencyId: string,
    sk: string,
    status: SharedIncident['writebackStatus'],
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const now = new Date().toISOString();
    await ddb.send(new UpdateCommand({
      TableName: Tables.sharedIncidents,
      Key: {
        pk: SharedIncidentKeys.pk(receiverAgencyId),
        sk,
      },
      UpdateExpression: 'SET writebackStatus = :status, writebackAt = :now' +
        (Object.keys(extra).length ? ', ' + Object.keys(extra).map((k, i) => `#f${i} = :f${i}`).join(', ') : ''),
      ExpressionAttributeNames: Object.keys(extra).length
        ? Object.fromEntries(Object.keys(extra).map((k, i) => [`#f${i}`, k]))
        : undefined,
      ExpressionAttributeValues: {
        ':status': status,
        ':now': now,
        ...Object.fromEntries(Object.values(extra).map((v, i) => [`:f${i}`, v])),
      },
    }));
  },
};

// ── Audit Repository ─────────────────────────────────────────────────────────

export const AuditRepo = {
  async write(entry: CADShareAuditEntry): Promise<void> {
    await ddb.send(new PutCommand({
      TableName: Tables.audit,
      Item: entry,
    }));
  },

  async list(agencyId: string, limit = 100): Promise<CADShareAuditEntry[]> {
    const res = await ddb.send(new QueryCommand({
      TableName: Tables.audit,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': AuditKeys.pk(agencyId),
        ':prefix': 'AUDIT#',
      },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return (res.Items ?? []) as CADShareAuditEntry[];
  },
};

// ── SQS helpers ──────────────────────────────────────────────────────────────

function queueSafeAgencyId(agencyId: string): string {
  const safe = agencyId.replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 40);
  if (!safe || safe === '-') throw new Error('invalid agencyId for delivery queue');
  return safe;
}

export function deliveryQueueName(agencyId: string): string {
  return `${Queues.deliveryPrefix}${queueSafeAgencyId(agencyId)}.fifo`;
}

export function deliveryDlqName(agencyId: string): string {
  return `${Queues.dlqPrefix}${queueSafeAgencyId(agencyId)}.fifo`;
}

async function existingQueueUrl(queueName: string): Promise<string | null> {
  try {
    const res = await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }));
    return res.QueueUrl ?? null;
  } catch (e) {
    if (e instanceof QueueDoesNotExist || (e as { name?: string }).name === 'QueueDoesNotExist') {
      return null;
    }
    throw e;
  }
}

async function queueArn(queueUrl: string): Promise<string> {
  const res = await sqs.send(new GetQueueAttributesCommand({
    QueueUrl: queueUrl,
    AttributeNames: ['QueueArn'],
  }));
  const arn = res.Attributes?.QueueArn;
  if (!arn) throw new Error(`Queue ARN missing for ${queueUrl}`);
  return arn;
}

/**
 * Creates the agency FIFO delivery queue and DLQ (5 receives, then DLQ)
 * and attaches the delivery worker if CAD_MESH_DELIVERY_FUNCTION_NAME is set.
 * Safe to call on every invite and on agency activation.
 */
export async function ensureDeliveryQueue(agencyId: string): Promise<string> {
  const dlq = deliveryDlqName(agencyId);
  let dlqUrl = await existingQueueUrl(dlq);
  if (!dlqUrl) {
    const created = await sqs.send(new CreateQueueCommand({
      QueueName: dlq,
      Attributes: { FifoQueue: 'true' },
      tags: { component: 'cad-mesh', agencyId },
    }));
    if (!created.QueueUrl) throw new Error(`Failed to create DLQ ${dlq}`);
    dlqUrl = created.QueueUrl;
  }

  const name = deliveryQueueName(agencyId);
  let queueUrl = await existingQueueUrl(name);
  if (!queueUrl) {
    const created = await sqs.send(new CreateQueueCommand({
      QueueName: name,
      Attributes: {
        FifoQueue: 'true',
        ContentBasedDeduplication: 'false',
        VisibilityTimeout: '180',
        RedrivePolicy: JSON.stringify({
          deadLetterTargetArn: await queueArn(dlqUrl),
          maxReceiveCount: '5',
        }),
      },
      tags: { component: 'cad-mesh', agencyId },
    }));
    if (!created.QueueUrl) throw new Error(`Failed to create delivery queue ${name}`);
    queueUrl = created.QueueUrl;
  }

  const functionName = process.env.CAD_MESH_DELIVERY_FUNCTION_NAME?.trim();
  if (functionName) {
    const sourceArn = await queueArn(queueUrl);
    const existing = await lambdaClient.send(new ListEventSourceMappingsCommand({
      FunctionName: functionName,
      EventSourceArn: sourceArn,
    }));
    const alreadyMapped = (existing.EventSourceMappings ?? []).some(
      (mapping) => mapping.State !== 'Deleting',
    );
    if (!alreadyMapped) {
      try {
        await lambdaClient.send(new CreateEventSourceMappingCommand({
          FunctionName: functionName,
          EventSourceArn: sourceArn,
          BatchSize: 5,
          FunctionResponseTypes: ['ReportBatchItemFailures'],
        }));
      } catch (e) {
        if (!(e instanceof ResourceConflictException) && (e as { name?: string }).name !== 'ResourceConflictException') {
          throw e;
        }
      }
    }
  }

  return queueUrl;
}

export async function getDeliveryQueueUrl(agencyId: string): Promise<string> {
  const existing = await existingQueueUrl(deliveryQueueName(agencyId));
  if (existing) return existing;
  return ensureDeliveryQueue(agencyId);
}

export async function enqueueSharedIncident(
  agencyId: string,
  payload: SharedIncident,
): Promise<void> {
  const queueUrl = await getDeliveryQueueUrl(agencyId);
  await sqs.send(new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(payload),
    MessageGroupId: queueSafeAgencyId(agencyId),
    MessageDeduplicationId: payload.shareId,
    MessageAttributes: {
      sourceAgencyId: { DataType: 'String', StringValue: payload.sourceAgencyId },
      priority: { DataType: 'Number', StringValue: String(payload.priority) },
    },
  }));
}

// ── EventBridge helpers ──────────────────────────────────────────────────────

export async function emitShareEvent(
  detail: Record<string, unknown>,
  detailType: string,
): Promise<void> {
  if (!EventBus.name) return;
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      EventBusName: EventBus.name,
      Source: EventBus.source,
      DetailType: detailType,
      Detail: JSON.stringify(detail),
      Time: new Date(),
    }],
  }));
}

// ── Shared utility ───────────────────────────────────────────────────────────

export function generateShareId(): string {
  return randomUUID();
}

export function sharedIncidentTTL(hoursFromNow = 72): number {
  return Math.floor(Date.now() / 1000) + hoursFromNow * 3600;
}
