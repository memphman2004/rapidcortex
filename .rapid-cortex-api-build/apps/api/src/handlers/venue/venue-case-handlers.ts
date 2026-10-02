/**
 * Venue Case HTTP Handlers — RFP 2396IP, Build Items 1-4
 *
 * Routes (all under /api/incidents/{incidentId}/...):
 *   POST   /case/action           → performCaseAction
 *   GET    /case/evidence         → listEvidence
 *   POST   /case/evidence/upload  → requestEvidenceUpload (presigned PUT)
 *   POST   /case/evidence/confirm → confirmEvidenceUpload
 *   GET    /case/evidence/{evidenceId}/custody → listCustodyChain
 *   POST   /case/evidence/{evidenceId}/custody → transferCustody
 *   GET    /case/evidence/{evidenceId}/download → presignedDownload
 *   GET    /case/audit            → listVenueAuditLog
 *   POST   /case/report           → requestPdfReport
 *   POST   /case/share            → createSecureShare
 */

import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  venueCaseActionBodySchema,
  venueEvidenceUploadBodySchema,
  venueEvidenceConfirmBodySchema,
  venueCustodyTransferBodySchema,
  venueSecureShareBodySchema,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  forbidden,
  jsonStatus,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { venueCodeFromAgencyId } from "../vertical/agency-id.js";
import { canSupervisorVenueOps } from "../vertical/agency-route-context.js";
import { performCaseAction, listVenueAuditLog } from "../../venue/venue-case-service.js";
import {
  requestEvidenceUpload,
  confirmEvidenceUpload,
  listEvidenceForIncident,
  listCustodyChain,
  transferCustody,
  presignEvidenceDownload,
} from "../../venue/venue-evidence-service.js";
import {
  requestPdfReport,
  createSecureShare,
} from "../../venue/venue-report-service.js";

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function parseBody(event: { body?: string | null }): unknown {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return null;
  }
}

function actorLabel(user: { email?: string; role: string }): string {
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? "Staff";
  return user.role.replace(/^VENUE_/, "").replace(/_/g, " ") || "Staff";
}

async function requireVenueUser(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const user = await getUserContext(event);
  if (!user) return { response: withCorrelationHeaders(event, unauthorized()) } as const;
  if (!isUserAccountActive(user)) {
    return {
      response: withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE)),
    } as const;
  }
  const pwd = operationalPasswordBlock(user);
  if (pwd) return { response: withCorrelationHeaders(event, pwd) } as const;

  if (!canSupervisorVenueOps(user)) {
    return { response: withCorrelationHeaders(event, forbidden()) } as const;
  }

  const agencyId = user.agencyId?.trim();
  if (!agencyId) {
    return {
      response: withCorrelationHeaders(event, forbidden("Agency claim required")),
    } as const;
  }

  const incidentId = event.pathParameters?.incidentId?.trim();
  if (!incidentId) {
    return {
      response: withCorrelationHeaders(event, badRequest("incidentId is required")),
    } as const;
  }

  return { user, agencyId, incidentId, venueCode: venueCodeFromAgencyId(agencyId) } as const;
}

// ─── case/action ──────────────────────────────────────────────────────────────

export const caseAction: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const r = await requireVenueUser(event);
    if ("response" in r) return r.response as APIGatewayProxyResultV2;
    const { user, agencyId, incidentId, venueCode } = r;

    const body = parseBody(event);
    if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    const parsed = venueCaseActionBodySchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequest(parsed.error.issues[0]?.message ?? "Invalid body"));
    }

    const result = await performCaseAction({
      agencyId,
      venueCode,
      incidentId,
      actorId: user.userId,
      actorLabel: actorLabel(user),
      body: parsed.data,
    });
    return withCorrelationHeaders(event, ok(result));
  } catch (err) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 404) return withCorrelationHeaders(event, notFound("Incident not found"));
    if (e.statusCode === 422) return withCorrelationHeaders(event, jsonStatus({ error: e.message }, 422));
    if (e.statusCode === 403) return withCorrelationHeaders(event, forbidden());
    console.error("[venue-case-action]", err);
    return withCorrelationHeaders(event, serverError());
  }
};

// ─── evidence/upload ──────────────────────────────────────────────────────────

export const evidenceUpload: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const r = await requireVenueUser(event);
    if ("response" in r) return r.response as APIGatewayProxyResultV2;
    const { user, agencyId, incidentId, venueCode } = r;

    const body = parseBody(event);
    if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    const parsed = venueEvidenceUploadBodySchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequest(parsed.error.issues[0]?.message ?? "Invalid body"));
    }

    const result = await requestEvidenceUpload({
      agencyId,
      venueCode,
      incidentId,
      actorId: user.userId,
      actorLabel: actorLabel(user),
      body: parsed.data,
    });
    return withCorrelationHeaders(event, ok(result));
  } catch (err) {
    const e = err as { statusCode?: number };
    if (e.statusCode === 404) return withCorrelationHeaders(event, notFound("Incident not found"));
    console.error("[venue-evidence-upload]", err);
    return withCorrelationHeaders(event, serverError());
  }
};

// ─── evidence/confirm ─────────────────────────────────────────────────────────

export const evidenceConfirm: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const r = await requireVenueUser(event);
    if ("response" in r) return r.response as APIGatewayProxyResultV2;
    const { user, agencyId, incidentId, venueCode } = r;

    const body = parseBody(event);
    if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    const parsed = venueEvidenceConfirmBodySchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequest(parsed.error.issues[0]?.message ?? "Invalid body"));
    }

    const result = await confirmEvidenceUpload({
      agencyId,
      venueCode,
      incidentId,
      actorId: user.userId,
      actorLabel: actorLabel(user),
      body: parsed.data,
    });
    return withCorrelationHeaders(event, ok(result));
  } catch (err) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 404) return withCorrelationHeaders(event, notFound("Evidence not found"));
    if (e.statusCode === 422) return withCorrelationHeaders(event, jsonStatus({ error: e.message }, 422));
    console.error("[venue-evidence-confirm]", err);
    return withCorrelationHeaders(event, serverError());
  }
};

// ─── evidence list ────────────────────────────────────────────────────────────

export const evidenceList: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const r = await requireVenueUser(event);
    if ("response" in r) return r.response as APIGatewayProxyResultV2;
    const { agencyId, incidentId, venueCode } = r;

    const items = await listEvidenceForIncident(venueCode, incidentId, agencyId);
    return withCorrelationHeaders(event, ok({ evidence: items }));
  } catch (err) {
    console.error("[venue-evidence-list]", err);
    return withCorrelationHeaders(event, serverError());
  }
};

// ─── evidence custody ─────────────────────────────────────────────────────────

export const custodyList: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const r = await requireVenueUser(event);
    if ("response" in r) return r.response as APIGatewayProxyResultV2;
    const { agencyId, incidentId, venueCode } = r;

    const evidenceId = event.pathParameters?.evidenceId?.trim();
    if (!evidenceId) return withCorrelationHeaders(event, badRequest("evidenceId required"));

    const items = await listCustodyChain(venueCode, incidentId, evidenceId, agencyId);
    return withCorrelationHeaders(event, ok({ custody: items }));
  } catch (err) {
    console.error("[venue-custody-list]", err);
    return withCorrelationHeaders(event, serverError());
  }
};

export const custodyTransfer: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const r = await requireVenueUser(event);
    if ("response" in r) return r.response as APIGatewayProxyResultV2;
    const { user, agencyId, incidentId, venueCode } = r;

    const body = parseBody(event);
    if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    const parsed = venueCustodyTransferBodySchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequest(parsed.error.issues[0]?.message ?? "Invalid body"));
    }

    const result = await transferCustody({
      agencyId,
      venueCode,
      incidentId,
      actorId: user.userId,
      actorLabel: actorLabel(user),
      body: parsed.data,
    });
    return withCorrelationHeaders(event, ok(result));
  } catch (err) {
    const e = err as { statusCode?: number };
    if (e.statusCode === 404) return withCorrelationHeaders(event, notFound("Evidence not found"));
    if (e.statusCode === 403) return withCorrelationHeaders(event, forbidden());
    console.error("[venue-custody-transfer]", err);
    return withCorrelationHeaders(event, serverError());
  }
};

// ─── evidence download ────────────────────────────────────────────────────────

export const evidenceDownload: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const r = await requireVenueUser(event);
    if ("response" in r) return r.response as APIGatewayProxyResultV2;
    const { agencyId, incidentId, venueCode } = r;

    const evidenceId = event.pathParameters?.evidenceId?.trim();
    if (!evidenceId) return withCorrelationHeaders(event, badRequest("evidenceId required"));

    const url = await presignEvidenceDownload(venueCode, incidentId, evidenceId, agencyId);
    return withCorrelationHeaders(event, ok({ url }));
  } catch (err) {
    const e = err as { statusCode?: number };
    if (e.statusCode === 404) return withCorrelationHeaders(event, notFound("Evidence not found"));
    if (e.statusCode === 403) return withCorrelationHeaders(event, forbidden());
    console.error("[venue-evidence-download]", err);
    return withCorrelationHeaders(event, serverError());
  }
};

// ─── audit log ────────────────────────────────────────────────────────────────

export const caseAudit: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const r = await requireVenueUser(event);
    if ("response" in r) return r.response as APIGatewayProxyResultV2;
    const { agencyId, venueCode } = r;

    const limitParam = event.queryStringParameters?.limit;
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 100, 500) : 100;

    const items = await listVenueAuditLog(venueCode, agencyId, limit);
    return withCorrelationHeaders(event, ok({ audit: items }));
  } catch (err) {
    console.error("[venue-audit]", err);
    return withCorrelationHeaders(event, serverError());
  }
};

// ─── report ───────────────────────────────────────────────────────────────────

export const caseReport: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const r = await requireVenueUser(event);
    if ("response" in r) return r.response as APIGatewayProxyResultV2;
    const { user, agencyId, incidentId, venueCode } = r;

    const result = await requestPdfReport({
      agencyId,
      venueCode,
      incidentId,
      actorId: user.userId,
      actorLabel: actorLabel(user),
    });
    return withCorrelationHeaders(event, ok(result));
  } catch (err) {
    const e = err as { statusCode?: number };
    if (e.statusCode === 404) return withCorrelationHeaders(event, notFound("Incident not found"));
    if (e.statusCode === 403) return withCorrelationHeaders(event, forbidden());
    console.error("[venue-case-report]", err);
    return withCorrelationHeaders(event, serverError());
  }
};

// ─── secure share ─────────────────────────────────────────────────────────────

export const caseShare: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const r = await requireVenueUser(event);
    if ("response" in r) return r.response as APIGatewayProxyResultV2;
    const { user, agencyId, incidentId, venueCode } = r;

    const body = parseBody(event);
    if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    const parsed = venueSecureShareBodySchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequest(parsed.error.issues[0]?.message ?? "Invalid body"));
    }

    const result = await createSecureShare({
      agencyId,
      venueCode,
      incidentId,
      actorId: user.userId,
      actorLabel: actorLabel(user),
      body: parsed.data,
    });
    return withCorrelationHeaders(event, ok(result));
  } catch (err) {
    const e = err as { statusCode?: number };
    if (e.statusCode === 404) return withCorrelationHeaders(event, notFound("Incident not found"));
    if (e.statusCode === 403) return withCorrelationHeaders(event, forbidden());
    console.error("[venue-case-share]", err);
    return withCorrelationHeaders(event, serverError());
  }
};
