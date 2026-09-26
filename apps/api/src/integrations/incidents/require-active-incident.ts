/**
 * Provider-agnostic active incident validation.
 *
 * Replaces `requireActiveRingIncident` from the Ring integration so Nest
 * consent flows — and any future camera provider — do not import from
 * packages/integrations/ring/. This is the canonical location for
 * incident presence checks needed by camera-provider Lambdas.
 *
 * @module integrations/incidents/require-active-incident
 */

import { IncidentRepository } from "../../repositories/incidentRepository.js";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Minimal RC incident shape needed by camera-provider routes.
 * The full DynamoDB record may carry additional fields — index signature
 * keeps this forward-compatible without widening the coupling surface.
 */
export type RCIncident = {
  incidentId: string;
  agencyId: string;
  /** Raw status string stored in DynamoDB — normalised to uppercase before comparison. */
  status: string;
  /** Canonical NexCort iQ incident geocode (WGS84). */
  callerLocationLat?: number | null;
  callerLocationLng?: number | null;
  /** Top-level lat when stored flat (preferred for provider-agnostic records). */
  latitude?: number;
  /** Top-level lng when stored flat (preferred for provider-agnostic records). */
  longitude?: number;
  /** Nested location object — fallback when coordinates are not promoted to top level. */
  location?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  };
  [key: string]: unknown;
};

type UserContext = { agencyId: string; role?: string };

export type ActiveIncidentOk = { ok: true; incident: RCIncident };
export type ActiveIncidentFail = { ok: false; message: string; statusCode: number };
export type ActiveIncidentResult = ActiveIncidentOk | ActiveIncidentFail;

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Status values that qualify an incident as actionable.
 * Align with the DynamoDB enum in your incident schema.
 */
const ACTIVE_STATUSES = new Set([
  "ACTIVE",
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "DISPATCHED",
]);

// ── Module-level singleton (Lambda warm-path reuse) ───────────────────────────

const incidentRepo = new IncidentRepository();

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Confirms that `incidentId` exists, belongs to `user.agencyId`, and is
 * currently active. Returns a discriminated union so callers can return
 * early on failure without throwing.
 *
 * Agency isolation: `rcsuperadmin` may query across agencies (audit / support).
 * All other roles are hard-scoped to their own `agencyId`.
 *
 * @example
 * ```ts
 * const result = await requireActiveIncident(incidentId, user);
 * if (!result.ok) return jsonStatus({ error: result.message }, result.statusCode);
 * const { latitude, longitude } = incidentCoordinates(result.incident);
 * ```
 */
export async function requireActiveIncident(
  incidentId: string,
  user: UserContext,
): Promise<ActiveIncidentResult> {
  if (!incidentId?.trim()) {
    return { ok: false, message: "incidentId is required", statusCode: 400 };
  }

  let incident: RCIncident | null;
  try {
    incident = (await incidentRepo.get(incidentId)) as RCIncident | null;
  } catch (err) {
    console.error("[requireActiveIncident] repo.get failed", { incidentId }, err);
    return { ok: false, message: "Failed to load incident", statusCode: 500 };
  }

  if (!incident) {
    // Return 404 (not 403) so the missing vs. forbidden distinction is not
    // observable by the caller — consistent with Ring incident behaviour.
    return { ok: false, message: "Incident not found", statusCode: 404 };
  }

  // Agency isolation — intentionally returns 404, not 403, to avoid enumeration.
  if (incident.agencyId !== user.agencyId && user.role !== "rcsuperadmin") {
    return { ok: false, message: "Incident not found", statusCode: 404 };
  }

  const normalized = (incident.status ?? "").toUpperCase();
  if (!ACTIVE_STATUSES.has(normalized)) {
    return {
      ok: false,
      message: `Incident is not active (status: ${incident.status ?? "unknown"})`,
      statusCode: 409,
    };
  }

  return { ok: true, incident };
}

/**
 * Extracts `{ latitude, longitude }` from an RC incident record.
 *
 * Resolution order:
 *   1. `incident.callerLocationLat` / `incident.callerLocationLng` (canonical Incident)
 *   2. `incident.latitude` / `incident.longitude` (flat top-level)
 *   3. `incident.location.latitude` / `incident.location.longitude`
 *   4. `incident.location.lat` / `incident.location.lng` (legacy shape)
 *
 * Throws if coordinates cannot be resolved — callers should treat this as a
 * 500 (data integrity issue, not a user error).
 */
export function incidentCoordinates(incident: RCIncident): {
  latitude: number;
  longitude: number;
} {
  const lat =
    incident.callerLocationLat ??
    incident.latitude ??
    incident.location?.latitude ??
    incident.location?.lat;

  const lng =
    incident.callerLocationLng ??
    incident.longitude ??
    incident.location?.longitude ??
    incident.location?.lng;

  if (typeof lat !== "number" || !isFinite(lat)) {
    throw new Error(
      `[incidentCoordinates] Incident ${incident.incidentId} missing valid latitude (got ${lat})`,
    );
  }
  if (typeof lng !== "number" || !isFinite(lng)) {
    throw new Error(
      `[incidentCoordinates] Incident ${incident.incidentId} missing valid longitude (got ${lng})`,
    );
  }

  return { latitude: lat, longitude: lng };
}
