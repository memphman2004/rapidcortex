/**
 * Fire-and-forget integration hooks for the 13-feature suite.
 * Never throws to callers — feature failures must not break core incident/media/CAD paths.
 */

import type { Incident } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { depositIncidentIntelligence } from "./citizen-intelligence.js";
import { evaluateAlternativeResponse } from "./response-routing.js";
import { createEvidenceRecord } from "./command-call-enhancement.js";
import { isFeaturesSuiteEnabled } from "./tables.js";

const ALT_RESPONSE_CONFIDENCE_FLOOR = 0.55;

function suiteReady(): boolean {
  return env.enableFeaturesSuite && isFeaturesSuiteEnabled();
}

function hasTable(name: string): boolean {
  return Boolean(name.trim());
}

function isCadClosedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.trim().toUpperCase();
  return (
    s === "CLOSED" ||
    s === "COMPLETE" ||
    s === "COMPLETED" ||
    s === "CLEARED" ||
    s === "DISPOSED" ||
    s.includes("CLOSE")
  );
}

/** Best-effort structured address from a free-text CAD / caller line. */
function addressFromFreeText(line: string): {
  street: string;
  city: string;
  state: string;
  zip: string;
} {
  const trimmed = line.trim();
  const zipMatch = trimmed.match(/\b(\d{5})(?:-\d{4})?\b/);
  const stateMatch = trimmed.match(/\b([A-Z]{2})\b/);
  return {
    street: trimmed.slice(0, 300) || "unknown",
    city: "unspecified",
    state: stateMatch?.[1] ?? "XX",
    zip: zipMatch?.[1] ?? "00000",
  };
}

/**
 * On CAD close (or equivalent), seed address intelligence.
 * Skips when suite off, no coordinates, or no address line.
 */
export function maybeDepositAddressIntelOnCadClose(params: {
  incident: Incident;
  cadStatus: string | null | undefined;
  actorId?: string;
}): void {
  if (!suiteReady()) return;
  if (!isCadClosedStatus(params.cadStatus)) return;
  if (!hasTable(env.addressIntelTable)) return;

  const incident = params.incident;
  const addressLine =
    incident.callerAddressLine?.trim() ||
    incident.cadLocation?.trim() ||
    incident.cadCallerAddressLine?.trim() ||
    "";
  const lat = incident.callerLocationLat ?? incident.cadCoordinates?.lat;
  const lon = incident.callerLocationLng ?? incident.cadCoordinates?.lng;
  if (!addressLine || lat == null || lon == null) return;

  const address = addressFromFreeText(addressLine);
  void depositIncidentIntelligence({
    agencyId: incident.agencyId,
    address,
    incidentId: incident.incidentId,
    incidentType: incident.cadNatureCode || incident.category || "unknown",
    priority: 3,
    disposition: incident.cadDisposition ?? undefined,
    notes: incident.summary?.slice(0, 2000),
    lat,
    lon,
    actorId: params.actorId ?? "system:cad-webhook",
  }).catch((err) => {
    console.error("[features] depositIncidentIntelligence failed", {
      incidentId: incident.incidentId,
      err: err instanceof Error ? err.message : String(err),
    });
  });
}

/**
 * After transcript analysis crosses confidence threshold, evaluate alt-response routing.
 */
export function maybeEvaluateAltResponseAfterAnalysis(params: {
  agencyId: string;
  incidentId: string;
  transcriptText: string;
  confidence: number;
  callType?: string;
  actorId?: string;
}): void {
  if (!suiteReady()) return;
  if (!hasTable(env.altResponseTable)) return;
  if (params.confidence < ALT_RESPONSE_CONFIDENCE_FLOOR) return;
  if (!params.transcriptText.trim()) return;

  void evaluateAlternativeResponse({
    agencyId: params.agencyId,
    incidentId: params.incidentId,
    transcript: params.transcriptText.slice(0, 50_000),
    callType: params.callType,
    actorId: params.actorId ?? "system:analysis",
  }).catch((err) => {
    console.error("[features] evaluateAlternativeResponse failed", {
      incidentId: params.incidentId,
      err: err instanceof Error ? err.message : String(err),
    });
  });
}

/**
 * Before/alongside media upload URL issuance — write chain-of-custody evidence row.
 * Links to the existing media S3 object when provided.
 */
export function maybeCreateEvidenceOnMediaUpload(params: {
  agencyId: string;
  incidentId: string;
  actorId?: string;
  originalFilename?: string;
  mimeType: string;
  fileSizeBytes?: number;
  s3Key?: string;
  s3Bucket?: string;
}): void {
  if (!suiteReady()) return;
  if (!hasTable(env.evidenceTable)) return;

  const evidenceType =
    params.mimeType.startsWith("video/") ? "video"
    : params.mimeType.startsWith("audio/") ? "audio"
    : params.mimeType.startsWith("image/") ? "photo"
    : "document";

  void createEvidenceRecord({
    agencyId: params.agencyId,
    actorId: params.actorId ?? "system:media",
    actorRole: "SYSTEM",
    incidentId: params.incidentId,
    evidenceType,
    sourceMethod: "caller_upload",
    originalFilename: params.originalFilename,
    mimeType: params.mimeType,
    fileSizeBytes: params.fileSizeBytes,
    existingS3Key: params.s3Key,
    existingS3Bucket: params.s3Bucket,
  }).catch((err) => {
    console.error("[features] createEvidenceRecord failed", {
      incidentId: params.incidentId,
      err: err instanceof Error ? err.message : String(err),
    });
  });
}
