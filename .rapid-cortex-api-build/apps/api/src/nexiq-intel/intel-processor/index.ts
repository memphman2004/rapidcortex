/**
 * NexiQ Intel — Processor Lambda
 * Target: apps/api/src/nexiq-intel/intel-processor/index.ts
 *
 * SQS consumer: processes documents through four stages sequentially.
 * Each stage updates the document record and appends to processingHistory.
 *
 * Stages:
 *   EXTRACT  → DocExtraction (structured fields from raw text)
 *   CLASSIFY → DocClassification (PSAP/CAMPUS/…/IRRELEVANT)
 *   DETECT   → IntelSignal (buying signal if relevant)
 *   QUALIFY  → IntelQualification (scored) → SalesLeadCrmRecord (existing Inbox)
 *
 * Cost controls (per spec §24):
 *   1. Keyword screen before Bedrock (skip obvious irrelevant)
 *   2. Cache AI results by content hash
 *   3. Low-confidence results preserved for review — not silently discarded
 *   4. Never send unchanged documents through Bedrock again
 *
 * Data provenance (per spec §22):
 *   Every extracted value tagged SOURCE_FACT / AI_EXTRACTION / AI_INFERENCE
 *   AI-generated assumptions NEVER become indistinguishable from sourced facts
 */

import type { SQSEvent, SQSRecord, Handler } from "aws-lambda";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { SQSClient, DeleteMessageCommand } from "@aws-sdk/client-sqs";

import { randomUUID } from "node:crypto";
import type {
  IntelDocument,
  IntelDocumentStatus,
  DocExtraction,
  DocClassification,
  IntelClassification,
  IntelSignal,
  IntelSignalType,
  IntelQualification,
  QualificationScoreComponent,
  IntelProcessingMessage,
  DataSource,
  ProvenancedValue,
} from "rapid-cortex-shared";

// ─── Environment ──────────────────────────────────────────────────────────────
const REGION = process.env.AWS_REGION ?? "us-east-1";
const DOCUMENTS_TABLE = process.env.NEXIQ_INTEL_DOCUMENTS_TABLE!;
const SIGNALS_TABLE = process.env.NEXIQ_INTEL_SIGNALS_TABLE!;
const SOURCES_TABLE = process.env.NEXIQ_INTEL_SOURCES_TABLE!;
const SOURCE_RUNS_TABLE = process.env.NEXIQ_INTEL_SOURCE_RUNS_TABLE!;
const RAW_ARTIFACTS_BUCKET = process.env.NEXIQ_INTEL_RAW_ARTIFACTS_BUCKET!;
const LEADS_TABLE = process.env.LEADS_TABLE!; // existing SalesLeadCrmRecord table

/** Bedrock model for extraction/classification. */
const BEDROCK_MODEL_ID =
  process.env.NEXIQ_INTEL_BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20241022-v2:0";

/** Minimum qualification score to create an Inbox lead. */
const QUALIFICATION_THRESHOLD = parseInt(
  process.env.NEXIQ_INTEL_QUALIFICATION_THRESHOLD ?? "65",
  10,
);

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({ region: REGION });
const bedrock = new BedrockRuntimeClient({ region: REGION });

// ─── Helpers ─────────────────────────────────────────────────────────────────
function nowIso(): string {
  return new Date().toISOString();
}

function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

function signalTtl(): number {
  return nowEpoch() + 2 * 365 * 24 * 60 * 60; // 2 years
}

function nanoid(prefix: string): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Buffer.from(bytes).toString("base64url").slice(0, 12)}`;
}

function prov<T>(value: T | null, source: DataSource, evidence?: string): ProvenancedValue<T> {
  return { value, source, evidence };
}

// ─── Cost control: keyword screen ────────────────────────────────────────────
const PUBLIC_SAFETY_KEYWORDS = [
  "911",
  "psap",
  "dispatch",
  "emergency communication",
  "emergency management",
  "public safety",
  "law enforcement",
  "police",
  "fire department",
  "ems",
  "ambulance",
  "campus safety",
  "campus police",
  "university safety",
  "transit security",
  "airport security",
  "venue security",
  "cad system",
  "computer aided dispatch",
  "interoperability",
  "next generation 911",
  "ng911",
  "esinet",
  "nena",
  "apco",
];

function passesKeywordScreen(text: string): boolean {
  const lower = text.toLowerCase();
  return PUBLIC_SAFETY_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Load document raw content ────────────────────────────────────────────────
async function loadDocumentContent(doc: IntelDocument): Promise<string> {
  if (doc.rawContentS3Key) {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: RAW_ARTIFACTS_BUCKET,
        Key: doc.rawContentS3Key,
      }),
    );
    return await res.Body!.transformToString("utf-8");
  }
  // Content was small enough to not need S3
  return doc.description ?? doc.title ?? "";
}

// ─── Update document status ───────────────────────────────────────────────────
async function updateDocStatus(
  docId: string,
  status: IntelDocumentStatus,
  updates: Record<string, unknown> = {},
  error?: string,
): Promise<void> {
  const historyEntry = {
    stage: status,
    at: nowIso(),
    ...(error ? { error } : {}),
  };

  const updateParts = [
    "#status = :status",
    "processingHistory = list_append(processingHistory, :entry)",
    ...Object.keys(updates).map((k) => `#${k} = :${k}`),
  ];

  const attrNames: Record<string, string> = {
    "#status": "status",
    ...Object.fromEntries(Object.keys(updates).map((k) => [`#${k}`, k])),
  };

  const attrValues: Record<string, unknown> = {
    ":status": status,
    ":entry": [historyEntry],
    ...Object.fromEntries(Object.entries(updates).map(([k, v]) => [`:${k}`, v])),
  };

  await ddb.send(
    new UpdateCommand({
      TableName: DOCUMENTS_TABLE,
      Key: { docId },
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ExpressionAttributeNames: attrNames,
      ExpressionAttributeValues: attrValues,
    }),
  );
}

// ─── STAGE 1: EXTRACT ────────────────────────────────────────────────────────
async function extractDocument(doc: IntelDocument): Promise<DocExtraction | null> {
  const start = Date.now();
  const content = await loadDocumentContent(doc);

  // Keyword screen before Bedrock (cost control)
  const titleAndDesc = `${doc.title ?? ""} ${doc.description ?? ""} ${doc.url}`;
  if (!passesKeywordScreen(titleAndDesc) && !passesKeywordScreen(content.slice(0, 2000))) {
    return null; // Will be classified IRRELEVANT in next stage
  }

  const prompt = `You are extracting structured procurement information from a public safety procurement document.

Extract ONLY information that is explicitly present in the document.
Do NOT infer, assume, or hallucinate any values.
If a field is not present, return null for that field.
Tag each extracted value with its source:
- "SOURCE_FACT" = verbatim from document
- "AI_EXTRACTION" = extracted/parsed by you from document text
- "AI_INFERENCE" = you inferred from context (lower confidence, use sparingly)

Document URL: ${doc.url}
Document title: ${doc.title ?? "Unknown"}

Document content (first 8000 chars):
${content.slice(0, 8000)}

Return a JSON object matching this schema (no markdown, no explanation):
{
  "organization": { "value": string|null, "source": "SOURCE_FACT"|"AI_EXTRACTION"|"AI_INFERENCE" },
  "department": { "value": string|null, "source": "..." },
  "solicitationNumber": { "value": string|null, "source": "..." },
  "procurementType": { "value": "RFP"|"RFI"|"RFQ"|"ITB"|"SOURCES_SOUGHT"|"AWARD"|"BUDGET"|"GRANT"|"NEWS"|"OTHER"|null, "source": "..." },
  "title": { "value": string|null, "source": "..." },
  "description": { "value": string|null, "source": "..." },
  "issueDate": { "value": "YYYY-MM-DD"|null, "source": "..." },
  "questionsDeadline": { "value": "YYYY-MM-DD"|null, "source": "..." },
  "proposalDeadline": { "value": "YYYY-MM-DD"|null, "source": "..." },
  "estimatedBudgetCents": { "value": number|null, "source": "..." },
  "fundingSource": { "value": string|null, "source": "..." },
  "contractDurationMonths": { "value": number|null, "source": "..." },
  "renewalOptions": { "value": string|null, "source": "..." },
  "contactName": { "value": string|null, "source": "..." },
  "contactTitle": { "value": string|null, "source": "..." },
  "contactEmail": { "value": string|null, "source": "..." },
  "contactPhone": { "value": string|null, "source": "..." },
  "incumbentVendor": { "value": string|null, "source": "..." },
  "technologyMentioned": { "value": string[]|null, "source": "..." },
  "competitorsMentioned": { "value": string[]|null, "source": "..." },
  "relevantNxqCapabilities": { "value": string[]|null, "source": "...", "comment": "NexCortiQ capabilities: Call Assist (AI 911 call handling), Rapid Vision (AI scene intelligence), RC Translate (real-time translation), RC Guest Assist (QR/NFC citizen reporting), CAD-to-CAD Hub (interoperability)" },
  "geographicLocation": { "value": string|null, "source": "..." },
  "state": { "value": "two-letter state code"|null, "source": "..." }
}`;

  try {
    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: BEDROCK_MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      }),
    );

    const body = JSON.parse(Buffer.from(response.body).toString("utf-8")) as {
      content: Array<{ text: string }>;
    };
    const raw = body.content[0]?.text ?? "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as Record<
      string,
      { value: unknown; source: DataSource }
    >;

    const extraction: DocExtraction = {
      extractedAt: nowIso(),
      extractionModel: BEDROCK_MODEL_ID,
      extractionDurationMs: Date.now() - start,
      organization: prov(parsed.organization?.value as string | null, parsed.organization?.source ?? "AI_EXTRACTION"),
      department: prov(parsed.department?.value as string | null, parsed.department?.source ?? "AI_EXTRACTION"),
      solicitationNumber: prov(parsed.solicitationNumber?.value as string | null, parsed.solicitationNumber?.source ?? "AI_EXTRACTION"),
      procurementType: prov(parsed.procurementType?.value as string | null, parsed.procurementType?.source ?? "AI_EXTRACTION"),
      title: prov(parsed.title?.value as string | null ?? doc.title ?? null, "AI_EXTRACTION"),
      description: prov(parsed.description?.value as string | null, parsed.description?.source ?? "AI_EXTRACTION"),
      issueDate: prov(parsed.issueDate?.value as string | null, parsed.issueDate?.source ?? "AI_EXTRACTION"),
      questionsDeadline: prov(parsed.questionsDeadline?.value as string | null, parsed.questionsDeadline?.source ?? "AI_EXTRACTION"),
      proposalDeadline: prov(parsed.proposalDeadline?.value as string | null, parsed.proposalDeadline?.source ?? "AI_EXTRACTION"),
      estimatedBudgetCents: prov(parsed.estimatedBudgetCents?.value as number | null, parsed.estimatedBudgetCents?.source ?? "AI_EXTRACTION"),
      fundingSource: prov(parsed.fundingSource?.value as string | null, parsed.fundingSource?.source ?? "AI_EXTRACTION"),
      contractDurationMonths: prov(parsed.contractDurationMonths?.value as number | null, parsed.contractDurationMonths?.source ?? "AI_EXTRACTION"),
      renewalOptions: prov(parsed.renewalOptions?.value as string | null, parsed.renewalOptions?.source ?? "AI_EXTRACTION"),
      contactName: prov(parsed.contactName?.value as string | null, parsed.contactName?.source ?? "AI_EXTRACTION"),
      contactTitle: prov(parsed.contactTitle?.value as string | null, parsed.contactTitle?.source ?? "AI_EXTRACTION"),
      contactEmail: prov(parsed.contactEmail?.value as string | null, parsed.contactEmail?.source ?? "AI_EXTRACTION"),
      contactPhone: prov(parsed.contactPhone?.value as string | null, parsed.contactPhone?.source ?? "AI_EXTRACTION"),
      incumbentVendor: prov(parsed.incumbentVendor?.value as string | null, parsed.incumbentVendor?.source ?? "AI_EXTRACTION"),
      technologyMentioned: prov(parsed.technologyMentioned?.value as string[] | null, parsed.technologyMentioned?.source ?? "AI_EXTRACTION"),
      competitorsMentioned: prov(parsed.competitorsMentioned?.value as string[] | null, parsed.competitorsMentioned?.source ?? "AI_EXTRACTION"),
      relevantNxqCapabilities: prov(parsed.relevantNxqCapabilities?.value as string[] | null, parsed.relevantNxqCapabilities?.source ?? "AI_INFERENCE"),
      geographicLocation: prov(parsed.geographicLocation?.value as string | null, parsed.geographicLocation?.source ?? "AI_EXTRACTION"),
      state: prov(parsed.state?.value as string | null, parsed.state?.source ?? "AI_EXTRACTION"),
    };

    return extraction;
  } catch (e: unknown) {
    console.error(`[intel-processor] Extraction failed for ${doc.docId}:`, e);
    throw new Error(`Extraction failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─── STAGE 2: CLASSIFY ───────────────────────────────────────────────────────
async function classifyDocument(
  doc: IntelDocument,
  extraction: DocExtraction,
  content: string,
): Promise<DocClassification> {
  const start = Date.now();

  const prompt = `You are classifying a procurement document to determine relevance for NexCortiQ sales intelligence.

NexCortiQ serves these market verticals:
- PSAP: 911 centers, public safety answering points, emergency communications centers, dispatch centers
- CAMPUS: university police, campus safety, college security departments
- TRANSIT: transit authority police/security, bus/rail security
- VENUE: stadium security, airport security, convention center security, venue operations
- COMPETITOR: competitor company news, funding, deployments, contracts
- MULTI_VERTICAL: document clearly spans multiple verticals
- IRRELEVANT: not relevant to any of these verticals

Extracted document information:
Organization: ${extraction.organization.value ?? "Unknown"}
Title: ${extraction.title.value ?? doc.title ?? "Unknown"}
Description: ${extraction.description.value ?? ""}
Procurement type: ${extraction.procurementType.value ?? "Unknown"}
Technology mentioned: ${JSON.stringify(extraction.technologyMentioned.value ?? [])}

Document content snippet (first 3000 chars):
${content.slice(0, 3000)}

Return a JSON object (no markdown):
{
  "classification": "PSAP"|"CAMPUS"|"TRANSIT"|"VENUE"|"COMPETITOR"|"MULTI_VERTICAL"|"IRRELEVANT",
  "confidence": 0.0-1.0,
  "reasons": ["reason 1", "reason 2", "reason 3"],
  "evidence": ["verbatim text excerpt 1", "verbatim text excerpt 2"]
}

IMPORTANT: Do NOT silently discard ambiguous documents.
- confidence >= 0.7 → classify definitively
- confidence 0.4-0.69 → classify as best guess, set requiresReview: true
- confidence < 0.4 → classify as IRRELEVANT only if clearly unrelated; otherwise MULTI_VERTICAL + requiresReview`;

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: BEDROCK_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    }),
  );

  const body = JSON.parse(Buffer.from(response.body).toString("utf-8")) as {
    content: Array<{ text: string }>;
  };
  const raw = body.content[0]?.text ?? "{}";
  const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as {
    classification: IntelClassification;
    confidence: number;
    reasons: string[];
    evidence: string[];
  };

  return {
    classifiedAt: nowIso(),
    classificationModel: BEDROCK_MODEL_ID,
    classification: parsed.classification ?? "IRRELEVANT",
    confidence: parsed.confidence ?? 0,
    reasons: parsed.reasons ?? [],
    evidence: parsed.evidence ?? [],
    requiresReview: (parsed.confidence ?? 0) < 0.7 && parsed.classification !== "IRRELEVANT",
  };
}

// ─── STAGE 3: DETECT SIGNAL ──────────────────────────────────────────────────
async function detectSignal(
  doc: IntelDocument,
  extraction: DocExtraction,
  classification: DocClassification,
  content: string,
): Promise<IntelSignal | null> {
  if (classification.classification === "IRRELEVANT") return null;

  const start = Date.now();

  const prompt = `You are a public safety procurement intelligence analyst for NexCortiQ.
Analyze this document and detect the primary buying signal.

Signal types:
RFP, RFI, RFQ, ITB, SOURCES_SOUGHT, SOLE_SOURCE,
BUDGET_APPROVED, BUDGET_PROPOSED, CAPITAL_PROJECT,
GRANT_AWARDED, GRANT_AVAILABLE, BOARD_DISCUSSION, MODERNIZATION,
SYSTEM_REPLACEMENT, SYSTEM_UPGRADE, CONTRACT_EXPIRATION, CONTRACT_RENEWAL,
VENDOR_AWARD, NEW_LEADERSHIP, STAFFING_PROBLEM, TECHNOLOGY_GAP,
INTEROPERABILITY_NEED, SERVICE_OUTAGE, FAILED_IMPLEMENTATION,
COMPETITOR_DEPLOYMENT, COMPETITOR_DISSATISFACTION, OTHER

A signal is NOT automatically a sales lead. Detect what it IS.
A zero-signal result is valid if none are present.

Extracted info:
Organization: ${extraction.organization.value ?? "Unknown"}
Solicitation: ${extraction.solicitationNumber.value ?? "None"}
Type: ${extraction.procurementType.value ?? "Unknown"}
Deadline: ${extraction.proposalDeadline.value ?? "Unknown"}
Budget (cents): ${extraction.estimatedBudgetCents.value ?? "Unknown"}
Incumbent: ${extraction.incumbentVendor.value ?? "Unknown"}
NXQ capabilities matched: ${JSON.stringify(extraction.relevantNxqCapabilities.value ?? [])}

Content snippet:
${content.slice(0, 3000)}

Return JSON (no markdown):
{
  "hasSignal": true|false,
  "signalType": "RFP"|...|null,
  "title": "Brief signal title",
  "summary": "2-3 sentence signal summary grounded in evidence",
  "signalConfidence": 0.0-1.0,
  "evidence": ["verbatim text 1", "verbatim text 2"],
  "whyNow": "Why should NexCortiQ act on this now? Must be grounded in evidence.",
  "whyNowConfidence": "HIGH"|"MEDIUM"|"LOW"
}`;

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: BEDROCK_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    }),
  );

  const body = JSON.parse(Buffer.from(response.body).toString("utf-8")) as {
    content: Array<{ text: string }>;
  };
  const raw = body.content[0]?.text ?? "{}";
  const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as {
    hasSignal: boolean;
    signalType: IntelSignalType | null;
    title: string;
    summary: string;
    signalConfidence: number;
    evidence: string[];
    whyNow: string;
    whyNowConfidence: "HIGH" | "MEDIUM" | "LOW";
  };

  if (!parsed.hasSignal || !parsed.signalType) return null;

  // Vertical mapping
  const verticalMap: Record<string, IntelSignal["vertical"]> = {
    PSAP: "PSAP",
    CAMPUS: "CAMPUS",
    TRANSIT: "TRANSIT",
    VENUE: "VENUE",
    COMPETITOR: "COMPETITOR",
    MULTI_VERTICAL: "PSAP", // Default multi to PSAP for signal
  };

  const signalId = nanoid("isig");
  const orgId = (extraction.organization.value ?? doc.organization ?? "unknown")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 60);

  const signal: IntelSignal = {
    signalId,
    orgId,
    orgName: extraction.organization.value ?? doc.organization ?? "Unknown",
    signalType: parsed.signalType,
    vertical: verticalMap[classification.classification] ?? "PSAP",
    detectedAt: nowIso(),
    sourcePublishedAt: doc.publishedAt,
    title: parsed.title,
    summary: parsed.summary,
    sourceDocIds: [doc.docId],
    sourceUrl: doc.url,
    sourceId: doc.sourceId,
    geography: {
      state: extraction.state.value ?? undefined,
      city: extraction.geographicLocation.value ?? undefined,
    },
    solicitationNumber: extraction.solicitationNumber.value ?? undefined,
    deadlineAt: extraction.proposalDeadline.value ?? undefined,
    estimatedBudgetCents: extraction.estimatedBudgetCents.value ?? undefined,
    incumbentVendor: extraction.incumbentVendor.value ?? undefined,
    competitorsMentioned: extraction.competitorsMentioned.value ?? undefined,
    signalConfidence: parsed.signalConfidence,
    signalEvidence: parsed.evidence,
    ttl: signalTtl(),
  };

  await ddb.send(
    new PutCommand({
      TableName: SIGNALS_TABLE,
      Item: signal,
      ConditionExpression: "attribute_not_exists(signalId)",
    }),
  );

  return signal;
}

// ─── STAGE 4: QUALIFY ────────────────────────────────────────────────────────
/**
 * Explainable scoring. Never return unexplained AI score.
 * Each component stored independently.
 */
function scoreOpportunity(
  signal: IntelSignal,
  extraction: DocExtraction,
  classification: DocClassification,
): IntelQualification {
  const components: QualificationScoreComponent[] = [];

  // Product Fit (max 25)
  const nxqCaps = extraction.relevantNxqCapabilities.value ?? [];
  const productFitPts = Math.min(25, nxqCaps.length * 8);
  components.push({
    key: "product_fit",
    label: "Product Fit",
    points: productFitPts,
    maxPoints: 25,
    reason: nxqCaps.length > 0
      ? `Matched ${nxqCaps.length} NXQ capability/ies: ${nxqCaps.slice(0, 3).join(", ")}`
      : "No specific NXQ capabilities identified",
  });

  // Procurement Activity (max 20)
  const procurementPts: Record<string, number> = {
    RFP: 20, RFI: 15, RFQ: 18, ITB: 18, SOURCES_SOUGHT: 12,
    BUDGET_APPROVED: 15, BUDGET_PROPOSED: 10, MODERNIZATION: 12,
    SYSTEM_REPLACEMENT: 18, SYSTEM_UPGRADE: 14, GRANT_AVAILABLE: 12,
    GRANT_AWARDED: 10, CONTRACT_EXPIRATION: 15, BOARD_DISCUSSION: 8,
  };
  const procPts = procurementPts[signal.signalType] ?? 5;
  components.push({
    key: "procurement_activity",
    label: "Procurement Activity",
    points: procPts,
    maxPoints: 20,
    reason: `Signal type: ${signal.signalType}`,
  });

  // Budget Identified (max 15)
  const budget = extraction.estimatedBudgetCents.value;
  const budgetPts = budget
    ? budget > 50000_00 ? 15 : budget > 10000_00 ? 10 : 6 // $500K+, $100K+, <$100K
    : 0;
  components.push({
    key: "budget",
    label: "Budget/Funding Identified",
    points: budgetPts,
    maxPoints: 15,
    reason: budget
      ? `Budget identified: $${Math.round(budget / 100).toLocaleString()}`
      : "No budget information found",
  });

  // Decision Maker Available (max 10)
  const dmPts = extraction.contactName.value && extraction.contactEmail.value
    ? 10
    : extraction.contactName.value
      ? 6
      : 0;
  components.push({
    key: "decision_maker",
    label: "Decision Maker Identified",
    points: dmPts,
    maxPoints: 10,
    reason: extraction.contactName.value
      ? `Contact: ${extraction.contactName.value} (${extraction.contactTitle.value ?? "Unknown title"})`
      : "No contact information found",
  });

  // Technology Gap (max 10)
  const techGapPts = signal.incumbentVendor ? 8 : nxqCaps.length > 0 ? 6 : 2;
  components.push({
    key: "technology_gap",
    label: "Technology Gap",
    points: techGapPts,
    maxPoints: 10,
    reason: signal.incumbentVendor
      ? `Incumbent vendor: ${signal.incumbentVendor}`
      : "Technology gap inferred from capability match",
  });

  // Competitor Signal (max 8)
  const compMentioned = (signal.competitorsMentioned ?? []).length;
  const compPts = Math.min(8, compMentioned * 3);
  components.push({
    key: "competitor_signal",
    label: "Competitor Intelligence",
    points: compPts,
    maxPoints: 8,
    reason: compMentioned > 0
      ? `Competitors mentioned: ${signal.competitorsMentioned?.slice(0, 3).join(", ")}`
      : "No competitor signals detected",
  });

  // Signal Recency (max 7)
  const daysSinceDetected = signal.sourcePublishedAt
    ? Math.floor(
        (Date.now() - new Date(signal.sourcePublishedAt).getTime()) / (1000 * 60 * 60 * 24),
      )
    : 30;
  const recencyPts = daysSinceDetected <= 3 ? 7 : daysSinceDetected <= 7 ? 5 : daysSinceDetected <= 14 ? 3 : 1;
  components.push({
    key: "signal_recency",
    label: "Signal Recency",
    points: recencyPts,
    maxPoints: 7,
    reason: `Published ${daysSinceDetected} day(s) ago`,
  });

  // Geographic Fit (max 5)
  const geoFitPts = extraction.state.value ? 5 : 2;
  components.push({
    key: "geographic_fit",
    label: "Geographic Fit",
    points: geoFitPts,
    maxPoints: 5,
    reason: extraction.state.value
      ? `State: ${extraction.state.value}`
      : "Geographic location not identified",
  });

  // Classification Confidence penalty
  if (classification.confidence < 0.6) {
    components.push({
      key: "low_confidence_penalty",
      label: "Low Classification Confidence",
      points: -5,
      maxPoints: 0,
      isPenalty: true,
      reason: `Classification confidence: ${(classification.confidence * 100).toFixed(0)}% — requires manual review`,
    });
  }

  const totalScore = Math.max(
    0,
    Math.min(100, components.reduce((sum, c) => sum + c.points, 0)),
  );
  const qualified = totalScore >= QUALIFICATION_THRESHOLD;

  // Why Now explanation
  const whyNowEvidence = signal.signalEvidence.slice(0, 3);
  const whyNow = {
    headline: `${signal.signalType} detected for ${signal.orgName}`,
    explanation:
      `${signal.summary} ` +
      (extraction.proposalDeadline.value
        ? `Deadline: ${extraction.proposalDeadline.value}. `
        : "") +
      (extraction.relevantNxqCapabilities.value?.length
        ? `NXQ capabilities aligned: ${extraction.relevantNxqCapabilities.value.slice(0, 2).join(", ")}.`
        : ""),
    evidence: whyNowEvidence,
    sourceDocIds: [signal.sourceDocIds[0]!].filter(Boolean),
    confidence:
      signal.signalConfidence >= 0.8
        ? ("HIGH" as const)
        : signal.signalConfidence >= 0.5
          ? ("MEDIUM" as const)
          : ("LOW" as const),
  };

  return {
    qualificationId: nanoid("iqual"),
    signalId: signal.signalId,
    qualifiedAt: nowIso(),
    qualificationModel: "rule-based-v1",
    totalScore,
    qualified,
    threshold: QUALIFICATION_THRESHOLD,
    scoreComponents: components,
    whyNow,
    recommendedCapabilities: extraction.relevantNxqCapabilities.value ?? [],
    disqualificationReason: !qualified
      ? `Score ${totalScore} below threshold ${QUALIFICATION_THRESHOLD}. Key gaps: ${
          components
            .filter((c) => !c.isPenalty && c.points === 0)
            .map((c) => c.label)
            .join(", ")
        }`
      : undefined,
  };
}

// ─── Create Inbox Lead ────────────────────────────────────────────────────────
/**
 * Creates a SalesLeadCrmRecord in the existing Inbox.
 * Does NOT bypass human review — creates it in the existing NEW pipeline stage.
 * The existing NexiQ Inbox/review workflow handles it from here.
 */
async function createInboxLead(
  signal: IntelSignal,
  qualification: IntelQualification,
  extraction: DocExtraction,
): Promise<string> {
  const leadId = nanoid("lead");
  const now = nowIso();

  // Map IntelVertical to existing LeadVertical
  const verticalMap: Record<string, string> = {
    PSAP: "rc911",
    CAMPUS: "campus",
    TRANSIT: "transit",
    VENUE: "venue",
    COMPETITOR: "unknown",
  };

  // Build lead record matching existing SalesLeadCrmRecord schema
  const lead = {
    leadId,
    // Minimal required fields — existing Inbox shows these
    email: extraction.contactEmail.value ?? `intel-${leadId}@nexiq-auto.internal`,
    name: extraction.contactName.value ?? signal.orgName,
    firstName: extraction.contactName.value?.split(" ")[0] ?? "",
    lastName: extraction.contactName.value?.split(" ").slice(1).join(" ") ?? "",
    title: extraction.contactTitle.value ?? "Procurement",
    agencyName: signal.orgName,
    agencyCompany: signal.orgName,
    phone: extraction.contactPhone.value ?? undefined,
    vertical: verticalMap[signal.vertical] ?? "rc911",
    pipelineStage: "NEW",
    source: "nexiq_intel",
    // NexiQ Intel provenance
    attribution: {
      channel: "other" as const,
      channelLabel: "NexiQ Intel",
      landingPage: signal.sourceUrl,
      referrerUrl: signal.sourceUrl,
      utmSource: "nexiq_intel",
      utmMedium: "intel_pipeline",
      utmCampaign: signal.signalType,
      firstTouchAt: now,
    },
    message: qualification.whyNow.headline,
    interestedIn: ["nexiq_intel", signal.signalType],
    // Qualification summary surfaced in lead card
    nexiqIntelScore: qualification.totalScore,
    nexiqWhyNow: qualification.whyNow.headline,
    nexiqDeadline: extraction.proposalDeadline.value ?? undefined,
    // Financial
    estimatedValue: extraction.estimatedBudgetCents.value ?? undefined,
    pipelineValue: extraction.estimatedBudgetCents.value ?? undefined,
    // Activity
    notes: [
      {
        noteId: nanoid("note"),
        text: qualification.whyNow.explanation.slice(0, 2000),
        authorId: "system:nexiq-intel",
        authorName: "NexiQ Intel",
        createdAt: now,
        pinned: true,
      },
    ],
    activities: [
      {
        activityId: nanoid("act"),
        type: "created",
        description: `NexiQ Intel discovered signal: ${signal.signalType} — Score: ${qualification.totalScore}/100`,
        authorId: "system:nexiq-intel",
        authorName: "NexiQ Intel",
        createdAt: now,
        metadata: {
          signalId: signal.signalId,
          docUrl: signal.sourceUrl,
          whyNow: qualification.whyNow.headline.slice(0, 200),
        },
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: LEADS_TABLE,
      Item: lead,
      ConditionExpression: "attribute_not_exists(leadId)",
    }),
  );

  console.log(
    `[intel-processor] Inbox lead created: ${leadId} (${signal.orgName}, score=${qualification.totalScore})`,
  );

  return leadId;
}

// ─── Main document processing pipeline ───────────────────────────────────────
async function processDocument(docId: string): Promise<void> {
  // Load document
  const docRes = await ddb.send(
    new GetCommand({ TableName: DOCUMENTS_TABLE, Key: { docId } }),
  );

  if (!docRes.Item) {
    console.warn(`[intel-processor] Document not found: ${docId}`);
    return;
  }

  const doc = docRes.Item as IntelDocument;

  if (doc.isDuplicate) {
    console.log(`[intel-processor] Skipping duplicate document: ${docId}`);
    return;
  }

  // Skip already-processed documents (idempotency)
  if (
    doc.status === "QUALIFIED" ||
    doc.status === "DISQUALIFIED" ||
    doc.status === "INBOX_CREATED"
  ) {
    console.log(`[intel-processor] Already processed: ${docId} (status=${doc.status})`);
    return;
  }

  const content = await loadDocumentContent(doc).catch(() => "");

  // ── EXTRACT ──────────────────────────────────────────────────────────────
  console.log(`[intel-processor] [DOC-${docId}] EXTRACTING`);
  await updateDocStatus(docId, "EXTRACTING");

  let extraction: DocExtraction | null = null;
  try {
    extraction = await extractDocument(doc);
    if (!extraction) {
      // Keyword screen rejected this doc before Bedrock
      await updateDocStatus(docId, "CLASSIFIED", {
        classification: {
          classifiedAt: nowIso(),
          classification: "IRRELEVANT",
          confidence: 1.0,
          reasons: ["Failed keyword screen — no public safety terms detected"],
          evidence: [],
          requiresReview: false,
        },
      });
      console.log(`[intel-processor] [DOC-${docId}] Skipped: keyword screen negative`);
      return;
    }

    await updateDocStatus(docId, "EXTRACTED", { extraction });
    console.log(`[intel-processor] [DOC-${docId}] EXTRACTED — org: ${extraction.organization.value}`);
  } catch (e: unknown) {
    await updateDocStatus(docId, "FAILED", {}, `Extraction failed: ${e}`);
    throw e;
  }

  // ── CLASSIFY ──────────────────────────────────────────────────────────────
  console.log(`[intel-processor] [DOC-${docId}] CLASSIFYING`);
  await updateDocStatus(docId, "CLASSIFYING");

  let classification: DocClassification;
  try {
    classification = await classifyDocument(doc, extraction, content);
    await updateDocStatus(docId, "CLASSIFIED", { classification });
    console.log(
      `[intel-processor] [DOC-${docId}] CLASSIFIED → ${classification.classification} (confidence=${classification.confidence})`,
    );
  } catch (e: unknown) {
    await updateDocStatus(docId, "FAILED", {}, `Classification failed: ${e}`);
    throw e;
  }

  if (classification.classification === "IRRELEVANT" && !classification.requiresReview) {
    console.log(`[intel-processor] [DOC-${docId}] DISQUALIFIED: classified as IRRELEVANT`);
    await updateDocStatus(docId, "DISQUALIFIED");
    return;
  }

  // ── DETECT SIGNAL ─────────────────────────────────────────────────────────
  console.log(`[intel-processor] [DOC-${docId}] DETECTING`);
  await updateDocStatus(docId, "DETECTING_SIGNALS");

  let signal: IntelSignal | null = null;
  try {
    signal = await detectSignal(doc, extraction, classification, content);
    if (signal) {
      await updateDocStatus(docId, "QUALIFIED", { signalId: signal.signalId });
      console.log(
        `[intel-processor] [DOC-${docId}] SIGNAL DETECTED → ${signal.signalType} (${signal.orgName})`,
      );
    } else {
      await updateDocStatus(docId, "DISQUALIFIED");
      console.log(`[intel-processor] [DOC-${docId}] No signal detected — document DISQUALIFIED`);
      return;
    }
  } catch (e: unknown) {
    await updateDocStatus(docId, "FAILED", {}, `Signal detection failed: ${e}`);
    throw e;
  }

  // ── QUALIFY ───────────────────────────────────────────────────────────────
  console.log(`[intel-processor] [DOC-${docId}] QUALIFYING`);
  await updateDocStatus(docId, "QUALIFYING");

  const qualification = scoreOpportunity(signal, extraction, classification);

  await updateDocStatus(docId, "QUALIFIED", { qualification });
  await ddb.send(
    new UpdateCommand({
      TableName: SIGNALS_TABLE,
      Key: { orgId: signal.orgId, signalId: signal.signalId },
      UpdateExpression: "SET qualificationId = :q, #score = :s",
      ExpressionAttributeNames: { "#score": "qualificationScore" },
      ExpressionAttributeValues: {
        ":q": qualification.qualificationId,
        ":s": qualification.totalScore,
      },
    }),
  );

  console.log(
    `[intel-processor] [DOC-${docId}] QUALIFIED — score=${qualification.totalScore}/100 ` +
      `(threshold=${QUALIFICATION_THRESHOLD}, qualified=${qualification.qualified})`,
  );

  if (!qualification.qualified) {
    console.log(
      `[intel-processor] [DOC-${docId}] Score ${qualification.totalScore} below threshold. NOT creating Inbox item. ` +
        `Reason: ${qualification.disqualificationReason}`,
    );
    await updateDocStatus(docId, "DISQUALIFIED");
    return;
  }

  // ── CREATE INBOX LEAD ─────────────────────────────────────────────────────
  try {
    const inboxLeadId = await createInboxLead(signal, qualification, extraction);

    // Update signal with lead reference
    await ddb.send(
      new UpdateCommand({
        TableName: SIGNALS_TABLE,
        Key: { orgId: signal.orgId, signalId: signal.signalId },
        UpdateExpression: "SET inboxLeadId = :lid",
        ExpressionAttributeValues: { ":lid": inboxLeadId },
      }),
    );

    await updateDocStatus(docId, "INBOX_CREATED", { inboxLeadId });

    console.log(
      `[intel-processor] [DOC-${docId}] INBOX_CREATED → leadId=${inboxLeadId}`,
    );
  } catch (e: unknown) {
    // Don't fail the whole pipeline if inbox creation fails
    console.error(`[intel-processor] Failed to create inbox lead for ${docId}:`, e);
    // Leave status as QUALIFIED — can be manually promoted
  }
}

// ─── SQS Handler ─────────────────────────────────────────────────────────────
export const handler: Handler<SQSEvent> = async (event) => {
  console.log(`[intel-processor] Processing ${event.Records.length} SQS records`);

  const failures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    let docId: string | undefined;
    try {
      const msg = JSON.parse(record.body) as IntelProcessingMessage;
      docId = msg.docId;
      await processDocument(docId);
    } catch (e: unknown) {
      console.error(`[intel-processor] Failed to process record ${record.messageId} (doc=${docId}):`, e);
      // Report as batch item failure — SQS will retry or DLQ
      failures.push({ itemIdentifier: record.messageId });
    }
  }

  return {
    batchItemFailures: failures,
  };
};
