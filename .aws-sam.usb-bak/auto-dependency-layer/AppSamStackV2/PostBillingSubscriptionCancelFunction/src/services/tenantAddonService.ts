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
import { defaultPermissionForRole, type Permission } from "rapid-cortex-security";
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
    const entitlements = await entitlementsRepo.getOrSeed(tenantId, actor.email ?? actor.userId);
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
    const entitlements = await entitlementsRepo.getOrSeed(actor.agencyId, actor.email ?? actor.userId);
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
    const plan = agency?.monetizationPlanId ?? current.plan;

    if (isAddonIncludedInPlan(def, plan)) {
      const err = new Error("ADDON_INCLUDED_IN_PLAN");
      (err as Error & { statusCode?: number; plan?: string }).statusCode = 409;
      (err as Error & { plan?: string }).plan = plan;
      throw err;
    }

    const previousState = { ...current.addons[body.addonKey] };
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
    assertPermission(actor, "billing.manage");
    if (!defaultPermissionForRole(actor.role, "billing.manage")) {
      if (!defaultPermissionForRole(actor.role, "billing.usage_view")) {
        const err = new Error("FORBIDDEN");
        (err as Error & { statusCode?: number }).statusCode = 403;
        throw err;
      }
    }
    return invoiceService.getCurrentOpenInvoice(tenantId);
  }
}
