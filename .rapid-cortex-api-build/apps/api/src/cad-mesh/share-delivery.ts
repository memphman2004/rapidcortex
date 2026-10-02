/**
 * cad-share-delivery.ts
 * Phase 2 — SQS consumer that delivers shared incidents to partner agency consoles.
 * Phase 3 — CAD write-back worker (triggered when writebackStatus = 'approved').
 *
 * Each agency has its own FIFO SQS queue. This Lambda is deployed once and
 * reads from all delivery queues via event source mapping with a queue ARN
 * pattern. Alternatively, deploy one per queue for strict isolation.
 *
 * On successful WebSocket push → marks audit as 'delivered'.
 * On write-back approval     → calls the receiving agency's CAD adapter.
 * On repeated failure        → SQS routes to the per-agency DLQ for manual review.
 */

import type { SQSHandler, SQSRecord } from 'aws-lambda';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { CadMeshVendor, SharedIncident } from 'rapid-cortex-shared';
import { env } from '../lib/env.js';
import { broadcastToAgency } from '../lib/websocket/send-message.js';
import { WebSocketConnectionRepository } from '../repositories/websocketConnectionRepository.js';
import {
  SharedIncidentRepo,
  AuditRepo,
  AuditKeys,
  PolicyRepo,
} from './tables';

const connections = new WebSocketConnectionRepository();
const secrets = new SecretsManagerClient({});

// ── SQS Handler ──────────────────────────────────────────────────────────────

export const handler: SQSHandler = async (event) => {
  const failures: { itemIdentifier: string }[] = [];

  await Promise.allSettled(
    event.Records.map(async (record) => {
      try {
        await processDelivery(record);
      } catch (e) {
        console.error(`[DELIVERY] Failed record ${record.messageId}:`, e);
        // Return to SQS for retry — item-level failure reporting
        failures.push({ itemIdentifier: record.messageId });
      }
    })
  );

  // Report partial batch failures so SQS only retries failed items
  if (failures.length > 0) {
    return { batchItemFailures: failures };
  }
};

// ── Per-Record Delivery ───────────────────────────────────────────────────────

async function processDelivery(record: SQSRecord): Promise<void> {
  const incident = JSON.parse(record.body) as SharedIncident;
  const { receiverAgencyId, shareId, incidentId, sourceAgencyId } = incident;

  // Persist to SharedIncidents table (idempotent — PK/SK includes shareId)
  await SharedIncidentRepo.put(incident);

  // Push via WebSocket to all connected dispatchers in the receiving agency
  const delivered = await pushToAgencyConsoles(receiverAgencyId, {
    type: 'SHARED_INCIDENT',
    payload: incident,
  });

  const now = new Date().toISOString();

  // Update audit entry delivery status
  await AuditRepo.write({
    pk: AuditKeys.pk(sourceAgencyId),
    sk: AuditKeys.sk(now, shareId),
    shareId,
    direction: 'outbound',
    sourceAgencyId,
    receiverAgencyId,
    incidentId,
    policySnapshot: {} as any,     // Already written by router
    fieldsShared: incident.fieldsIncluded,
    deliveryStatus: delivered > 0 ? 'delivered' : 'pending',
    triggeredBy: 'automatic',
    timestamp: now,
    durationMs: Date.now() - new Date(incident.sharedAt).getTime(),
  });

  console.log(`[DELIVERY] ${shareId}: pushed to ${delivered} console(s) in agency ${receiverAgencyId}`);

  if (incident.writebackEnabled && incident.writebackMode === 'automatic') {
    await performCADWriteback(incident);
  }
}

// ── WebSocket Push ───────────────────────────────────────────────────────────

/**
 * Loads all active WebSocket connection IDs for the receiving agency
 * and broadcasts the shared incident in parallel.
 * Stale connections (410 Gone) are cleaned up silently.
 */
async function pushToAgencyConsoles(
  agencyId: string,
  payload: { type: string; payload: SharedIncident },
): Promise<number> {
  let connected = 0;
  try {
    connected = (await connections.listByAgencyId(agencyId)).length;
  } catch (e) {
    console.warn('[DELIVERY] WebSocket connection lookup failed', e);
  }
  try {
    await broadcastToAgency({
      agencyId,
      message: { type: payload.type, data: { incident: payload.payload } },
    });
  } catch (e) {
    console.warn('[DELIVERY] WebSocket push failed', e);
  }
  return connected;
}

// ── Phase 3: CAD Write-back ──────────────────────────────────────────────────

/**
 * Writes the shared incident into the receiving agency's CAD system.
 * Called:
 *   - Immediately when writebackMode = 'automatic'
 *   - After dispatcher approval when writebackMode = 'assisted'
 *     (the cad-writeback-worker polls for 'approved' status)
 */
export async function performCADWriteback(incident: SharedIncident): Promise<void> {
  const { receiverAgencyId, shareId, incidentId } = incident;

  if (!env.cadWritebackEnabled) {
    await SharedIncidentRepo.updateWritebackStatus(receiverAgencyId, incident.sk, 'blocked');
    console.warn(`[WRITEBACK] Blocked ${shareId}: CAD_WRITEBACK_ENABLED is off`);
    return;
  }

  try {
    const credentials = await loadCadCredentials(receiverAgencyId);
    const policy = await PolicyRepo.get(receiverAgencyId, incident.sourceAgencyId);
    const fields = policy?.writebackFields;
    const adapter = getCADAdapter(credentials.vendor);

    const cadIncidentId = await adapter.createOrUpdateIncident({
      incidentType: incident.incidentType,
      priority: incident.priority,
      location: fields?.location === false ? undefined : incident.location,
      narrative: fields?.narrative ? incident.narrative : undefined,
      units: fields?.unitStatus === false ? undefined : incident.units,
      externalRef: `rapid-cortex:${incident.sourceAgencyId}:${incidentId}`,
    }, credentials);

    // Mark write-back complete
    await SharedIncidentRepo.updateWritebackStatus(
      receiverAgencyId,
      incident.sk,
      'written',
      { writebackCADId: cadIncidentId },
    );

    console.log(`[WRITEBACK] ${shareId} → CAD incident ${cadIncidentId} in agency ${receiverAgencyId}`);

  } catch (e) {
    console.error(`[WRITEBACK] Failed for ${shareId}:`, e);
    await SharedIncidentRepo.updateWritebackStatus(
      receiverAgencyId,
      incident.sk,
      'failed',
    );
    throw e; // Re-throw so SQS retries
  }
}

// ── CAD Adapter Factory ──────────────────────────────────────────────────────

type CadCredentials = {
  vendor: CadMeshVendor;
  endpoint: string;
  apiKey: string;
  fieldMap: Record<string, string>;
};

interface CADAdapter {
  createOrUpdateIncident(data: CADWritePayload, credentials: CadCredentials): Promise<string>;
}

interface CADWritePayload {
  incidentType: string;
  priority: number;
  location?: { address: string; lat: number; lon: number };
  narrative?: string;
  units?: unknown[];
  externalRef: string;
}

function getCADAdapter(vendor: CadMeshVendor): CADAdapter {
  switch (vendor) {
    case 'motorola':      return new MotorolaAdapter();
    case 'tyler':         return new TylerAdapter();
    case 'hexagon':       return new HexagonAdapter();
    case 'centralsquare': return new CentralSquareAdapter();
    case 'spillman':      return new SpillmanAdapter();
    case 'generic_rest':  return new GenericRESTAdapter();
    default:
      throw new Error(`CAD vendor ${vendor} has no write-back adapter`);
  }
}

function requireCadId(value: unknown, vendor: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${vendor} CAD response did not include an incident id`);
  }
  return value.trim();
}

function requireCredentials(credentials: CadCredentials, vendor: string): CadCredentials {
  if (!credentials.endpoint.trim() || !credentials.apiKey.trim()) {
    throw new Error(`${vendor} CAD credentials are not configured`);
  }
  return credentials;
}

/**
 * Motorola PremierOne — REST API via CommandCentral
 */
class MotorolaAdapter implements CADAdapter {
  async createOrUpdateIncident(data: CADWritePayload, credentials: CadCredentials): Promise<string> {
    const { endpoint, apiKey } = requireCredentials(credentials, 'Motorola');

    const res = await fetch(`${endpoint}/api/v1/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        incidentType: data.incidentType,
        priority: data.priority,
        address: data.location?.address,
        lat: data.location?.lat,
        lon: data.location?.lon,
        notes: data.narrative,
        externalReference: data.externalRef,
      }),
    });

    if (!res.ok) throw new Error(`Motorola CAD write failed: ${res.status}`);
    const body = await res.json() as { incidentId?: string };
    return requireCadId(body.incidentId, 'Motorola');
  }
}

/**
 * Tyler New World — SOAP/REST hybrid
 */
class TylerAdapter implements CADAdapter {
  async createOrUpdateIncident(data: CADWritePayload, credentials: CadCredentials): Promise<string> {
    const { endpoint, apiKey: token } = requireCredentials(credentials, 'Tyler');

    const res = await fetch(`${endpoint}/nwcad/api/incidents`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        CallType: data.incidentType,
        Priority: String(data.priority),
        Address: data.location?.address,
        Latitude: data.location?.lat,
        Longitude: data.location?.lon,
        AgencyComment: data.narrative,
        ExternalId: data.externalRef,
      }),
    });

    if (!res.ok) throw new Error(`Tyler CAD write failed: ${res.status}`);
    const body = await res.json() as { Id?: string };
    return requireCadId(body.Id, 'Tyler');
  }
}

/**
 * Hexagon Intergraph — CAD-to-CAD (C2C) standard
 */
class HexagonAdapter implements CADAdapter {
  async createOrUpdateIncident(data: CADWritePayload, credentials: CadCredentials): Promise<string> {
    const { endpoint, apiKey } = requireCredentials(credentials, 'Hexagon');

    const res = await fetch(`${endpoint}/c2c/incidents`, {
      method: 'POST',
      headers: { 'X-Auth-Token': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: data.incidentType,
        priority: data.priority,
        location: { address: data.location?.address, lat: data.location?.lat, lng: data.location?.lon },
        narrative: data.narrative,
        xref: data.externalRef,
      }),
    });

    if (!res.ok) throw new Error(`Hexagon CAD write failed: ${res.status}`);
    const body = await res.json() as { id?: string };
    return requireCadId(body.id, 'Hexagon');
  }
}

/**
 * CentralSquare — REST API
 */
class CentralSquareAdapter implements CADAdapter {
  async createOrUpdateIncident(data: CADWritePayload, credentials: CadCredentials): Promise<string> {
    const { endpoint, apiKey: token } = requireCredentials(credentials, 'CentralSquare');

    const res = await fetch(`${endpoint}/api/incidents`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incidentTypeCode: data.incidentType,
        priorityCode: data.priority,
        address: data.location?.address,
        latitude: data.location?.lat,
        longitude: data.location?.lon,
        remarks: data.narrative,
        referenceNumber: data.externalRef,
      }),
    });

    if (!res.ok) throw new Error(`CentralSquare CAD write failed: ${res.status}`);
    const body = await res.json() as { incidentNumber?: string };
    return requireCadId(body.incidentNumber, 'CentralSquare');
  }
}

/**
 * Spillman Technologies — REST
 */
class SpillmanAdapter implements CADAdapter {
  async createOrUpdateIncident(data: CADWritePayload, credentials: CadCredentials): Promise<string> {
    const { endpoint, apiKey } = requireCredentials(credentials, 'Spillman');

    const res = await fetch(`${endpoint}/spillman/api/v1/calls`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nature: data.incidentType,
        priority: data.priority,
        address: data.location?.address,
        lat: data.location?.lat,
        lon: data.location?.lon,
        comment: data.narrative,
        xref: data.externalRef,
      }),
    });

    if (!res.ok) throw new Error(`Spillman CAD write failed: ${res.status}`);
    const body = await res.json() as { callId?: string };
    return requireCadId(body.callId, 'Spillman');
  }
}

/**
 * Generic REST adapter for CAD systems without specific adapters.
 * Agency configures their endpoint and field mapping in the admin console.
 */
class GenericRESTAdapter implements CADAdapter {
  async createOrUpdateIncident(data: CADWritePayload, credentials: CadCredentials): Promise<string> {
    const { endpoint, apiKey, fieldMap } = requireCredentials(credentials, 'Generic');

    const payload: Record<string, unknown> = {};
    if (fieldMap.incidentType) payload[fieldMap.incidentType] = data.incidentType;
    if (fieldMap.priority)     payload[fieldMap.priority]     = data.priority;
    if (fieldMap.address)      payload[fieldMap.address]      = data.location?.address;
    if (fieldMap.narrative)    payload[fieldMap.narrative]    = data.narrative;
    payload[fieldMap.externalRef ?? 'externalRef'] = data.externalRef;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Generic CAD write failed: ${res.status}`);
    const body = await res.json() as Record<string, string>;
    return requireCadId(body.id ?? body.incidentId ?? body.incidentNumber, 'Generic');
  }
}

const credentialCache = new Map<string, CadCredentials>();

async function loadCadCredentials(agencyId: string): Promise<CadCredentials> {
  const cached = credentialCache.get(agencyId);
  if (cached) return cached;
  const secretId = `rapid-cortex/cad-mesh/${agencyId}/cad-credentials`;
  const out = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
  const raw = out.SecretString;
  if (!raw) throw new Error(`CAD credentials secret is empty for ${agencyId}`);
  const parsed = JSON.parse(raw) as Partial<CadCredentials>;
  const vendor = parsed.vendor;
  if (
    vendor !== 'motorola' && vendor !== 'tyler' && vendor !== 'hexagon' &&
    vendor !== 'centralsquare' && vendor !== 'spillman' && vendor !== 'generic_rest' &&
    vendor !== 'on_prem_agent'
  ) {
    throw new Error(`CAD credentials for ${agencyId} are missing a known vendor`);
  }
  const credentials: CadCredentials = {
    vendor,
    endpoint: parsed.endpoint?.trim() ?? '',
    apiKey: parsed.apiKey?.trim() ?? '',
    fieldMap: parsed.fieldMap ?? {},
  };
  credentialCache.set(agencyId, credentials);
  return credentials;
}
