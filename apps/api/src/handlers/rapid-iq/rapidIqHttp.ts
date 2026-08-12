import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import {
  canAccessRapidIq,
  convertToLeadBodySchema,
  outreachBodySchema,
  agencyProfileBodySchema,
  competitorIntelBodySchema,
  researchAgencyBodySchema,
  rfpOutlineBodySchema,
  searchContactsBodySchema,
  signalChatBodySchema,
  talkingPointsBodySchema,
  updateOpportunityBodySchema,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import {
  generateAgencyProfile,
  generateCompetitorIntel,
  generateOutreach,
  generateRfpResponseOutline,
  generateTalkingPoints,
  researchAgency,
  signalChat,
} from "../../lib/rapid-iq/claude-classifier.js";
import { findAgencyContacts } from "../../lib/rapid-iq/agency-contact-finder.js";
import { dedupeSourcesByUrl } from "../../lib/rapid-iq/deduplication.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { RapidIqContactRepository } from "../../repositories/rapidIqContactRepository.js";
import { RapidIqOpportunityRepository } from "../../repositories/rapidIqOpportunityRepository.js";
import { RapidIqRefreshStatusRepository } from "../../repositories/rapidIqRefreshStatusRepository.js";
import { RapidIqSignalRepository } from "../../repositories/rapidIqSignalRepository.js";
import { RapidIqSourceRepository } from "../../repositories/rapidIqSourceRepository.js";
import { SalesLeadRepository } from "../../repositories/salesLeadRepository.js";

const oppRepo = new RapidIqOpportunityRepository();
const sigRepo = new RapidIqSignalRepository();
const contactRepo = new RapidIqContactRepository();
const sourceRepo = new RapidIqSourceRepository();
const refreshRepo = new RapidIqRefreshStatusRepository();
const auditRepo = new AuditRepository();
const leadsRepo = new SalesLeadRepository();
const lambda = new LambdaClient({});

type JsonResult = ReturnType<typeof ok>;

async function requireRapidIqAdmin(
  event: APIGatewayProxyEventV2,
): Promise<{ error: JsonResult } | { user: UserContext }> {
  const user = await getUserContext(event);
  if (!user) return { error: unauthorized() };
  if (!isUserAccountActive(user)) return { error: unauthorized(ACCOUNT_INACTIVE_MESSAGE) };
  if (!env.enableRapidIq) return { error: serviceUnavailable("Rapid IQ is not enabled") };
  if (!canAccessRapidIq(user.role)) return { error: forbidden() };
  return { user };
}

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function opportunityIdFromPath(path: string, params?: { opportunityId?: string }): string | undefined {
  if (params?.opportunityId?.trim()) return params.opportunityId.trim();
  const m = path.match(/\/opportunities\/([^/]+)/);
  return m?.[1];
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await requireRapidIqAdmin(event);
    if ("error" in auth) return withCorrelationHeaders(event, auth.error);
    const { user } = auth;

    const method = (event.requestContext.http?.method ?? "GET").toUpperCase();
    const path = event.rawPath ?? event.requestContext.http?.path ?? "";
    const opportunityId = opportunityIdFromPath(path, event.pathParameters);

    // GET /api/rapid-iq/refresh/status
    if (method === "GET" && path.endsWith("/refresh/status")) {
      const status = await refreshRepo.get();
      return withCorrelationHeaders(event, ok(status));
    }

    // POST /api/rapid-iq/refresh
    if (method === "POST" && (path.endsWith("/refresh") || path.endsWith("/rapid-iq/refresh"))) {
      const fn = env.rapidIqOrchestratorFunctionName;
      if (!fn) {
        return withCorrelationHeaders(
          event,
          serviceUnavailable("RAPID_IQ_ORCHESTRATOR_FUNCTION_NAME not configured"),
        );
      }
      const body = parseBody(event);
      const requestedSource =
        body && typeof body === "object" && typeof (body as { source?: unknown }).source === "string"
          ? (body as { source: string }).source.trim()
          : "manual-refresh";
      const invokeSource =
        requestedSource === "ramp" || requestedSource === "ramp-manual"
          ? "ramp-manual"
          : "manual-refresh";
      await lambda.send(
        new InvokeCommand({
          FunctionName: fn,
          InvocationType: "Event",
          Payload: Buffer.from(JSON.stringify({ source: invokeSource })),
        }),
      );
      await refreshRepo.put({
        status: "running",
        startedAt: new Date().toISOString(),
        completedAt: null,
        signalsFound: 0,
        error: null,
      });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.RAPID_IQ_REFRESH_TRIGGERED,
        details: { source: invokeSource },
        createdAt: new Date().toISOString(),
        resourceType: "rapid_iq_refresh",
        resourceId: invokeSource === "ramp-manual" ? "ramp" : "manual",
      });
      return withCorrelationHeaders(
        event,
        ok(
          {
            message:
              invokeSource === "ramp-manual" ? "RAMP scan started" : "Refresh started",
          },
          202,
        ),
      );
    }

    // POST /api/rapid-iq/talking-points
    if (method === "POST" && path.endsWith("/talking-points")) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = talkingPointsBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const opp = await oppRepo.get(parsed.data.opportunityId);
      if (!opp) return withCorrelationHeaders(event, notFound("Opportunity not found"));
      const signals = await sigRepo.listByOpportunity(opp.opportunityId);
      const points = await generateTalkingPoints(opp, signals);
      // Never persist an empty list — that locks the UI into a silent no-op on later clicks.
      if (points.length > 0) {
        const updated = { ...opp, talkingPoints: points, lastRefreshedAt: new Date().toISOString() };
        await oppRepo.put(updated);
      }
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.RAPID_IQ_TALKING_POINTS_GENERATED,
        details: { count: points.length },
        createdAt: new Date().toISOString(),
        resourceType: "rapid_iq_opportunity",
        resourceId: opp.opportunityId,
      });
      return withCorrelationHeaders(event, ok({ points }));
    }

    // POST /api/rapid-iq/outreach
    if (method === "POST" && path.endsWith("/outreach")) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = outreachBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const opp = await oppRepo.get(parsed.data.opportunityId);
      if (!opp) return withCorrelationHeaders(event, notFound("Opportunity not found"));
      let contact: { name?: string | null; title?: string } | undefined;
      if (parsed.data.contactId) {
        const contacts = await contactRepo.listByOpportunity(opp.opportunityId);
        const match = contacts.find((c) => c.contactId === parsed.data.contactId);
        if (match) contact = { name: match.name, title: match.title };
      }
      const signals = await sigRepo.listByOpportunity(opp.opportunityId);
      const talkingPoints = await generateTalkingPoints(opp, signals);
      if (talkingPoints.length > 0 && (!opp.talkingPoints || opp.talkingPoints.length === 0)) {
        await oppRepo.put({
          ...opp,
          talkingPoints,
          lastRefreshedAt: new Date().toISOString(),
        });
      }
      const draft = await generateOutreach(opp, contact, talkingPoints);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.RAPID_IQ_OUTREACH_GENERATED,
        details: { contactId: parsed.data.contactId ?? null, talkingPoints: talkingPoints.length },
        createdAt: new Date().toISOString(),
        resourceType: "rapid_iq_opportunity",
        resourceId: opp.opportunityId,
      });
      return withCorrelationHeaders(event, ok(draft));
    }

    // POST /api/rapid-iq/rfp-outline
    if (method === "POST" && path.endsWith("/rfp-outline")) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = rfpOutlineBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const opp = await oppRepo.get(parsed.data.opportunityId);
      if (!opp) return withCorrelationHeaders(event, notFound("Opportunity not found"));
      const [signals, sources] = await Promise.all([
        sigRepo.listByOpportunity(opp.opportunityId),
        sourceRepo.listByOpportunity(opp.opportunityId),
      ]);
      const rfpText =
        [opp.aiSummary, ...signals.map((s) => s.summary), ...sources.map((s) => s.excerpt ?? "")]
          .filter(Boolean)
          .join("\n\n") || opp.aiHeadline;
      const sourceUrl = sources[0]?.url ?? signals[0]?.sourceUrl ?? "";
      const outline = await generateRfpResponseOutline(rfpText, sourceUrl, opp.agencyName);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.RAPID_IQ_RFP_OUTLINE_GENERATED,
        details: { requirementCount: outline.requirements.length },
        createdAt: new Date().toISOString(),
        resourceType: "rapid_iq_opportunity",
        resourceId: opp.opportunityId,
      });
      return withCorrelationHeaders(event, ok(outline));
    }

    // POST /api/rapid-iq/agency-profile
    if (method === "POST" && path.endsWith("/agency-profile")) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = agencyProfileBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const opp = await oppRepo.get(parsed.data.opportunityId);
      if (!opp) return withCorrelationHeaders(event, notFound("Opportunity not found"));
      const profile = await generateAgencyProfile({
        agencyName: opp.agencyName,
        city: opp.city,
        state: opp.state,
        county: opp.county,
        vertical: opp.vertical,
        agencyType: opp.agencyType,
        population: opp.population,
        estimatedDollarValue: opp.estimatedDollarValue,
        incumbentVendor: opp.incumbentVendor,
        aiSummary: opp.aiSummary,
        aiHeadline: opp.aiHeadline,
      });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.RAPID_IQ_AGENCY_PROFILE_GENERATED,
        details: {
          populationServed: profile.populationServed,
          hasCad: Boolean(profile.currentCadVendor),
        },
        createdAt: new Date().toISOString(),
        resourceType: "rapid_iq_opportunity",
        resourceId: opp.opportunityId,
      });
      return withCorrelationHeaders(event, ok(profile));
    }

    // POST /api/rapid-iq/research-agency
    if (method === "POST" && path.endsWith("/research-agency")) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = researchAgencyBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const opp = await oppRepo.get(parsed.data.opportunityId);
      if (!opp) return withCorrelationHeaders(event, notFound("Opportunity not found"));
      const research = await researchAgency(opp.agencyName, opp.city, opp.state);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.RAPID_IQ_AGENCY_RESEARCHED,
        details: {},
        createdAt: new Date().toISOString(),
        resourceType: "rapid_iq_opportunity",
        resourceId: opp.opportunityId,
      });
      return withCorrelationHeaders(event, ok({ research }));
    }

    // POST /api/rapid-iq/competitor-intel
    if (method === "POST" && path.endsWith("/competitor-intel")) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = competitorIntelBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const opp = await oppRepo.get(parsed.data.opportunityId);
      if (!opp) return withCorrelationHeaders(event, notFound("Opportunity not found"));
      if (!opp.incumbentVendor) {
        return withCorrelationHeaders(event, badRequest("No incumbent vendor on this opportunity"));
      }
      const intel = await generateCompetitorIntel(opp.incumbentVendor, opp.agencyName);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.RAPID_IQ_COMPETITOR_INTEL_GENERATED,
        details: { incumbentVendor: opp.incumbentVendor },
        createdAt: new Date().toISOString(),
        resourceType: "rapid_iq_opportunity",
        resourceId: opp.opportunityId,
      });
      return withCorrelationHeaders(event, ok({ intel }));
    }

    // POST /api/rapid-iq/signal-chat
    if (method === "POST" && path.endsWith("/signal-chat")) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = signalChatBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const opp = await oppRepo.get(parsed.data.opportunityId);
      if (!opp) return withCorrelationHeaders(event, notFound("Opportunity not found"));
      const history = [
        ...(parsed.data.history ?? []),
        { role: "user" as const, content: parsed.data.message },
      ];
      try {
        const [signals, sources] = await Promise.all([
          sigRepo.listByOpportunity(opp.opportunityId),
          sourceRepo.listByOpportunity(opp.opportunityId),
        ]);
        const reply = await signalChat(opp, history, signals, sources);
        return withCorrelationHeaders(event, ok({ reply }));
      } catch (err) {
        console.error(
          JSON.stringify({
            msg: "rapid_iq_chat_error",
            opportunityId: opp.opportunityId,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        return withCorrelationHeaders(
          event,
          ok(
            {
              error: err instanceof Error ? err.message : "Chat failed",
              detail: "Check CloudWatch logs for rapid_iq_chat_error",
            },
            500,
          ),
        );
      }
    }

    // POST /api/rapid-iq/search-contacts
    if (method === "POST" && path.endsWith("/search-contacts")) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = searchContactsBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const opp = await oppRepo.get(parsed.data.opportunityId);
      if (!opp) return withCorrelationHeaders(event, notFound("Opportunity not found"));

      const vertical =
        opp.rcProduct === "campus" || opp.vertical === "campus"
          ? "campus"
          : opp.rcProduct === "venue" || opp.vertical === "venue"
            ? "venue"
            : "911";

      try {
        const found = await findAgencyContacts({
          agencyName: opp.agencyName,
          agencyType: opp.agencyType,
          city: opp.city,
          state: opp.state,
          vertical,
        });
        for (const contact of found) {
          await contactRepo.put({ ...contact, opportunityId: opp.opportunityId });
        }
      } catch (err) {
        console.error(
          JSON.stringify({
            msg: "rapid_iq_contact_finder_error",
            opportunityId: opp.opportunityId,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }

      let contacts = await contactRepo.listByOpportunity(parsed.data.opportunityId);
      const q = parsed.data.query?.trim().toLowerCase();
      if (q) {
        contacts = contacts.filter((c) =>
          `${c.name ?? ""} ${c.title} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(q),
        );
      }
      return withCorrelationHeaders(event, ok({ contacts, count: contacts.length }));
    }

    // POST /api/rapid-iq/convert-to-lead
    if (method === "POST" && path.endsWith("/convert-to-lead")) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = convertToLeadBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const opp = await oppRepo.get(parsed.data.opportunityId);
      if (!opp) return withCorrelationHeaders(event, notFound("Opportunity not found"));
      if (opp.convertedLeadId) {
        return withCorrelationHeaders(event, ok({ leadId: opp.convertedLeadId, alreadyConverted: true }));
      }
      const leadId = randomUUID();
      const now = new Date().toISOString();
      await leadsRepo.putLead({
        leadId,
        name: opp.agencyName,
        email: `rapid-iq+${leadId.slice(0, 8)}@rapidcortex.us`,
        agencyCompany: opp.agencyName,
        customerType:
          opp.vertical === "campus" ? "campus" : opp.vertical === "venue" ? "venue" : "agency",
        interestedIn: ["dashboard_platform", "pilot_program"],
        message: `${opp.aiHeadline}\n\n${opp.aiSummary}${parsed.data.notes ? `\n\n${parsed.data.notes}` : ""}`,
        createdAt: now,
        source: "rapid-iq",
        status: "new",
        pipelineStage: "NEW",
        assignee: parsed.data.assignee,
        attribution: {
          channel: "contact_sales",
          channelLabel: "Rapid IQ",
          landingPage: "/rc-admin/rapid-iq",
          firstTouchAt: now,
        },
      });
      await oppRepo.markConverted(opp.opportunityId, leadId);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.RAPID_IQ_CONVERTED_TO_LEAD,
        details: { leadId },
        createdAt: now,
        resourceType: "rapid_iq_opportunity",
        resourceId: opp.opportunityId,
      });
      return withCorrelationHeaders(event, ok({ leadId }));
    }

    // Nested opportunity routes
    if (opportunityId) {
      if (method === "GET" && path.endsWith("/signals")) {
        const signals = await sigRepo.listByOpportunity(opportunityId);
        return withCorrelationHeaders(event, ok({ items: signals }));
      }
      if (method === "GET" && path.endsWith("/contacts")) {
        const contacts = await contactRepo.listByOpportunity(opportunityId);
        return withCorrelationHeaders(event, ok({ items: contacts }));
      }
      if (method === "GET" && path.endsWith("/sources")) {
        const sources = dedupeSourcesByUrl(await sourceRepo.listByOpportunity(opportunityId));
        return withCorrelationHeaders(event, ok({ items: sources }));
      }
      if (method === "PATCH") {
        const body = parseBody(event);
        if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
        const parsed = updateOpportunityBodySchema.safeParse(body);
        if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
        const updated = await oppRepo.update(opportunityId, parsed.data);
        if (!updated) return withCorrelationHeaders(event, notFound("Opportunity not found"));
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: "platform",
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.RAPID_IQ_OPPORTUNITY_UPDATED,
          details: { fields: Object.keys(parsed.data) },
          createdAt: new Date().toISOString(),
          resourceType: "rapid_iq_opportunity",
          resourceId: opportunityId,
        });
        return withCorrelationHeaders(event, ok(updated));
      }
      if (method === "GET") {
        const opp = await oppRepo.get(opportunityId);
        if (!opp) return withCorrelationHeaders(event, notFound("Opportunity not found"));
        const [signals, contacts, sourcesRaw] = await Promise.all([
          sigRepo.listByOpportunity(opportunityId),
          contactRepo.listByOpportunity(opportunityId),
          sourceRepo.listByOpportunity(opportunityId),
        ]);
        const sources = dedupeSourcesByUrl(sourcesRaw);
        const mentioned = contacts.slice(0, 8).map((c) => ({
          name: c.name ?? c.title,
          role: c.title,
          status: (c.name ? "found" : "not_found") as "found" | "searching" | "not_found",
          linkedContactId: c.name ? c.contactId : null,
        }));
        return withCorrelationHeaders(
          event,
          ok({ opportunity: opp, signals, contacts, sources, mentioned }),
        );
      }
    }

    // GET /api/rapid-iq/opportunities
    if (method === "GET" && path.includes("/opportunities")) {
      const q = event.queryStringParameters ?? {};
      let items = await oppRepo.list({
        vertical: q.vertical,
        status: q.status,
      });
      if (q.state?.trim()) {
        const st = q.state.trim().toUpperCase();
        items = items.filter((o) => o.state === st);
      }
      if (q.intentStage?.trim()) {
        items = items.filter((o) => o.intentStage === q.intentStage);
      }
      if (q.search?.trim()) {
        const s = q.search.trim().toLowerCase();
        items = items.filter((o) =>
          `${o.agencyName} ${o.aiHeadline} ${o.aiSummary} ${o.city} ${o.county}`.toLowerCase().includes(s),
        );
      }
      return withCorrelationHeaders(event, ok({ items }));
    }

    return withCorrelationHeaders(event, notFound("Route not found"));
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "rapid_iq_http_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return withCorrelationHeaders(event, serverError());
  }
}
