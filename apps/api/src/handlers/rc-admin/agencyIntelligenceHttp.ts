import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import {
  CIVIC_IQ_CONNECTION,
  FCC_REGISTRY_SOURCE,
  SEARCH_INDEX_STATUS,
  SMALL_PRIMARY_PSAP_FILTER,
  buildProspectingRows,
  canVerifyAgencyIntelligence,
  decideEvidence,
  effectiveActiveRfp,
  freshnessFlags,
  prospectingQuerySchema,
  prospectingRowsToCsv,
  submitEvidence,
  submitEvidenceBodySchema,
  verificationDecisionBodySchema,
  vacancyPercentage,
  type AgencyIntelligenceProfile,
  type ProspectingSubject,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../lib/ids.js";
import { badRequest, badRequestFromZod, forbidden, jsonStatus, notFound, ok } from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { PsapProspectRepository } from "../../repositories/psapProspectRepository.js";

const prospects = new PsapProspectRepository();
const audit = new AuditRepository();

function readStoredProfileSafe(raw: unknown): AgencyIntelligenceProfile | null {
  if (!raw || typeof raw !== "object") return null;
  if ((raw as { schemaVersion?: number }).schemaVersion !== 1) return null;
  return raw as AgencyIntelligenceProfile;
}

export { readStoredProfileSafe as readStoredProfile };

function actorName(user: UserContext): string {
  return user.displayName?.trim() || user.email?.trim() || user.userId;
}

async function auditEvent(
  user: UserContext,
  type: string,
  resourceId: string,
  details: Record<string, string>,
): Promise<void> {
  try {
    await audit.create({
      eventId: makeId("audit"),
      agencyId: "platform",
      actorId: user.userId,
      type,
      details,
      createdAt: new Date().toISOString(),
      resourceType: "psap_prospect",
      resourceId,
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "agency_intelligence_audit_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

function toSubject(row: {
  psapId: string;
  psapName?: string;
  state?: string;
  county?: string;
  city?: string;
  outreachStatus?: string;
  assignedToName?: string;
  nextActionNote?: string | null;
  nextActionDate?: string | null;
  agencyIntelligence?: unknown;
}): ProspectingSubject {
  return {
    psapId: row.psapId,
    agencyName: row.psapName?.trim() || "Unknown agency",
    state: (row.state ?? "").toUpperCase(),
    county: row.county ?? "",
    city: row.city ?? "",
    outreachStatus: row.outreachStatus ?? "UNCONTACTED",
    assignedToName: row.assignedToName ?? null,
    nextActionNote: row.nextActionNote ?? null,
    nextActionDate: row.nextActionDate ?? null,
    profile: readStoredProfileSafe(row.agencyIntelligence),
  };
}

export async function handleAgencyIntelligence(
  event: APIGatewayProxyEventV2,
  user: UserContext,
): Promise<APIGatewayProxyResultV2 | null> {
  const method = (event.requestContext.http?.method ?? "GET").toUpperCase();
  const path = event.rawPath ?? event.requestContext.http?.path ?? "";
  if (!path.includes("/agency-intelligence")) return null;

  const psapId = event.pathParameters?.psapId?.trim();
  const nowIso = new Date().toISOString();

  if (method === "GET" && path.endsWith("/agency-intelligence/export")) {
    const parsed = prospectingQuerySchema.safeParse(event.queryStringParameters ?? {});
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const rows = await loadRows(parsed.data, nowIso);
    await auditEvent(user, AUDIT_EVENT_TYPES.AGENCY_INTELLIGENCE_EXPORTED, "export", {
      count: String(rows.length),
      view: parsed.data.view,
    });
    const date = nowIso.slice(0, 10);
    return {
      statusCode: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="agency-intelligence-${parsed.data.view}-${date}.csv"`,
      },
      body: prospectingRowsToCsv(rows),
    };
  }

  if (method === "GET" && /\/psap-prospects\/agency-intelligence\/?$/.test(path)) {
    const parsed = prospectingQuerySchema.safeParse(event.queryStringParameters ?? {});
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const page = parsed.data.page ?? 1;
    const pageSize = parsed.data.pageSize ?? 50;
    const rows = await loadRows(parsed.data, nowIso);
    const start = (page - 1) * pageSize;
    return ok({
      savedFilter: SMALL_PRIMARY_PSAP_FILTER,
      view: parsed.data.view,
      civicIq: CIVIC_IQ_CONNECTION,
      fccRegistry: FCC_REGISTRY_SOURCE,
      searchIndex: SEARCH_INDEX_STATUS,
      readPath: parsed.data.state ? "STATE_INDEX" : "TABLE_SCAN",
      opportunityScore: "NOT_IMPLEMENTED",
      items: rows.slice(start, start + pageSize),
      total: rows.length,
      page,
      pageSize,
      hasMore: start + pageSize < rows.length,
    });
  }

  if (!psapId) return notFound("PSAP not found");

  if (method === "GET" && path.endsWith("/agency-intelligence")) {
    const prospect = await prospects.get(psapId);
    if (!prospect) return notFound("PSAP not found");
    const profile = readStoredProfileSafe(prospect.agencyIntelligence);
    return ok({
      prospect: {
        psapId: prospect.psapId,
        psapName: prospect.psapName,
        state: prospect.state,
        county: prospect.county,
        city: prospect.city,
        phone: prospect.phone,
        website: prospect.website ?? null,
        outreachStatus: prospect.outreachStatus,
        assignedToName: prospect.assignedToName ?? null,
        assignedToUserId: prospect.assignedToUserId ?? null,
        nextActionNote: prospect.nextActionNote ?? null,
        nextActionDate: prospect.nextActionDate ?? null,
        leadsCrmLeadId: prospect.leadsCrmLeadId ?? null,
      },
      profile,
      vacancyPercentage: profile ? vacancyPercentage(profile.staffing) : null,
      activeRfp: profile ? effectiveActiveRfp(profile, nowIso) : null,
      staleFields: profile ? freshnessFlags(profile, nowIso) : [],
      pendingEvidence: profile?.evidence.filter((item) => item.decision === "PENDING") ?? [],
      civicIq: CIVIC_IQ_CONNECTION,
      fccRegistry: FCC_REGISTRY_SOURCE,
      canVerify: canVerifyAgencyIntelligence(user.role),
    });
  }

  if (method === "POST" && path.endsWith("/agency-intelligence/evidence")) {
    let body: unknown;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return badRequest("Invalid JSON body");
    }
    const parsed = submitEvidenceBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const current = await prospects.get(psapId);
    if (!current) return notFound("PSAP not found");
    const result = submitEvidence({
      profile: readStoredProfileSafe(current.agencyIntelligence),
      body: parsed.data,
      evidenceId: randomUUID(),
      actor: actorName(user),
      nowIso,
    });
    if (!result.ok) return badRequest(result.message);
    const saved = await prospects.saveAgencyIntelligence(psapId, result.profile, nowIso);
    if (!saved) return notFound("PSAP not found");
    await auditEvent(user, AUDIT_EVENT_TYPES.AGENCY_INTELLIGENCE_EVIDENCE_SUBMITTED, psapId, {
      field: parsed.data.field,
      outcome: result.outcome,
      evidenceId: result.evidenceId,
    });
    return ok({ outcome: result.outcome, evidenceId: result.evidenceId, profile: result.profile });
  }

  if (method === "POST" && path.endsWith("/agency-intelligence/decisions")) {
    if (!canVerifyAgencyIntelligence(user.role)) {
      await auditEvent(user, AUDIT_EVENT_TYPES.AGENCY_INTELLIGENCE_ACCESS_DENIED, psapId, {
        action: "verification_decision",
      });
      return forbidden();
    }
    let body: unknown;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return badRequest("Invalid JSON body");
    }
    const parsed = verificationDecisionBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const current = await prospects.get(psapId);
    if (!current) return notFound("PSAP not found");
    const profile = readStoredProfileSafe(current.agencyIntelligence);
    if (!profile) return badRequest("This agency has no evidence to review.");
    const result = decideEvidence({
      profile,
      evidenceId: parsed.data.evidenceId,
      action: parsed.data.action,
      actor: actorName(user),
      nowIso,
      decisionId: randomUUID(),
      note: parsed.data.note,
    });
    if (!result.ok) return badRequest(result.message);
    const saved = await prospects.saveAgencyIntelligence(psapId, result.profile, nowIso);
    if (!saved) return notFound("PSAP not found");
    await auditEvent(user, AUDIT_EVENT_TYPES.AGENCY_INTELLIGENCE_VERIFICATION_DECIDED, psapId, {
      evidenceId: parsed.data.evidenceId,
      action: parsed.data.action,
      outcome: result.outcome,
    });
    if (result.outcome === "conflict") {
      return jsonStatus(
        {
          outcome: result.outcome,
          error:
            "The new claim conflicts with a verified value. Both claims were kept. Approve over the conflict only after comparing the sources.",
          profile: result.profile,
        },
        409,
      );
    }
    return ok({ outcome: result.outcome, profile: result.profile });
  }

  return null;
}

async function loadRows(
  query: {
    view: "qualified" | "research" | "excluded";
    state?: string;
    county?: string;
    salesZone?: "zone-1" | "zone-2" | "zone-3" | "zone-4" | "zone-5" | "zone-6";
    cadVendor?: string;
    headcountBasis?: "DISTINCT_DISPATCH_PERSONNEL" | "AUTHORIZED_POSITIONS" | "FTE";
  },
  nowIso: string,
) {
  const sources = await prospects.listAgencyIntelligenceSources(query.state);
  return buildProspectingRows(
    sources.map(toSubject),
    SMALL_PRIMARY_PSAP_FILTER,
    {
      state: query.state,
      county: query.county,
      salesZone: query.salesZone,
      cadVendor: query.cadVendor,
      headcountBasis: query.headcountBasis,
    },
    nowIso,
    query.view,
  );
}
