/**
 * NexiQ Intelligence Pipeline — Shared Types
 * Target: packages/shared/src/nexiq-intel/types.ts
 *
 * Upstream intelligence layer that feeds the EXISTING NexiQ Inbox/Pipeline.
 * Do NOT rebuild SalesLeadCrmRecord, PipelineStage, or the CRM pipeline.
 *
 * Flow:
 *   IntelligenceSource
 *       └─ SourceRun (telemetry per check)
 *             └─ IntelDocument (collected raw content)
 *                   └─ DocExtraction (structured fields)
 *                         └─ DocClassification (PSAP/CAMPUS/…/IRRELEVANT)
 *                               └─ IntelSignal (buying signal detected)
 *                                     └─ IntelQualification (scored)
 *                                           └─ SalesLeadCrmRecord (existing Inbox)
 *
 * Conventions (match rapid-cortex-shared):
 *  - IDs: short prefix + nanoid, e.g. "isrc-abc123", "irun-xyz789"
 *  - Timestamps: ISO 8601 UTC strings
 *  - No floats for monetary values (use cents)
 *  - TTL on compliance records: 7 years (220_752_000 seconds)
 *  - Never overwrite a SourceRun — append-only telemetry
 */

// ─── Verticals ────────────────────────────────────────────────────────────────
/** Must stay in sync with LeadVertical in rapid-cortex-shared (rc911 = PSAP). */
export const INTEL_VERTICALS = ["PSAP", "CAMPUS", "TRANSIT", "VENUE", "COMPETITOR"] as const;
export type IntelVertical = (typeof INTEL_VERTICALS)[number];

// ─── Source Types ─────────────────────────────────────────────────────────────
export const INTEL_SOURCE_TYPES = [
  "PROCUREMENT",
  "BOARD_AGENDA",
  "BOARD_MINUTES",
  "BUDGET",
  "CIP",
  "GRANT",
  "NEWS",
  "AWARD",
  "AGENCY",
  "VENDOR",
  "OTHER",
] as const;
export type IntelSourceType = (typeof INTEL_SOURCE_TYPES)[number];

// ─── Connector Types ──────────────────────────────────────────────────────────
export const INTEL_CONNECTOR_TYPES = [
  "HTML",
  "RSS",
  "API",
  "PDF_INDEX",
  "SEARCH",
  "SITEMAP",
  "CUSTOM",
] as const;
export type IntelConnectorType = (typeof INTEL_CONNECTOR_TYPES)[number];

// ─── Source Health ────────────────────────────────────────────────────────────
export const INTEL_SOURCE_HEALTH = ["HEALTHY", "DEGRADED", "FAILING", "DISABLED"] as const;
export type IntelSourceHealth = (typeof INTEL_SOURCE_HEALTH)[number];

// ─── Intelligence Source ──────────────────────────────────────────────────────
/**
 * Persistent registry of known intelligence sources.
 * DynamoDB PK: sourceId  SK: "SOURCE"
 * Table: {DdbTablePrefix}NexiQIntelSources
 */
export interface IntelligenceSource {
  /** "isrc-{nanoid}" */
  sourceId: string;
  name: string;
  organization?: string;

  url: string;
  domain: string;

  sourceType: IntelSourceType;
  verticals: IntelVertical[];

  geography?: {
    country?: string;
    state?: string;
    county?: string;
    city?: string;
  };

  connectorType: IntelConnectorType;
  enabled: boolean;

  /** How often to check. Minimum enforced: 30 min. */
  checkFrequencyMinutes: number;

  lastAttemptAt?: string;
  lastSuccessfulFetchAt?: string;
  nextScheduledCheckAt?: string;

  /** Resets to 0 on any successful fetch. Auto-disable at threshold (configurable). */
  consecutiveFailures: number;
  health: IntelSourceHealth;

  /** Cumulative lifetime stats. */
  lifetimeStats?: {
    totalRuns: number;
    successfulRuns: number;
    documentsDiscovered: number;
    documentsProcessed: number;
    relevantSignals: number;
    qualifiedOpportunities: number;
    pipelineConversions: number;
  };

  /** Optional: URL pattern to recognize document links on this source. */
  documentLinkPattern?: string;
  /** Optional: CSS selector for document title on HTML pages. */
  titleSelector?: string;
  /** Optional: CSS selector for document date. */
  dateSelector?: string;

  notes?: string;
  addedBy?: string;
  createdAt: string;
  updatedAt: string;

  /** DynamoDB TTL — only set for sources that are permanently disabled/removed. */
  ttl?: number;
}

// ─── Source Run (Telemetry) ───────────────────────────────────────────────────
/**
 * Append-only telemetry for every source check attempt.
 * A successful zero-result run ≠ a failed run. Both are distinct.
 *
 * DynamoDB PK: sourceId  SK: "RUN#{runId}"
 * GSI: runId-index (PK: runId) for direct lookup
 * GSI: startedAt-index (PK: sourceId, SK: startedAt) for time-series queries
 * Table: {DdbTablePrefix}NexiQIntelSourceRuns
 */
export const INTEL_SOURCE_RUN_STATUSES = [
  "RUNNING",
  "SUCCESS",
  "PARTIAL",
  "FAILED",
  "TIMEOUT",
  "SKIPPED",
] as const;
export type IntelSourceRunStatus = (typeof INTEL_SOURCE_RUN_STATUSES)[number];

export interface IntelSourceRun {
  /** "irun-{nanoid}" */
  runId: string;
  sourceId: string;

  status: IntelSourceRunStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;

  /** HTTP status code or equivalent for non-HTTP connectors. */
  httpStatus?: number;

  /** Counts — these are independent. Zero new docs on a healthy fetch is valid. */
  documentsDiscovered: number;
  newDocumentsFound: number;
  documentsCollected: number;
  documentsSkipped: number;
  documentsFailedExtraction: number;
  signalsDetected: number;
  opportunitiesCreated: number;

  /** Structured failure reason — never silently swallow. */
  failureReason?: string;
  failureCategory?:
    | "NETWORK_TIMEOUT"
    | "HTTP_ERROR"
    | "HTML_STRUCTURE_CHANGED"
    | "PDF_PARSE_FAILED"
    | "AUTH_REQUIRED"
    | "RATE_LIMITED"
    | "EMPTY_RESPONSE"
    | "BEDROCK_TIMEOUT"
    | "BEDROCK_ERROR"
    | "INTERNAL_ERROR"
    | "UNKNOWN";

  parserWarnings?: string[];
  aiProcessingErrors?: string[];

  triggeredBy: "SCHEDULER" | "MANUAL" | "RECONCILIATION";
  triggeredByUserId?: string;

  /** S3 key of the raw fetch artifact if stored. */
  rawArtifactS3Key?: string;

  /** DynamoDB TTL: 90 days for run records. */
  ttl: number;
}

// ─── Document Status ──────────────────────────────────────────────────────────
export const INTEL_DOCUMENT_STATUSES = [
  "COLLECTED",
  "DUPLICATE",
  "EXTRACTING",
  "EXTRACTED",
  "CLASSIFYING",
  "CLASSIFIED",
  "DETECTING",
  "DETECTING_SIGNALS",
  "QUALIFYING",
  "QUALIFIED",
  "DISQUALIFIED",
  "INBOX_CREATED",
  "FAILED",
  "SKIPPED",
] as const;
export type IntelDocumentStatus = (typeof INTEL_DOCUMENT_STATUSES)[number];

// ─── Intel Document ───────────────────────────────────────────────────────────
/**
 * A collected document. Raw content preserved for reprocessing.
 *
 * DynamoDB PK: docId  SK: "DOC"
 * GSI: sourceId-publishedAt-index (PK: sourceId, SK: publishedAt)
 * GSI: fingerprint-index (PK: fingerprint) for dedup
 * Table: {DdbTablePrefix}NexiQIntelDocuments
 *
 * Large text/HTML → S3: nexcortiq-intel-{stage}/raw/{sourceId}/{docId}.{ext}
 */
export interface IntelDocument {
  /** "idoc-{nanoid}" */
  docId: string;
  sourceId: string;
  runId: string;

  status: IntelDocumentStatus;

  /** Deterministic fingerprint for deduplication. */
  fingerprint: string;
  /** Whether this is a duplicate of an already-processed doc. */
  isDuplicate: boolean;
  /** If duplicate, the original docId. */
  duplicateOfDocId?: string;

  // ── Raw collected fields ──────────────────────────────────
  url: string;
  title?: string;
  publishedAt?: string;
  organization?: string;
  description?: string;
  /** S3 key if raw HTML/text stored. */
  rawContentS3Key?: string;
  rawContentHash?: string;
  rawContentLength?: number;
  /** Direct document URL (PDF, DOCX, etc.) if different from page URL. */
  documentUrl?: string;
  attachmentUrls?: string[];
  /** Page metadata. */
  metaTags?: Record<string, string>;

  collectedAt: string;

  // ── Processing trace ──────────────────────────────────────
  processingHistory: Array<{
    stage: IntelDocumentStatus;
    at: string;
    durationMs?: number;
    error?: string;
    notes?: string;
  }>;

  // ── Extraction result ─────────────────────────────────────
  extraction?: DocExtraction;

  // ── Classification result ─────────────────────────────────
  classification?: DocClassification;

  // ── Detected signal ID (if any) ───────────────────────────
  signalId?: string;

  // ── Qualification result ──────────────────────────────────
  qualification?: IntelQualification;

  // ── Linked CRM record ─────────────────────────────────────
  /** ID of the SalesLeadCrmRecord created in the existing Inbox, if qualified. */
  inboxLeadId?: string;

  /** DynamoDB TTL: 365 days for processed docs; 90 days for duplicates. */
  ttl: number;
}

// ─── Document Extraction ──────────────────────────────────────────────────────
/**
 * Structured fields extracted from collected document.
 * Source provenance must be maintained for every claim.
 * Unknown values must remain null — never hallucinate.
 */
export type DataSource =
  | "SOURCE_FACT"      // Verbatim from source document
  | "AI_EXTRACTION"    // Claude extracted from text
  | "AI_INFERENCE"     // Claude inferred (lower confidence)
  | "USER_ENTERED"     // Manually entered by user
  | "EXTERNAL_IMPORT"; // Imported from external system

export interface ProvenancedValue<T> {
  value: T | null;
  source: DataSource;
  /** docId and page reference if applicable. */
  evidence?: string;
  confidence?: number;
}

export interface DocExtraction {
  extractedAt: string;
  extractionModel?: string;
  extractionDurationMs?: number;

  organization: ProvenancedValue<string>;
  department: ProvenancedValue<string>;
  solicitationNumber: ProvenancedValue<string>;
  procurementType: ProvenancedValue<string>;
  title: ProvenancedValue<string>;
  description: ProvenancedValue<string>;

  issueDate: ProvenancedValue<string>;
  questionsDeadline: ProvenancedValue<string>;
  proposalDeadline: ProvenancedValue<string>;

  /** In cents. */
  estimatedBudgetCents: ProvenancedValue<number>;
  fundingSource: ProvenancedValue<string>;
  contractDurationMonths: ProvenancedValue<number>;
  renewalOptions: ProvenancedValue<string>;

  contactName: ProvenancedValue<string>;
  contactTitle: ProvenancedValue<string>;
  contactEmail: ProvenancedValue<string>;
  contactPhone: ProvenancedValue<string>;

  incumbentVendor: ProvenancedValue<string>;
  technologyMentioned: ProvenancedValue<string[]>;
  competitorsMentioned: ProvenancedValue<string[]>;
  relevantNxqCapabilities: ProvenancedValue<string[]>;

  geographicLocation: ProvenancedValue<string>;
  state: ProvenancedValue<string>;

  errors?: string[];
  warnings?: string[];
}

// ─── Document Classification ──────────────────────────────────────────────────
export const INTEL_CLASSIFICATIONS = [
  "PSAP",
  "CAMPUS",
  "TRANSIT",
  "VENUE",
  "COMPETITOR",
  "MULTI_VERTICAL",
  "IRRELEVANT",
] as const;
export type IntelClassification = (typeof INTEL_CLASSIFICATIONS)[number];

export interface DocClassification {
  classifiedAt: string;
  classificationModel?: string;
  classification: IntelClassification;
  /** 0.0–1.0 */
  confidence: number;
  reasons: string[];
  /** Verbatim text snippets that drove classification. */
  evidence: string[];
  /**
   * Low-confidence potentially-relevant records are NOT silently discarded.
   * They remain reviewable in the Sources > Processing view.
   */
  requiresReview: boolean;
}

// ─── Signal Types ─────────────────────────────────────────────────────────────
export const INTEL_SIGNAL_TYPES = [
  "RFP",
  "RFI",
  "RFQ",
  "ITB",
  "SOURCES_SOUGHT",
  "SOLE_SOURCE",
  "BUDGET_APPROVED",
  "BUDGET_PROPOSED",
  "CAPITAL_PROJECT",
  "GRANT_AWARDED",
  "GRANT_AVAILABLE",
  "BOARD_DISCUSSION",
  "MODERNIZATION",
  "SYSTEM_REPLACEMENT",
  "SYSTEM_UPGRADE",
  "CONTRACT_EXPIRATION",
  "CONTRACT_RENEWAL",
  "VENDOR_AWARD",
  "NEW_LEADERSHIP",
  "STAFFING_PROBLEM",
  "TECHNOLOGY_GAP",
  "INTEROPERABILITY_NEED",
  "SERVICE_OUTAGE",
  "FAILED_IMPLEMENTATION",
  "COMPETITOR_DEPLOYMENT",
  "COMPETITOR_DISSATISFACTION",
  "OTHER",
] as const;
export type IntelSignalType = (typeof INTEL_SIGNAL_TYPES)[number];

// ─── Intel Signal ─────────────────────────────────────────────────────────────
/**
 * A buying signal detected from a classified document.
 * A signal is NOT automatically a sales lead — it feeds qualification.
 *
 * DynamoDB PK: orgId  SK: "SIGNAL#{signalId}"
 * GSI: signalId-index (PK: signalId)
 * GSI: vertical-detectedAt-index (PK: vertical, SK: detectedAt)
 * Table: {DdbTablePrefix}NexiQIntelSignals
 */
export interface IntelSignal {
  /** "isig-{nanoid}" */
  signalId: string;
  /** Normalized organization ID (entity-resolved). */
  orgId: string;
  orgName: string;

  signalType: IntelSignalType;
  vertical: IntelVertical;

  detectedAt: string;
  /** Publication date of the source document. */
  sourcePublishedAt?: string;

  title: string;
  summary: string;

  /** Source document(s) that generated this signal. Multiple docs → one opportunity. */
  sourceDocIds: string[];
  sourceUrl: string;
  sourceId: string;

  geography?: {
    state?: string;
    county?: string;
    city?: string;
  };

  /** Key extracted fields surfaced here for qualification without re-reading the doc. */
  solicitationNumber?: string;
  deadlineAt?: string;
  estimatedBudgetCents?: number;
  incumbentVendor?: string;
  competitorsMentioned?: string[];

  /** 0.0–1.0 — signal detection confidence, separate from classification confidence. */
  signalConfidence: number;
  signalEvidence: string[];

  /** ID of the qualification record if this signal was qualified. */
  qualificationId?: string;

  /** ID of the existing SalesLeadCrmRecord in the Inbox, if qualified. */
  inboxLeadId?: string;

  /** TTL: 2 years for signals. */
  ttl: number;
}

// ─── Opportunity Lifecycle ────────────────────────────────────────────────────
export const INTEL_OPPORTUNITY_STAGES = [
  "DISCOVERED",
  "EARLY_SIGNAL",
  "BUDGET_IDENTIFIED",
  "RFI",
  "RFP",
  "ADDENDUM",
  "EVALUATION",
  "AWARD",
  "RENEWAL",
] as const;
export type IntelOpportunityStage = (typeof INTEL_OPPORTUNITY_STAGES)[number];

// ─── Qualification Score ──────────────────────────────────────────────────────
/**
 * Explainable opportunity score. NEVER return unexplained AI score.
 * Every component is stored separately.
 *
 * Max score: 100
 */
export interface QualificationScoreComponent {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  reason: string;
  /** Whether this is a penalty (negative points). */
  isPenalty?: boolean;
}

export interface IntelQualification {
  /** "iqual-{nanoid}" */
  qualificationId: string;
  signalId: string;

  qualifiedAt: string;
  qualificationModel?: string;

  /** 0–100 total score. */
  totalScore: number;
  /** Whether this clears the threshold to create an Inbox item. */
  qualified: boolean;
  /** Score threshold used at qualification time. */
  threshold: number;

  scoreComponents: QualificationScoreComponent[];

  /** Why should NexCortiQ contact this org NOW? Grounded in evidence. */
  whyNow: {
    headline: string;
    explanation: string;
    /** Verbatim evidence snippets. */
    evidence: string[];
    /** docIds that support the why-now. */
    sourceDocIds: string[];
    confidence: "HIGH" | "MEDIUM" | "LOW";
  };

  /** Top NXQ capabilities that fit this opportunity. */
  recommendedCapabilities: string[];

  /** Narrative disqualification reason if not qualified. */
  disqualificationReason?: string;
}

// ─── Discovery Gap ────────────────────────────────────────────────────────────
/**
 * When an opportunity is discovered externally (Watch, sales, manual)
 * that NexiQ did not find, record WHY it was missed.
 *
 * DynamoDB PK: gapId  SK: "GAP"
 * GSI: orgId-index
 * Table: {DdbTablePrefix}NexiQIntelGaps
 */
export const INTEL_GAP_CATEGORIES = [
  "SOURCE_UNKNOWN",
  "SOURCE_FETCH_FAILED",
  "DOCUMENT_NOT_DISCOVERED",
  "DOCUMENT_FETCH_FAILED",
  "EXTRACTION_FAILED",
  "CLASSIFICATION_FAILED",
  "SIGNAL_NOT_DETECTED",
  "QUALIFICATION_REJECTED",
  "DEDUPLICATION_ERROR",
  "SCHEDULER_FAILED",
  "UNKNOWN",
] as const;
export type IntelGapCategory = (typeof INTEL_GAP_CATEGORIES)[number];

export interface DiscoveryGap {
  /** "igap-{nanoid}" */
  gapId: string;
  orgId?: string;
  orgName: string;

  opportunityTitle: string;
  opportunityUrl?: string;
  solicitationNumber?: string;

  /** How was this opportunity discovered outside NexiQ? */
  externalDiscoverySource: "WATCH" | "MANUAL" | "SALES_TEAM" | "COMPETITOR_MONITOR" | "IMPORT" | "OTHER";
  externalDiscoveryDetail?: string;

  /** Analysis of why NexiQ missed it. */
  gapCategory: IntelGapCategory;
  gapAnalysis: string;
  recommendedRemediation?: string;

  /** Was the source registered? */
  sourceFound: boolean;
  sourceId?: string;
  /** Did the source run successfully? */
  sourceRunSuccessful?: boolean;
  /** Was the document collected? */
  documentCollected?: boolean;
  docId?: string;
  /** Stage where processing stopped. */
  failedAtStage?: IntelDocumentStatus;

  /** Was the source added to the registry as a result? */
  remediationApplied?: boolean;
  remediationSourceId?: string;

  detectedAt: string;
  resolvedAt?: string;

  /** DO NOT automatically make destructive changes based on AI recommendation. */
  autoRemediationBlocked: true;

  ttl: number;
}

// ─── Discovery Benchmark ──────────────────────────────────────────────────────
/**
 * Known historical opportunity for testing discovery recall.
 * Goal: ≥95% recall against curated benchmark set.
 *
 * DynamoDB PK: benchmarkId  SK: "BENCHMARK"
 * GSI: vertical-index
 * Table: {DdbTablePrefix}NexiQIntelBenchmarks
 */
export interface DiscoveryBenchmark {
  /** "ibmk-{nanoid}" */
  benchmarkId: string;
  vertical: IntelVertical;
  organization: string;
  title: string;
  solicitationNumber?: string;
  sourceUrl?: string;
  expectedSignalType: IntelSignalType;
  publicationDate?: string;
  notes?: string;

  // ── Test results ──
  lastTestedAt?: string;
  lastTestResult?: "FOUND" | "MISSED";
  /** Stage where processing stopped if missed. */
  missedAtStage?: IntelGapCategory;
  missedReason?: string;
  /** docId found if FOUND. */
  foundDocId?: string;
  /** signalId created if detected. */
  foundSignalId?: string;

  createdAt: string;
  updatedAt: string;
  addedBy?: string;
}

// ─── Coverage Metrics ─────────────────────────────────────────────────────────
/**
 * Daily/hourly rollup for the Coverage Dashboard.
 * Answers: "Is NexiQ actually looking where it should?"
 */
export interface IntelCoverageSnapshot {
  /** ISO date "2026-09-25" */
  date: string;
  /** Hour 0-23 for hourly snapshots, -1 for daily. */
  hour?: number;

  registeredSources: number;
  sourcesScheduled: number;
  sourcesChecked: number;
  sourcesSuccessful: number;
  sourcesFailed: number;
  sourcesDegraded: number;
  sourceSuccessRate: number;

  documentsDiscovered: number;
  newDocuments: number;
  documentsProcessed: number;
  processingFailures: number;

  potentialSignals: number;
  relevantSignals: number;
  qualifiedOpportunities: number;
  highPriorityOpportunities: number;

  /** Per-vertical breakdown. */
  byVertical: Record<
    IntelVertical,
    {
      sources: number;
      signals: number;
      opportunities: number;
    }
  >;

  createdAt: string;
}

// ─── Source Registry Mutations ────────────────────────────────────────────────
export interface CreateIntelligenceSourceRequest {
  name: string;
  organization?: string;
  url: string;
  sourceType: IntelSourceType;
  verticals: IntelVertical[];
  geography?: IntelligenceSource["geography"];
  connectorType: IntelConnectorType;
  checkFrequencyMinutes?: number;
  documentLinkPattern?: string;
  notes?: string;
}

export interface UpdateIntelligenceSourceRequest {
  name?: string;
  organization?: string;
  url?: string;
  sourceType?: IntelSourceType;
  verticals?: IntelVertical[];
  geography?: IntelligenceSource["geography"];
  connectorType?: IntelConnectorType;
  enabled?: boolean;
  checkFrequencyMinutes?: number;
  documentLinkPattern?: string;
  notes?: string;
}

// ─── API Response Envelopes ───────────────────────────────────────────────────
export interface IntelSourceListResponse {
  sources: IntelligenceSource[];
  total: number;
  nextCursor?: string;
}

export interface IntelRunListResponse {
  runs: IntelSourceRun[];
  total: number;
  nextCursor?: string;
}

export interface IntelDocumentListResponse {
  documents: IntelDocument[];
  total: number;
  nextCursor?: string;
}

export interface IntelSignalListResponse {
  signals: IntelSignal[];
  total: number;
  nextCursor?: string;
}

export interface IntelGapListResponse {
  gaps: DiscoveryGap[];
  total: number;
  nextCursor?: string;
}

export interface BenchmarkTestResult {
  benchmarkId: string;
  organization: string;
  title: string;
  result: "FOUND" | "MISSED";
  missedAtStage?: IntelGapCategory;
  missedReason?: string;
  durationMs: number;
}

export interface BenchmarkRunReport {
  ranAt: string;
  totalBenchmarks: number;
  found: number;
  missed: number;
  recallRate: number;
  byVertical: Record<IntelVertical, { total: number; found: number; rate: number }>;
  results: BenchmarkTestResult[];
}

// ─── Pipeline SQS Message Shapes ─────────────────────────────────────────────
/** Written to CollectionQueue by the Collector Lambda. */
export interface IntelCollectionMessage {
  docId: string;
  sourceId: string;
  runId: string;
  url: string;
  rawContentS3Key?: string;
  rawText?: string;
  messageType: "COLLECT";
}

/** Written to ProcessingQueue by the Extractor. */
export interface IntelProcessingMessage {
  docId: string;
  sourceId: string;
  runId: string;
  stage: "EXTRACT" | "CLASSIFY" | "DETECT" | "QUALIFY";
  messageType: "PROCESS";
}

/** EventBridge Scheduler payload for the Collector Lambda. */
export interface IntelSchedulerEvent {
  type: "SCHEDULED_SOURCE_CHECK";
  sourceId?: string;      // Omit to run all scheduled sources
  triggeredBy: "SCHEDULER" | "MANUAL";
  triggeredByUserId?: string;
}
