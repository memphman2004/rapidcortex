/**
 * cad-share-router.ts
 * Phase 2 — DynamoDB Stream processor.
 *
 * Triggered on every INSERT or MODIFY to the NormalizedIncidents table.
 * For each incident event:
 *   1. Loads all active trust relationships for the source agency
 *   2. Evaluates each partner's sharing policy
 *   3. Applies field-level scrubbing and PII removal
 *   4. Enqueues a scoped payload to each eligible partner's SQS delivery queue
 *   5. Writes an audit entry for every routing decision
 *
 * This Lambda must be idempotent — DynamoDB Streams can replay events.
 * Deduplication is handled via SQS MessageDeduplicationId (FIFO queue).
 */

import type { DynamoDBStreamHandler, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { AttributeValue } from '@aws-sdk/client-dynamodb';
import { incidentWithinMiles } from './geo';
import {
  TrustRepo,
  PolicyRepo,
  AuditRepo,
  AuditKeys,
  enqueueSharedIncident,
  generateShareId,
  sharedIncidentTTL,
  SharedIncidentKeys,
} from './tables';
import type {
  CadMeshTranscriptSegment,
  NormalizedCADIncident,
  AgencySharingPolicy,
  ShareFieldPolicy,
  SharedIncident,
} from 'rapid-cortex-shared';
import { scrubPIIAsync } from './pii-scrubber';

// ── Stream Handler ───────────────────────────────────────────────────────────

export const handler: DynamoDBStreamHandler = async (event) => {
  const results = await Promise.allSettled(
    event.Records.map(processRecord)
  );

  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    console.error(`[CAD-ROUTER] ${failures.length}/${results.length} records failed`);
    failures.forEach(f => console.error('[CAD-ROUTER] failure:', (f as PromiseRejectedResult).reason));
    // Re-throw so Lambda retries — DynamoDB Streams guarantee at-least-once
    throw new Error(`${failures.length} record(s) failed processing`);
  }
};

// ── Per-Record Processing ────────────────────────────────────────────────────

async function processRecord(record: DynamoDBRecord): Promise<void> {
  if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY') return;
  if (!record.dynamodb?.NewImage) return;

  const incident = unmarshall(
    record.dynamodb.NewImage as Record<string, AttributeValue>
  ) as NormalizedCADIncident;

  if (!incident?.sourceAgencyId || !incident.incidentId) return;

  // Skip closed incidents — don't share status updates after closure
  if (incident.status === 'closed') return;

  const agencyId = incident.sourceAgencyId;

  // Load all active trust relationships for the source agency
  const relationships = await TrustRepo.listByAgency(agencyId);
  const activePartners = relationships.filter(r => r.status === 'active');

  if (activePartners.length === 0) return;

  // Load all sharing policies in one batch
  const policies = await PolicyRepo.listByAgency(agencyId);
  const policyMap = new Map(policies.map(p => [p.partnerAgencyId, p]));

  // Route to each eligible partner
  const routed = await Promise.allSettled(
    activePartners.map(async (partner) => {
      const policy = policyMap.get(partner.partnerAgencyId);
      if (!policy) return;

      const decision = evaluatePolicy(incident, policy);
      if (!decision.shouldShare) {
        console.log(`[CAD-ROUTER] Skipping ${agencyId}→${partner.partnerAgencyId}: ${decision.reason}`);
        return;
      }

      const shareId = generateShareId();
      const now = new Date().toISOString();

      const scrubbedIncident = await applyFieldPolicy(incident, policy, shareId, now);

      // Enqueue to partner's FIFO delivery queue (Phase 2 durable delivery)
      await enqueueSharedIncident(partner.partnerAgencyId, scrubbedIncident);

      // Immutable audit entry
      await AuditRepo.write({
        pk: AuditKeys.pk(agencyId),
        sk: AuditKeys.sk(now, shareId),
        shareId,
        direction: 'outbound',
        sourceAgencyId: agencyId,
        receiverAgencyId: partner.partnerAgencyId,
        incidentId: incident.incidentId,
        policySnapshot: {
          sharingMode: policy.sharingMode,
          shareFields: policy.shareFields,
          shareIncidentTypes: policy.shareIncidentTypes,
        },
        fieldsShared: decision.fieldsIncluded,
        deliveryStatus: 'pending',
        triggeredBy: 'automatic',
        timestamp: now,
      });

      console.log(`[CAD-ROUTER] Queued share ${shareId}: ${agencyId}→${partner.partnerAgencyId} incident ${incident.incidentId}`);
    })
  );
  const failed = routed.filter((result) => result.status === 'rejected');
  if (failed.length > 0) {
    throw new Error(`${failed.length} partner route(s) failed for ${incident.incidentId}`);
  }
}

// ── Policy Evaluator ─────────────────────────────────────────────────────────

interface PolicyDecision {
  shouldShare: boolean;
  reason?: string;
  fieldsIncluded: (keyof ShareFieldPolicy)[];
}

function evaluatePolicy(
  incident: NormalizedCADIncident,
  policy: AgencySharingPolicy,
): PolicyDecision {
  const noop: PolicyDecision = { shouldShare: false, reason: '', fieldsIncluded: [] };

  if (!policy.enabled) return { ...noop, reason: 'policy disabled' };
  if (policy.sharingMode === 'manual') return { ...noop, reason: 'manual mode — dispatcher must share' };

  // Incident type filter
  const types = policy.shareIncidentTypes;
  if (!types.includes('*' as any) && !types.includes(incident.incidentType)) {
    return { ...noop, reason: `incident type ${incident.incidentType} not in policy` };
  }

  // Priority threshold (share P1 through P[threshold])
  if (incident.priority > policy.sharePriorityThreshold) {
    return { ...noop, reason: `priority ${incident.priority} below threshold ${policy.sharePriorityThreshold}` };
  }

  if (policy.geoBoundaryMiles) {
    const withinBounds = incidentWithinMiles(
      incident.location?.lat,
      incident.location?.lon,
      policy.geoBoundaryMiles,
      policy.hqLat,
      policy.hqLon,
    );
    if (!withinBounds) return { ...noop, reason: 'incident outside geo boundary' };
  }

  // Determine which fields will be included
  const fieldsIncluded = (Object.keys(policy.shareFields) as (keyof ShareFieldPolicy)[])
    .filter(f => policy.shareFields[f]);

  return { shouldShare: true, fieldsIncluded };
}

// ── Field Policy Applier ─────────────────────────────────────────────────────

async function applyFieldPolicy(
  incident: NormalizedCADIncident,
  policy: AgencySharingPolicy,
  shareId: string,
  sharedAt: string,
): Promise<SharedIncident> {
  const fields = policy.shareFields;
  const narrative = fields.narrative && incident.narrative
    ? await scrubPIIAsync(incident.narrative)
    : undefined;
  const aiSummary = fields.aiSummary && incident.aiSummary
    ? await scrubPIIAsync(incident.aiSummary)
    : undefined;
  const transcript = fields.transcript && incident.transcript
    ? await Promise.all(incident.transcript.map(async (seg: CadMeshTranscriptSegment) => ({
      ...seg,
      text: await scrubPIIAsync(seg.text),
      translatedText: seg.translatedText ? await scrubPIIAsync(seg.translatedText) : undefined,
    })))
    : undefined;

  return {
    pk: SharedIncidentKeys.pk(policy.partnerAgencyId),
    sk: SharedIncidentKeys.sk(incident.sourceAgencyId, incident.incidentId, sharedAt),
    shareId,
    receiverAgencyId: policy.partnerAgencyId,
    sourceAgencyId: incident.sourceAgencyId,
    sourceAgencyName: incident.sourceAgencyName,
    incidentId: incident.incidentId,
    sourceCADIncidentId: incident.sourceCADIncidentId,
    incidentType: incident.incidentType,
    priority: incident.priority,
    status: incident.status,

    // Conditionally include fields per policy
    ...(fields.location    && { location: incident.location }),
    ...(fields.unitStatus  && { units: incident.units }),
    ...(narrative && { narrative }),
    ...(aiSummary && { aiSummary }),
    ...(transcript && { transcript }),
    ...(fields.confidenceScore && incident.confidenceScore !== undefined && {
      confidenceScore: incident.confidenceScore,
    }),
    ...(fields.extractedEntities && incident.extractedEntities && {
      extractedEntities: incident.extractedEntities,
    }),

    sharingPolicyId: policy.pk,
    fieldsIncluded: (Object.keys(fields) as (keyof ShareFieldPolicy)[]).filter(f => fields[f]),

    sharedAt,
    deliveryAttempts: 0,

    // Write-back defaults (Phase 3)
    writebackEnabled: policy.writebackEnabled,
    writebackMode: policy.writebackMode,
    writebackStatus: policy.writebackEnabled
      ? (policy.writebackMode === 'assisted' ? 'pending' : undefined)
      : undefined,

    ttl: sharedIncidentTTL(72),
  };
}

// ── Geo Boundary Check ───────────────────────────────────────────────────────

export { incidentWithinMiles } from './geo';
