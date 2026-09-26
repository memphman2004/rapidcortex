/**
 * cad-mesh-types.ts
 * Shared types for the NexCortiQ CAD-to-CAD intelligence mesh.
 * All four phases reference these definitions.
 */

// ── Primitives ──────────────────────────────────────────────────────────────

export type CadMeshVendor =
  | 'motorola'
  | 'tyler'
  | 'hexagon'
  | 'centralsquare'
  | 'spillman'
  | 'generic_rest'
  | 'on_prem_agent';

export type TrustStatus =
  | 'pending_initiator'   // Agency A sent invite, waiting for B
  | 'pending_acceptor'    // Agency B must accept + sign MOU
  | 'active'
  | 'suspended'           // Temporarily paused by either party
  | 'revoked';            // Permanent — requires new invite to restart

export type SharingMode =
  | 'automatic'           // All matching incidents shared immediately
  | 'manual'              // Dispatcher explicitly shares each incident
  | 'mutual_aid_only';    // Only when mutual aid is declared in CAD

export type IncidentType =
  | 'FIRE'
  | 'EMS'
  | 'LAW'
  | 'HAZMAT'
  | 'TRAFFIC'
  | 'MCI'
  | 'WELFARE'
  | 'OTHER';

export type Priority = 1 | 2 | 3 | 4 | 5;

export type WritebackMode =
  | 'assisted'    // Dispatcher reviews and approves before CAD write
  | 'automatic';  // Writes immediately on delivery

export type DeliveryStatus = 'delivered' | 'failed' | 'pending' | 'retrying';

export type WritebackStatus =
  | 'pending'     // Queued for dispatcher review (assisted mode)
  | 'approved'    // Dispatcher approved the write
  | 'written'     // Successfully written to partner CAD
  | 'rejected'    // Dispatcher rejected the write
  | 'failed'      // Write attempt failed
  | 'blocked';    // Platform CAD write-back flag is off

// ── Normalized CAD Incident ─────────────────────────────────────────────────

export interface NormalizedCADIncident {
  incidentId: string;
  sourceAgencyId: string;
  sourceAgencyName: string;
  sourceCADVendor: CadMeshVendor;
  sourceCADIncidentId: string;
  incidentType: IncidentType;
  priority: Priority;
  status: 'pending' | 'dispatched' | 'enroute' | 'onscene' | 'closed';
  location: IncidentLocation;
  units: NormalizedUnit[];

  // AI-enriched fields (added before sharing)
  narrative?: string;             // PII scrubbed before any share
  aiSummary?: string;             // HARMONY-generated summary
  transcript?: CadMeshTranscriptSegment[];
  confidenceScore?: number;       // 0–1 AI confidence in incident classification
  extractedEntities?: ExtractedEntities;

  createdAt: string;
  updatedAt: string;
}

export interface IncidentLocation {
  address: string;
  lat: number;
  lon: number;
  crossStreet?: string;
  geohash?: string;               // Used for geo-boundary filtering
  jurisdiction?: string;
}

export interface NormalizedUnit {
  unitId: string;
  unitType: 'engine' | 'medic' | 'patrol' | 'ladder' | 'command' | 'air' | 'other';
  status: 'dispatched' | 'enroute' | 'onscene' | 'available' | 'staged' | 'clearing';
  lat?: number;
  lon?: number;
  agencyId: string;
}

export interface CadMeshTranscriptSegment {
  speaker: 'DISPATCHER' | 'CALLER' | 'UNKNOWN';
  text: string;
  timestamp: string;
  confidence: number;
  language?: string;
  translatedText?: string;
}

export interface ExtractedEntities {
  subjects?: string[];
  vehicles?: string[];
  weapons?: string[];
  locations?: string[];
  medicalInfo?: string[];
}

// ── Trust Relationship ───────────────────────────────────────────────────────

export interface AgencyTrustRelationship {
  // DynamoDB keys
  pk: string;                     // AGENCY#{agencyId}
  sk: string;                     // TRUST#{partnerAgencyId}

  agencyId: string;
  agencyName: string;
  partnerAgencyId: string;
  partnerAgencyName: string;
  status: TrustStatus;

  // Invite metadata
  initiatedBy: string;            // agencyId that sent the invite
  initiatedByUserId: string;
  inviteMessage?: string;

  // MOU acceptance — both parties must sign
  mouVersion: string;
  initiatorMouSignedAt?: string;
  initiatorMouSignedBy?: string;
  acceptorMouSignedAt?: string;
  acceptorMouSignedBy?: string;

  // Lifecycle
  activatedAt?: string;
  suspendedAt?: string;
  suspendedBy?: string;
  suspendedReason?: string;
  revokedAt?: string;
  revokedBy?: string;
  revokedReason?: string;

  createdAt: string;
  updatedAt: string;

  // GSI projections
  gsi1pk?: string;                // STATUS#{status}
  gsi1sk?: string;                // UPDATED#{updatedAt}
}

// ── Sharing Policy ───────────────────────────────────────────────────────────

export interface AgencySharingPolicy {
  // DynamoDB keys
  pk: string;                     // POLICY#{agencyId}
  sk: string;                     // PARTNER#{partnerAgencyId}

  agencyId: string;
  partnerAgencyId: string;
  enabled: boolean;
  sharingMode: SharingMode;

  // Incident filtering
  shareIncidentTypes: IncidentType[] | ['*'];
  sharePriorityThreshold: Priority;   // Share P1 through P(threshold)

  // Field-level sharing controls
  shareFields: ShareFieldPolicy;

  // Geographic constraint. When geoBoundaryMiles is set, HQ coordinates are required
  // or the incident is not shared.
  geoBoundaryMiles?: number;
  hqLat?: number;
  hqLon?: number;

  // CAD write-back (Phase 3)
  writebackEnabled: boolean;
  writebackMode: WritebackMode;
  writebackFields: WritebackFieldPolicy;

  createdAt: string;
  updatedAt: string;
  updatedBy: string;              // userId who last changed policy
}

export interface ShareFieldPolicy {
  location: boolean;
  incidentType: boolean;
  priority: boolean;
  unitStatus: boolean;
  narrative: boolean;             // Always PII-scrubbed before sharing
  aiSummary: boolean;
  transcript: boolean;            // Always PII-scrubbed before sharing
  confidenceScore: boolean;
  extractedEntities: boolean;
}

export interface WritebackFieldPolicy {
  incidentType: boolean;
  priority: boolean;
  location: boolean;
  narrative: boolean;
  unitStatus: boolean;
}

// ── Shared Incident (received by partner) ────────────────────────────────────

export interface SharedIncident {
  // DynamoDB keys
  pk: string;                     // RECEIVER#{agencyId}
  sk: string;                     // SHARED#{sourceAgencyId}#INCIDENT#{incidentId}#{timestamp}

  shareId: string;                // UUID for this specific share event
  receiverAgencyId: string;
  sourceAgencyId: string;
  sourceAgencyName: string;

  // Incident data (only permitted fields included)
  incidentId: string;
  sourceCADIncidentId: string;
  incidentType: IncidentType;
  priority: Priority;
  status: string;
  location?: IncidentLocation;
  units?: NormalizedUnit[];
  narrative?: string;
  aiSummary?: string;
  transcript?: CadMeshTranscriptSegment[];
  confidenceScore?: number;

  sharingPolicyId: string;
  fieldsIncluded: (keyof ShareFieldPolicy)[];

  // Delivery state
  sharedAt: string;
  deliveredAt?: string;
  deliveryAttempts: number;

  // Write-back state (Phase 3)
  writebackEnabled: boolean;
  writebackMode?: WritebackMode;
  writebackStatus?: WritebackStatus;
  writebackAt?: string;
  writebackCADId?: string;        // ID assigned by receiving CAD
  writebackApprovedBy?: string;   // userId (assisted mode)

  // Expiry — shared incidents auto-purge after 72 hours
  ttl: number;
}

// ── Audit Log ────────────────────────────────────────────────────────────────

export interface CADShareAuditEntry {
  // DynamoDB keys
  pk: string;                     // AGENCY#{agencyId}
  sk: string;                     // AUDIT#{timestamp}#{shareId}

  shareId: string;
  direction: 'outbound' | 'inbound';
  sourceAgencyId: string;
  receiverAgencyId: string;
  incidentId: string;
  policySnapshot: Pick<AgencySharingPolicy, 'sharingMode' | 'shareFields' | 'shareIncidentTypes'>;
  fieldsShared: (keyof ShareFieldPolicy)[];
  deliveryStatus: DeliveryStatus;
  writebackStatus?: WritebackStatus;
  triggeredBy: 'automatic' | 'manual';
  userId?: string;
  timestamp: string;
  durationMs?: number;
}

// ── MOU Document ─────────────────────────────────────────────────────────────

export interface MOUDocument {
  version: string;
  effectiveDate: string;
  title: string;
  sections: MOUSection[];
  checksum: string;               // SHA-256 of content — stored alongside signature
}

export interface MOUSection {
  heading: string;
  body: string;
}

// ── API Request/Response shapes ───────────────────────────────────────────────

export interface SendInviteRequest {
  partnerAgencyId: string;
  partnerAgencyName?: string;
  inviteMessage?: string;
  mouVersion: string;             // Version the initiator agrees to
}

export interface AcceptInviteRequest {
  mouVersion: string;             // Version the acceptor agrees to
}

export interface UpdatePolicyRequest {
  enabled?: boolean;
  sharingMode?: SharingMode;
  shareIncidentTypes?: IncidentType[] | ['*'];
  sharePriorityThreshold?: Priority;
  shareFields?: Partial<ShareFieldPolicy>;
  geoBoundaryMiles?: number | null;
  hqLat?: number | null;
  hqLon?: number | null;
  writebackEnabled?: boolean;
  writebackMode?: WritebackMode;
  writebackFields?: Partial<WritebackFieldPolicy>;
}

export interface WritebackApprovalRequest {
  shareId: string;
  approved: boolean;
  reason?: string;
}

// ── Phase 4: Mesh visualization ──────────────────────────────────────────────

export interface AgencyMeshNode {
  agencyId: string;
  agencyName: string;
  lat: number;
  lon: number;
  activePartners: number;
  pendingInvites: number;
  incidentsSharedToday: number;
  cadVendor: CadMeshVendor;
}

export interface AgencyMeshEdge {
  sourceAgencyId: string;
  partnerAgencyId: string;
  status: TrustStatus;
  incidentsToday: number;
  lastShareAt?: string;
  writebackEnabled: boolean;
}
