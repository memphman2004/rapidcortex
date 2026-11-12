/**
 * RC Admin Leads CRM router — all routes under /api/rc-admin/leads/* [CR-1].
 * Also serves GET /api/rc-admin/signal-feed (vertical-scoped LeadSignal list).
 * Covers pipeline, get-by-id, stage, notes, attribution-summary, and activity log.
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  addSalesLeadActivityBodySchema,
  addSalesLeadNoteBodySchema,
  canAccessSalesLeadsCrm,
  canDeleteSalesLead,
  connectHubSpotBodySchema,
  crmNotifyBodySchema,
  crmWebhookBodySchema,
  isLeadReply,
  leadStageForProspectOutreach,
  LeadVerticalSchema,
  patchSalesLeadBodySchema,
  patchSalesLeadStageBodySchema,
  sendProspectToLeadBodySchema,
  type LeadVertical,
  MarketingDashboardFilterSchema,
  resolveMarketingProductMarket,
  resolveSalesZoneForState,
  verticalsForProductMarket,
  type MarketingDashboardFilter,
  type ProductMarket,
  type MarketingZoneId,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { SalesLeadRepository } from "../../repositories/salesLeadRepository.js";
import { storeHubSpotToken } from "../../lib/crm/hubspot-token.js";
import { syncLeadReply } from "../../lib/crm/sync-lead-reply.js";
import { listSignalsForVertical } from "../../signals/signal-processor.js";
import {
  buildProspectCarryoverNotes,
  leadAlreadyHasNoteText,
  prospectHandoffMessage,
  trimProspectNotes,
} from "../../features/leads/prospect-notes-carryover.js";

const repo = new SalesLeadRepository();
const auditRepo = new AuditRepository();

/** Append Prospects free-text notes onto an existing Sales lead when missing. */
async function carryProspectNotesOntoLead(input: {
  leadId: string;
  notesText: string | undefined;
  authorId: string;
  authorName: string;
}): Promise<void> {
  const text = trimProspectNotes(input.notesText);
  if (!text) return;
  const existing = await repo.getNormalized(input.leadId);
  if (!existing || leadAlreadyHasNoteText(existing.notes, text)) return;
  await repo.addNote(input.leadId, {
    text,
    authorId: input.authorId,
    authorName: input.authorName,
  });
}

function method(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext as { http?: { method?: string } }).http?.method ?? "GET";
}

function parseBody(event: Parameters<APIGatewayProxyHandlerV2>[0]): unknown {
  try {
    const raw =
      event.isBase64Encoded && event.body
        ? Buffer.from(event.body, "base64").toString("utf8")
        : (event.body ?? "{}");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pathOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return event.rawPath ?? "";
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!canAccessSalesLeadsCrm(user.role)) return forbidden();

  const m = method(event);
  const path = pathOf(event);
  const leadId = event.pathParameters?.leadId?.trim();
  const noteId = event.pathParameters?.noteId?.trim();

  try {
    // Vertical-scoped signal feed (Sales Portal → Signal Feed tab)
    if (m === "GET" && (path.endsWith("/signal-feed") || path.endsWith("/signal-feed/"))) {
      const q = event.queryStringParameters ?? {};
      const verticalRaw = (q.vertical ?? "").trim();
      const parsed = LeadVerticalSchema.safeParse(verticalRaw);
      if (!parsed.success || parsed.data === "unknown") {
        return badRequest("vertical query required (rc911|campus|venue|hospital|transit)");
      }
      const days = Math.min(90, Math.max(1, Number.parseInt(q.days ?? "30", 10) || 30));
      const cutoff = Date.now() - days * 86_400_000;
      const all = await listSignalsForVertical(parsed.data, 200);
      const signals = all.filter((s) => {
        const t = Date.parse(s.detectedAt);
        return Number.isFinite(t) ? t >= cutoff : true;
      });
      return ok({ signals, vertical: parsed.data });
    }

    if (m === "GET" && path.endsWith("/pipeline")) {
      const leads = await repo.listNormalized(500);
      const data = repo.buildPipelinePayload(leads);
      return ok({ success: true, data });
    }

    if (m === "GET" && path.endsWith("/attribution-summary")) {
      const leads = await repo.listNormalized(500);
      const data = repo.buildAttributionSummary(leads);
      return ok({ success: true, data });
    }

    if (path.includes("/integrations")) {
      if (m === "GET" && path.endsWith("/integrations")) {
        const stored = await repo.getCrmIntegrationSettings();
        return ok({
          success: true,
          data: { hubspot: stored.hubspot, notify: stored.notify, webhook: stored.webhook },
        });
      }
      if (m === "PUT" && path.endsWith("/integrations/hubspot")) {
        const body = parseBody(event);
        if (body === null) return ok({ error: "Invalid JSON body" }, 400);
        const parsed = connectHubSpotBodySchema.safeParse(body);
        if (!parsed.success) return badRequestFromZod(parsed.error);
        await storeHubSpotToken(parsed.data.accessToken);
        const now = new Date().toISOString();
        await repo.saveCrmIntegrationPatch({
          hubspotConnected: true,
          hubspotSecretReady: true,
          hubspotPortalId: parsed.data.portalId,
          hubspotConnectedAt: now,
        });
        try {
          await auditRepo.create({
            eventId: makeId("audit"),
            agencyId: "platform",
            actorId: user.userId,
            type: AUDIT_EVENT_TYPES.SALES_LEAD_UPDATED,
            details: { action: "hubspot_connected", portalId: parsed.data.portalId ?? "" },
            createdAt: now,
            resourceType: "integration",
            resourceId: "hubspot",
          });
        } catch (error) {
          console.error("[crm] audit failed", error instanceof Error ? error.message : "error");
        }
        return ok({ success: true, data: { connected: true } });
      }
      if (m === "DELETE" && path.endsWith("/integrations/hubspot")) {
        await repo.saveCrmIntegrationPatch({ hubspotConnected: false });
        return ok({ success: true, data: { connected: false } });
      }
      if (m === "POST" && path.endsWith("/integrations/notify")) {
        const body = parseBody(event);
        if (body === null) return ok({ error: "Invalid JSON body" }, 400);
        const parsed = crmNotifyBodySchema.safeParse(body);
        if (!parsed.success) return badRequestFromZod(parsed.error);
        await repo.saveCrmIntegrationPatch({
          [`${parsed.data.provider}NotifyEmail`]: parsed.data.email,
        });
        return ok({ success: true, data: { provider: parsed.data.provider, email: parsed.data.email } });
      }
      if (m === "PUT" && path.endsWith("/integrations/webhook")) {
        const body = parseBody(event);
        if (body === null) return ok({ error: "Invalid JSON body" }, 400);
        const parsed = crmWebhookBodySchema.safeParse(body);
        if (!parsed.success) return badRequestFromZod(parsed.error);
        await repo.saveCrmIntegrationPatch({
          webhookUrl: parsed.data.url,
          webhookEnabled: parsed.data.enabled,
        });
        return ok({ success: true, data: { enabled: parsed.data.enabled } });
      }
    }

    if (m === "POST" && path.endsWith("/from-prospect")) {
      const body = parseBody(event);
      if (body === null) return ok({ error: "Invalid JSON body" }, 400);
      const parsed = sendProspectToLeadBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const input = parsed.data;

      const authorName = user.email ?? user.userId;
      const prospectNotesText = trimProspectNotes(input.notes);

      if (input.existingLeadId) {
        const existing = await repo.getNormalized(input.existingLeadId);
        if (existing) {
          await carryProspectNotesOntoLead({
            leadId: existing.leadId,
            notesText: prospectNotesText,
            authorId: user.userId,
            authorName,
          });
          return ok({ success: true, data: { leadId: existing.leadId, created: false } });
        }
      }

      const recent = await repo.listRecent(500);
      const already = recent.find((row) => row.prospectId === input.prospectId);
      if (already) {
        await carryProspectNotesOntoLead({
          leadId: already.leadId,
          notesText: prospectNotesText,
          authorId: user.userId,
          authorName,
        });
        return ok({ success: true, data: { leadId: already.leadId, created: false } });
      }

      const stage = leadStageForProspectOutreach(input.outreachStatus);
      const now = new Date().toISOString();
      const leadId = makeId("lead");
      const contactName = input.contactName?.trim() || input.agencyName;
      const [firstName, ...rest] = contactName.split(/\s+/);
      const lastName = rest.join(" ") || undefined;
      const email =
        input.contactEmail?.trim() && input.contactEmail.includes("@")
          ? input.contactEmail.trim()
          : `prospect+${input.prospectId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}@prospects.nexcortiq.us`;
      const vertical: LeadVertical =
        input.vertical === "campus" ||
        input.vertical === "venue" ||
        input.vertical === "hospital" ||
        input.vertical === "transit"
          ? input.vertical
          : "rc911";
      const customerType =
        vertical === "campus"
          ? "campus"
          : vertical === "venue"
            ? "venue"
            : "agency";
      const handoff = prospectHandoffMessage(input.prospectId, input.outreachStatus);
      const carry = buildProspectCarryoverNotes({
        notesText: prospectNotesText,
        authorId: user.userId,
        authorName,
        createdAt: now,
        noteId: makeId("note"),
        activityId: makeId("act"),
      });

      await repo.putLead({
        leadId,
        createdAt: now,
        name: contactName,
        firstName,
        lastName,
        email,
        phone: input.contactPhone?.trim() || undefined,
        agencyCompany: input.agencyName,
        agencyName: input.agencyName,
        role: input.contactTitle?.trim() || undefined,
        title: input.contactTitle?.trim() || undefined,
        customerType,
        interestedIn: ["pilot_program"],
        message: [handoff, prospectNotesText].filter(Boolean).join(" "),
        source: "psap-prospect",
        status: stage === "QUALIFIED" ? "qualified" : "contacted",
        pipelineStage: stage,
        prospectId: input.prospectId,
        vertical,
        estimatedValue: input.estimatedValue,
        state: input.state?.trim() || null,
        requestedState: input.state?.trim() || null,
        requestedCity: input.city?.trim() || null,
        assignee: user.email ?? user.userId,
        updatedAt: now,
        updatedBy: user.userId,
        notes: carry.notes,
        activities: [
          {
            activityId: makeId("act"),
            type: "created",
            description: `Lead created · Source: psap-prospect`,
            createdAt: now,
          },
          ...carry.activities,
        ],
      });

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SALES_LEAD_UPDATED,
        details: {
          leadId,
          prospectId: input.prospectId,
          action: "created_from_prospect",
          stage,
          notesCarried: carry.notes.length > 0,
        },
        createdAt: now,
        resourceType: "sales_lead",
        resourceId: leadId,
      });

      return ok({ success: true, data: { leadId, created: true } }, 201);
    }

    if (m === "GET" && leadId && !path.includes("/notes")) {
      const item = await repo.getNormalized(leadId);
      if (!item) return ok({ error: "Lead not found" }, 404);
      return ok({ success: true, data: item, item });
    }

    if (m === "PATCH" && leadId && path.endsWith("/stage")) {
      const body = parseBody(event);
      if (body === null) return ok({ error: "Invalid JSON body" }, 400);
      const parsed = patchSalesLeadStageBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);

      const updated = await repo.updateStage(leadId, {
        stage: parsed.data.stage,
        note: parsed.data.note,
        lostReason: parsed.data.lostReason,
        pilotStartDate: parsed.data.pilotStartDate,
        changedBy: user.userId,
        changedByName: user.email ?? user.userId,
      });
      if (!updated) return ok({ error: "Lead not found" }, 404);

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SALES_LEAD_STAGE_CHANGED,
        details: {
          leadId,
          to: parsed.data.stage,
          lostReason: parsed.data.lostReason,
        },
        createdAt: new Date().toISOString(),
        resourceType: "sales_lead",
        resourceId: leadId,
      });

      return ok({ success: true, data: updated, item: updated });
    }

    // CRM field patch — also exposed as /fields so surgical stacks can avoid
    // colliding with the legacy PATCH /leads/{leadId} Lambda.
    if (
      m === "PATCH" &&
      leadId &&
      !path.endsWith("/stage") &&
      (path.endsWith("/fields") || path.endsWith(`/${leadId}`))
    ) {
      const body = parseBody(event);
      if (body === null) return ok({ error: "Invalid JSON body" }, 400);
      const parsed = patchSalesLeadBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);

      const updated = await repo.updateCrmFields(leadId, {
        ...parsed.data,
        updatedBy: user.userId,
        updatedByName: user.email ?? user.userId,
      });
      if (!updated) return ok({ error: "Lead not found" }, 404);

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SALES_LEAD_UPDATED,
        details: { leadId, fields: Object.keys(parsed.data) },
        createdAt: new Date().toISOString(),
        resourceType: "sales_lead",
        resourceId: leadId,
      });

      return ok({ success: true, data: updated, item: updated });
    }

    if (m === "POST" && leadId && path.endsWith("/notes")) {
      const body = parseBody(event);
      if (body === null) return ok({ error: "Invalid JSON body" }, 400);
      const parsed = addSalesLeadNoteBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);

      const updated = await repo.addNote(leadId, {
        text: parsed.data.text,
        pinned: parsed.data.pinned,
        authorId: user.userId,
        authorName: user.email ?? user.userId,
      });
      if (!updated) return ok({ error: "Lead not found" }, 404);

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SALES_LEAD_NOTE_ADDED,
        details: { leadId },
        createdAt: new Date().toISOString(),
        resourceType: "sales_lead",
        resourceId: leadId,
      });

      return ok({ success: true, data: updated, item: updated });
    }

    if (m === "POST" && leadId && path.endsWith("/activities")) {
      const body = parseBody(event);
      if (body === null) return ok({ error: "Invalid JSON body" }, 400);
      const parsed = addSalesLeadActivityBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);

      const updated = await repo.addActivity(leadId, {
        type: parsed.data.type,
        description: parsed.data.description,
        metadata: parsed.data.metadata,
        authorId: user.userId,
        authorName: user.email ?? user.userId,
      });
      if (!updated) return ok({ error: "Lead not found" }, 404);
      const reply = isLeadReply({
        type: parsed.data.type,
        description: parsed.data.description,
        metadata: parsed.data.metadata,
      });
      const crmSync = reply ? await syncLeadReply(repo, updated) : undefined;
      return ok({ success: true, data: updated, item: updated, crmSync });
    }

    if (m === "DELETE" && leadId && !path.includes("/notes/")) {
      if (!canDeleteSalesLead(user.role)) return forbidden();
      const deleted = await repo.deleteById(leadId);
      if (!deleted) return ok({ error: "Lead not found" }, 404);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SALES_LEAD_UPDATED,
        details: { leadId, action: "deleted" },
        createdAt: new Date().toISOString(),
        resourceType: "sales_lead",
        resourceId: leadId,
      });
      return ok({ success: true, data: { leadId, deleted: true } });
    }

    if (m === "DELETE" && leadId && noteId && path.includes("/notes/")) {
      const role = String(user.role ?? "").toLowerCase();
      if (role !== "rcsuperadmin") return forbidden();
      const updated = await repo.deleteNote(leadId, noteId);
      if (!updated) return ok({ error: "Lead not found" }, 404);
      return ok({ success: true, data: updated, item: updated });
    }

    // ── Marketing dashboard endpoints ────────────────────────────────────────
    if (m === "GET" && path.endsWith("/marketing/overview")) {
      const q = event.queryStringParameters ?? {};
      const filterResult = MarketingDashboardFilterSchema.safeParse(q);
      const filter: MarketingDashboardFilter = filterResult.success ? filterResult.data : {};

      // salescontractor scoped to their own leads only
      const isSalesContractor = String(user.role ?? "").toLowerCase() === "salescontractor";
      const effectiveAssignedTo = isSalesContractor ? (user.email ?? user.userId) : (filter.assignedTo ?? undefined);

      const allLeads = await repo.listNormalized(500);
      const leads = allLeads.filter((lead) => {
        if (effectiveAssignedTo && lead.assignedTo !== effectiveAssignedTo && lead.assignee !== effectiveAssignedTo) return false;
        if (filter.productMarket) {
          const verticals = verticalsForProductMarket(filter.productMarket);
          if (!lead.vertical || !(verticals as string[]).includes(lead.vertical)) return false;
        }
        if (filter.zoneId) {
          const leadState = lead.requestedState ?? lead.attribution?.ipRegion ?? null;
          if (resolveSalesZoneForState(leadState) !== filter.zoneId) return false;
        }
        if (filter.state) {
          const leadState = (lead.requestedState ?? lead.attribution?.ipRegion ?? "").toUpperCase();
          if (leadState !== filter.state.toUpperCase()) return false;
        }
        if (filter.agencyType && lead.agencyType !== filter.agencyType) return false;
        if (filter.campaign) {
          const utmCampaign = lead.attribution?.utmCampaign ?? "";
          if (!utmCampaign.toLowerCase().includes(filter.campaign.toLowerCase())) return false;
        }
        if (filter.product) {
          const interested = (lead.interestedIn ?? []).join(" ").toLowerCase();
          const selected = (lead.selectedFeatureIds ?? []).join(" ").toLowerCase();
          if (!interested.includes(filter.product.toLowerCase()) && !selected.includes(filter.product.toLowerCase())) return false;
        }
        return true;
      });

      // KPI totals
      const total = leads.length;
      const qualified = leads.filter((l) => !["NEW", "CONTACTED", "WON", "LOST"].includes(l.pipelineStage)).length;
      const demos = leads.filter((l) => l.pipelineStage === "DEMO_SCHEDULED" || l.pipelineStage === "DEMO_COMPLETED").length;
      const won = leads.filter((l) => l.pipelineStage === "WON").length;
      const attributedPipeline = leads
        .filter((l) => l.pipelineStage !== "LOST")
        .reduce((acc, l) => acc + (l.estimatedValue ?? 0), 0);

      // By product market
      const byMarket: Record<ProductMarket, number> = { psap: 0, campus: 0, venue: 0, transit: 0 };
      for (const lead of leads) {
        const market = resolveMarketingProductMarket(lead.vertical as LeadVertical | undefined);
        if (market) byMarket[market] += 1;
      }

      // By zone (all 6)
      const byZone: Record<string, number> = {};
      for (const lead of leads) {
        const state = lead.requestedState ?? lead.attribution?.ipRegion ?? null;
        const zone = resolveSalesZoneForState(state) ?? "unknown";
        byZone[zone] = (byZone[zone] ?? 0) + 1;
      }

      // Channel mix
      const channelSummary = repo.buildAttributionSummary(leads);

      return ok({
        success: true,
        data: {
          totals: { total, qualified, demos, won, attributedPipeline },
          byMarket,
          byZone,
          channelMix: channelSummary.byChannel,
          topReferrers: channelSummary.topReferrers,
          filter,
        },
      });
    }

    if (m === "GET" && path.endsWith("/marketing/lead-intelligence")) {
      const q = event.queryStringParameters ?? {};
      const filterResult = MarketingDashboardFilterSchema.safeParse(q);
      const filter: MarketingDashboardFilter = filterResult.success ? filterResult.data : {};

      const isSalesContractor = String(user.role ?? "").toLowerCase() === "salescontractor";
      const effectiveAssignedTo = isSalesContractor ? (user.email ?? user.userId) : (filter.assignedTo ?? undefined);

      const allLeads = await repo.listNormalized(500);
      const leads = allLeads.filter((lead) => {
        if (effectiveAssignedTo && lead.assignedTo !== effectiveAssignedTo && lead.assignee !== effectiveAssignedTo) return false;
        if (filter.productMarket) {
          const verticals = verticalsForProductMarket(filter.productMarket);
          if (!lead.vertical || !(verticals as string[]).includes(lead.vertical)) return false;
        }
        if (filter.zoneId) {
          const leadState = lead.requestedState ?? lead.attribution?.ipRegion ?? null;
          if (resolveSalesZoneForState(leadState) !== filter.zoneId) return false;
        }
        if (filter.state) {
          const leadState = (lead.requestedState ?? lead.attribution?.ipRegion ?? "").toUpperCase();
          if (leadState !== filter.state.toUpperCase()) return false;
        }
        if (filter.agencyType && lead.agencyType !== filter.agencyType) return false;
        if (filter.campaign) {
          const utmCampaign = lead.attribution?.utmCampaign ?? "";
          if (!utmCampaign.toLowerCase().includes(filter.campaign.toLowerCase())) return false;
        }
        if (filter.product) {
          const interested = (lead.interestedIn ?? []).join(" ").toLowerCase();
          const selected = (lead.selectedFeatureIds ?? []).join(" ").toLowerCase();
          if (!interested.includes(filter.product.toLowerCase()) && !selected.includes(filter.product.toLowerCase())) return false;
        }
        return true;
      });

      // Shape each lead as a Lead Intelligence card
      const cards = leads
        .filter((l) => l.pipelineStage !== "LOST")
        .sort((a, b) => (b.hotScore ?? 0) - (a.hotScore ?? 0))
        .slice(0, 100)
        .map((lead) => {
          const market = resolveMarketingProductMarket(lead.vertical as LeadVertical | undefined);
          const state = lead.requestedState ?? lead.attribution?.ipRegion ?? null;
          const zone = resolveSalesZoneForState(state);
          const recentActivities = (lead.activities ?? []).slice(-3).reverse();
          return {
            leadId: lead.leadId,
            displayName: [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.name || lead.email,
            agencyName: lead.agencyName ?? lead.agencyCompany ?? null,
            agencyType: lead.agencyType ?? null,
            state,
            zone,
            market,
            vertical: lead.vertical ?? null,
            pipelineStage: lead.pipelineStage,
            hotScore: lead.hotScore ?? null,
            signalCount: lead.signalCount ?? 0,
            engagementCount: (lead.activities ?? []).length,
            buyingSignalCount: (lead.signals ?? []).filter((s) =>
              s.type === "GRANT_SIGNAL" ||
              s.type === "RFP_SIGNAL" ||
              s.type === "BUDGET_SIGNAL" ||
              s.type === "GRANT_AWARD",
            ).length,
            recentActivities: recentActivities.map((a) => ({
              type: a.type,
              description: a.description,
              createdAt: a.createdAt,
            })),
            // Confirmed nextAction only — label AI suggestions separately
            nextAction: lead.nextAction ?? null,
            nextActionDate: lead.nextActionDate ?? null,
            assignedTo: lead.assignedTo ?? lead.assignee ?? null,
            assignedToName: lead.assignedToName ?? null,
            attribution: lead.attribution
              ? { channel: lead.attribution.channel, utmCampaign: lead.attribution.utmCampaign ?? null }
              : null,
            interestedIn: lead.interestedIn ?? [],
          };
        });

      return ok({ success: true, data: { cards, total: cards.length, filter } });
    }

    return ok({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof Error && error.message === "SALES_LEADS_TABLE_NOT_CONFIGURED") {
      return ok({ error: "Sales leads not configured" }, 503);
    }
    console.error("[rcAdminLeadsHttp]", error);
    return serverError();
  }
};
