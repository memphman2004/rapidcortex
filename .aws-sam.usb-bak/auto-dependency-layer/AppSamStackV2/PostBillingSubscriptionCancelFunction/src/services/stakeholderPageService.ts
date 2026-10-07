import {
  AUDIT_EVENT_TYPES,
  isSupervisorOrAdmin,
} from "rapid-cortex-security";
import type {
  CreateStakeholderPageBody,
  PatchStakeholderPageBody,
  PublicStakeholderStatusView,
  StakeholderPage,
  StakeholderPageInternal,
  StakeholderSection,
  TimelineEventKind,
  UserContext,
} from "rapid-cortex-shared";
import {
  defaultStakeholderSections,
  isRcsuperadmin,
} from "rapid-cortex-shared";
import { resolveIncidentRead } from "../lib/incidentReadAccess.js";
import {
  hashStakeholderPagePassword,
  verifyStakeholderPagePassword,
} from "../lib/stakeholderPagePassword.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { IncidentMediaRepository } from "../repositories/incidentMediaRepository.js";
import { IncidentTimelineRepository } from "../repositories/incidentTimelineRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { StakeholderPageRepository } from "../repositories/stakeholderPageRepository.js";

const pages = new StakeholderPageRepository();
const incidents = new IncidentRepository();
const timelineRepo = new IncidentTimelineRepository();
const mediaRepo = new IncidentMediaRepository();
const auditRepo = new AuditRepository();

const INTERNAL_TIMELINE_KINDS = new Set<TimelineEventKind>([
  "dispatcher_note",
  "supervisor_joined",
  "manual_override",
]);

const TIMELINE_LABELS: Partial<Record<TimelineEventKind, string>> = {
  call_received: "Call received",
  transcription_started: "Transcription started",
  ai_analysis_created: "AI analysis",
  unit_dispatched: "Units dispatched",
  unit_status_changed: "Unit status update",
  cad_synced: "CAD sync",
  media_requested: "Media requested",
  media_received: "Media received",
  call_ended: "Call ended",
  incident_closed: "Incident closed",
  translation_activated: "Translation active",
};

function nowIso(): string {
  return new Date().toISOString();
}

function assertInfra(): void {
  if (!env.stakeholderPagesTable) {
    const err = new Error("STAKEHOLDER_PAGES_DISABLED");
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
}

function assertSupervisor(user: UserContext): void {
  if (!isSupervisorOrAdmin(user.role)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function assertAgency(user: UserContext, agencyId: string): void {
  if (isRcsuperadmin(user)) return;
  if (user.agencyId !== agencyId) {
    const err = new Error("TENANT_MISMATCH");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function toInternal(page: StakeholderPage): StakeholderPageInternal {
  const { passwordHash, ...rest } = page;
  return { ...rest, hasPassword: Boolean(passwordHash) };
}

function assertNotExpired(page: StakeholderPage): void {
  if (page.expiresAt && new Date(page.expiresAt).getTime() < Date.now()) {
    const err = new Error("EXPIRED");
    (err as Error & { statusCode?: number }).statusCode = 410;
    throw err;
  }
}

export class StakeholderPageService {
  private async assertIncidentAccess(user: UserContext, incidentId: string): Promise<string> {
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    assertAgency(user, resolved.incident.agencyId);
    return resolved.incident.agencyId;
  }

  async create(user: UserContext, body: CreateStakeholderPageBody): Promise<StakeholderPageInternal> {
    assertInfra();
    assertSupervisor(user);
    const agencyId = await this.assertIncidentAccess(user, body.incidentId);
    if (body.visibility === "password" && !body.password) {
      const err = new Error("VALIDATION:Password required for password-protected pages");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    const existing = await pages.getBySlug(body.slug);
    if (existing) {
      const err = new Error("SLUG_TAKEN");
      (err as Error & { statusCode?: number }).statusCode = 409;
      throw err;
    }
    const ts = nowIso();
    const pageId = makeId("stpg");
    const page: StakeholderPage = {
      pageId,
      agencyId,
      incidentId: body.incidentId,
      title: body.title,
      slug: body.slug,
      visibility: body.visibility,
      passwordHash:
        body.visibility === "password" && body.password
          ? hashStakeholderPagePassword(body.password)
          : undefined,
      sections: body.sections ?? defaultStakeholderSections(),
      lastUpdatedBy: user.userId,
      createdAt: ts,
      updatedAt: ts,
      expiresAt: body.expiresAt,
    };
    await pages.put(page);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      incidentId: body.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.STAKEHOLDER_PAGE_CREATED,
      details: { pageId, slug: body.slug },
      createdAt: ts,
      resourceType: "incident",
      resourceId: pageId,
    });
    return toInternal(page);
  }

  async list(user: UserContext, incidentId?: string): Promise<{ items: StakeholderPageInternal[] }> {
    assertInfra();
    assertSupervisor(user);
    if (!user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    if (incidentId) await this.assertIncidentAccess(user, incidentId);
    const rows = incidentId
      ? await pages.listByIncident(user.agencyId, incidentId)
      : [];
    return { items: rows.map(toInternal) };
  }

  async get(user: UserContext, pageId: string): Promise<StakeholderPageInternal> {
    assertInfra();
    assertSupervisor(user);
    if (!user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const page = await pages.get(user.agencyId, pageId);
    if (!page) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    assertAgency(user, page.agencyId);
    return toInternal(page);
  }

  async patch(
    user: UserContext,
    pageId: string,
    body: PatchStakeholderPageBody,
  ): Promise<StakeholderPageInternal> {
    assertInfra();
    assertSupervisor(user);
    const current = await this.get(user, pageId);
    const full = await pages.get(current.agencyId, pageId);
    if (!full) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    if (body.slug && body.slug !== full.slug) {
      const taken = await pages.getBySlug(body.slug);
      if (taken && taken.pageId !== pageId) {
        const err = new Error("SLUG_TAKEN");
        (err as Error & { statusCode?: number }).statusCode = 409;
        throw err;
      }
    }
    const visibility = body.visibility ?? full.visibility;
    let passwordHash = full.passwordHash;
    if (body.clearPassword) passwordHash = undefined;
    if (body.password) passwordHash = hashStakeholderPagePassword(body.password);
    if (visibility === "password" && !passwordHash) {
      const err = new Error("VALIDATION:Password required for password-protected pages");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    if (visibility !== "password") passwordHash = undefined;

    const ts = nowIso();
    const updated: StakeholderPage = {
      ...full,
      title: body.title ?? full.title,
      slug: body.slug ?? full.slug,
      visibility,
      passwordHash,
      sections: body.sections ?? full.sections,
      expiresAt: body.expiresAt === null ? undefined : body.expiresAt ?? full.expiresAt,
      lastUpdatedBy: user.userId,
      updatedAt: ts,
    };
    await pages.put(updated);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: full.agencyId,
      incidentId: full.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.STAKEHOLDER_PAGE_UPDATED,
      details: { pageId, slug: updated.slug },
      createdAt: ts,
      resourceType: "incident",
      resourceId: pageId,
    });
    return toInternal(updated);
  }

  async delete(user: UserContext, pageId: string): Promise<void> {
    assertInfra();
    assertSupervisor(user);
    const current = await this.get(user, pageId);
    const ts = nowIso();
    await pages.delete(current.agencyId, pageId);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: current.agencyId,
      incidentId: current.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.STAKEHOLDER_PAGE_DELETED,
      details: { pageId, slug: current.slug },
      createdAt: ts,
      resourceType: "incident",
      resourceId: pageId,
    });
  }

  async getPublicBySlug(
    slug: string,
    pagePasswordHeader?: string,
  ): Promise<PublicStakeholderStatusView | { requiresPassword: true }> {
    assertInfra();
    const page = await pages.getBySlug(slug);
    if (!page) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    assertNotExpired(page);

    if (page.visibility === "password") {
      if (!pagePasswordHeader || !page.passwordHash) {
        return { requiresPassword: true };
      }
      if (!verifyStakeholderPagePassword(pagePasswordHeader, page.passwordHash)) {
        const err = new Error("INVALID_PASSWORD");
        (err as Error & { statusCode?: number }).statusCode = 401;
        throw err;
      }
    }

    const incident = await incidents.get(page.incidentId);
    const visibleSections = page.sections.filter((s) => s.visible);

    const view: PublicStakeholderStatusView = {
      title: page.title,
      slug: page.slug,
      lastUpdatedAt: page.updatedAt,
    };

    for (const section of visibleSections) {
      await this.applyPublicSection(view, section, incident, page);
    }

    return view;
  }

  private async applyPublicSection(
    view: PublicStakeholderStatusView,
    section: StakeholderSection,
    incident: Awaited<ReturnType<IncidentRepository["get"]>>,
    page: StakeholderPage,
  ): Promise<void> {
    if (section.kind === "summary") {
      const text =
        section.content?.trim() ||
        incident?.summary?.trim() ||
        incident?.title?.trim() ||
        "Situation update in progress.";
      view.summary = text;
      return;
    }
    if (section.kind === "timeline" && env.incidentTimelineTable) {
      const events = await timelineRepo.listByIncident(page.incidentId, 100);
      view.timeline = events
        .filter((e) => !INTERNAL_TIMELINE_KINDS.has(e.kind))
        .map((e) => ({
          timestamp: e.timestamp,
          label: TIMELINE_LABELS[e.kind] ?? e.kind.replace(/_/g, " "),
          description:
            typeof e.payload?.summary === "string"
              ? e.payload.summary
              : typeof e.payload?.content === "string"
                ? e.payload.content
                : undefined,
        }));
      return;
    }
    if (section.kind === "units") {
      view.unitCount = incident?.cadUnits?.length ?? 0;
      return;
    }
    if (section.kind === "media" && env.incidentMediaTable) {
      const rows = await mediaRepo.listByIncident(page.agencyId, page.incidentId);
      view.mediaCount = rows.filter((r) => r.status === "uploaded").length;
      return;
    }
    if (section.kind === "custom_text" && section.content?.trim()) {
      view.customSections = view.customSections ?? [];
      view.customSections.push({ title: section.title, content: section.content });
    }
  }
}
