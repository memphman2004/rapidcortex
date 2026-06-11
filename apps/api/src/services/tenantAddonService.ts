import { randomUUID } from "node:crypto";
import {
  ADDON_CATALOG,
  getAddonByKey,
  isAddonIncludedInPlan,
  type AddonChangeEvent,
  type AddonKey,
  type PatchTenantAddonBody,
  type TenantEntitlements,
  type UserContext,
} from "rapid-cortex-shared";
import { defaultPermissionForRole, isRcSuperAdmin, type Permission } from "rapid-cortex-security";
import { AddonInvoiceService } from "../billing/addon-invoice-service.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { BillingAuditRepository } from "../repositories/billingAuditRepository.js";
import { TenantEntitlementsRepository } from "../repositories/tenantEntitlementsRepository.js";

const entitlementsRepo = new TenantEntitlementsRepository();
const invoiceService = new AddonInvoiceService();
const billingAudit = new BillingAuditRepository();
const agencies = new AgencyRepository();

function nowIso(): string {
  return new Date().toISOString();
}

function resolveAgencyVertical(
  agency: Awaited<ReturnType<AgencyRepository["get"]>>,
  tenantId: string,
): "core" | "campus" | "venue" | "hospital" {
  const raw = (agency as { vertical?: string } | null)?.vertical?.trim().toLowerCase();
  if (raw === "campus" || raw === "venue" || raw === "hospital") return raw;
  const token = tenantId.trim().toLowerCase();
  if (token.includes("campus-")) return "campus";
  if (token.includes("venue-")) return "venue";
  if (token.includes("hospital")) return "hospital";
  return "core";
}

function assertAddonAllowedForTenant(
  def: ReturnType<typeof getAddonByKey>,
  agency: Awaited<ReturnType<AgencyRepository["get"]>>,
  tenantId: string,
  actor: UserContext,
): void {
  if (isRcSuperAdmin(actor.role)) return;
  if (!def.verticalRequired) return;
  const vertical = resolveAgencyVertical(agency, tenantId);
  if (def.verticalRequired !== vertical) {
    const err = new Error("ADDON_VERTICAL_MISMATCH");
    (err as Error & { statusCode?: number; verticalRequired?: string }).statusCode = 409;
    (err as Error & { verticalRequired?: string }).verticalRequired = def.verticalRequired;
    throw err;
  }
}

function assertPermission(user: UserContext, permission: Permission): void {
  if (!defaultPermissionForRole(user.role, permission)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function assertRead(user: UserContext): void {
  if (defaultPermissionForRole(user.role, "billing.addons")) return;
  if (defaultPermissionForRole(user.role, "billing.usage_view")) return;
  if (defaultPermissionForRole(user.role, "audit.view")) return;
  const err = new Error("FORBIDDEN");
  (err as Error & { statusCode?: number }).statusCode = 403;
  throw err;
}

export class TenantAddonService {
  async getEntitlementsAdmin(tenantId: string, actor: UserContext): Promise<{
    entitlements: TenantEntitlements;
    catalog: typeof ADDON_CATALOG;
  }> {
    assertRead(actor);
    const entitlements = await entitlementsRepo.resolveForRead(tenantId, actor.email ?? actor.userId);
    return { entitlements, catalog: ADDON_CATALOG };
  }

  async getEntitlementsAgency(actor: UserContext): Promise<{
    entitlements: TenantEntitlements;
    catalog: typeof ADDON_CATALOG;
  }> {
    if (!actor.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const entitlements = await entitlementsRepo.resolveForRead(actor.agencyId, actor.email ?? actor.userId);
    return { entitlements, catalog: ADDON_CATALOG };
  }

  async patchAddon(
    tenantId: string,
    actor: UserContext,
    body: PatchTenantAddonBody,
    sourceApp: "web" | "desktop-macos" | "desktop-windows" | "api",
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ entitlements: TenantEntitlements; invoiceDelta: AddonChangeEvent["invoiceImpact"] }> {
    assertPermission(actor, "billing.addons");
    const def = getAddonByKey(body.addonKey);
    const current = await entitlementsRepo.getOrSeed(tenantId, actor.email ?? actor.userId);
    const agency = await agencies.get(tenantId);
    assertAddonAllowedForTenant(def, agency, tenantId, actor);
    const plan = agency?.monetizationPlanId ?? current.plan;

    if (isAddonIncludedInPlan(def, plan)) {
      const err = new Error("ADDON_INCLUDED_IN_PLAN");
      (err as Error & { statusCode?: number; plan?: string }).statusCode = 409;
      (err as Error & { plan?: string }).plan = plan;
      throw err;
    }

    const previousState = { ...(current.addons[body.addonKey] ?? { key: body.addonKey, enabled: false }) };
    const t = nowIso();
    const nextState = { ...previousState };
    if (body.enabled) {
      nextState.enabled = true;
      nextState.enabledAt = t;
      nextState.enabledBy = actor.email ?? actor.userId;
      nextState.disabledAt = undefined;
      nextState.disabledBy = undefined;
      nextState.scheduledDisableAt = undefined;
      if (body.overridePrice !== undefined) {
        nextState.overridePriceCents = Math.round(body.overridePrice * 100);
      }
    } else {
      if (def.billingType === "monthly" && !body.forceImmediateDisable) {
        nextState.enabled = true;
        nextState.scheduledDisableAt = t;
      } else {
        nextState.enabled = false;
        nextState.disabledAt = t;
        nextState.disabledBy = actor.email ?? actor.userId;
      }
    }
    if (body.notes) nextState.notes = body.notes;

    const overrideCents =
      nextState.overridePriceCents ??
      (body.overridePrice !== undefined ? Math.round(body.overridePrice * 100) : undefined);

    const { delta } = await invoiceService.applyAddonChange(
      tenantId,
      body.addonKey,
      body.enabled,
      def.billingType,
      overrideCents,
      Boolean(body.forceImmediateDisable),
    );

    const updated: TenantEntitlements = {
      ...current,
      plan,
      addons: { ...current.addons, [body.addonKey]: nextState },
      lastModifiedAt: t,
      lastModifiedBy: actor.email ?? actor.userId,
    };

    await entitlementsRepo.putConditional(tenantId, updated, current.lastModifiedAt);

    const changeEvent: AddonChangeEvent = {
      tenantId,
      addonKey: body.addonKey,
      action: body.enabled ? "enabled" : body.forceImmediateDisable ? "disabled" : "scheduled_disable",
      previousState,
      newState: nextState,
      actorId: actor.userId,
      actorEmail: actor.email ?? actor.userId,
      actorRole: actor.role,
      timestamp: t,
      invoiceImpact: delta,
    };

    await billingAudit.append({
      billingAuditEventId: randomUUID(),
      agencyId: tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      eventType: "ADDON_CHANGE",
      description: `${changeEvent.action} ${body.addonKey} via ${sourceApp}`,
      beforeState: previousState,
      afterState: { ...nextState, invoiceImpact: delta, ipAddress, userAgent, tenantPlan: plan },
      timestamp: t,
    });

    return { entitlements: updated, invoiceDelta: delta };
  }

  async listAudit(tenantId: string, actor: UserContext, limit = 50) {
    assertRead(actor);
    const items = await billingAudit.listForAgency(tenantId, limit);
    return items.filter((e) => e.eventType === "ADDON_CHANGE");
  }

  async getCurrentInvoice(tenantId: string, actor: UserContext) {
    const canManage = defaultPermissionForRole(actor.role, "billing.manage");
    const canViewUsage = defaultPermissionForRole(actor.role, "billing.usage_view");
    if (!canManage && !canViewUsage) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    return invoiceService.getCurrentOpenInvoice(tenantId);
  }
}
