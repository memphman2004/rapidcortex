import { PutMetricDataCommand, CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import {
  PRICING_DEFAULTS,
  PRICING_KEYS,
  type PricingKey,
  type PricingOverrides,
  type TenantPricingSummary,
  type UserContext,
} from "rapid-cortex-shared";
import { AuthorizationService } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import {
  buildChangeEntries,
  PricingAuditRepository,
  PricingConfigRepository,
  TenantPricingRepository,
} from "../repositories/pricingRepository.js";

const authz = new AuthorizationService();
const globalRepo = new PricingConfigRepository();
const tenantRepo = new TenantPricingRepository();
const auditRepo = new PricingAuditRepository();
const agencies = new AgencyRepository();
const cw = new CloudWatchClient({ region: env.region });

function nowIso(): string {
  return new Date().toISOString();
}

function actorLabel(user: UserContext): string {
  return user.email ?? user.userId ?? "unknown";
}

function effectiveOverrides(
  globalOverrides: PricingOverrides,
  tenantOverrides?: PricingOverrides,
): PricingOverrides {
  const out: PricingOverrides = { ...PRICING_DEFAULTS };
  for (const key of PRICING_KEYS) {
    if (globalOverrides[key] !== undefined) out[key] = globalOverrides[key];
    if (tenantOverrides?.[key] !== undefined) out[key] = tenantOverrides[key];
  }
  return out;
}

function mergeOverrides(
  existing: PricingOverrides,
  changes: PricingOverrides,
): PricingOverrides {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(changes)) {
    if (!PRICING_KEYS.includes(key as PricingKey)) continue;
    const defaultVal = PRICING_DEFAULTS[key as PricingKey];
    if (value === defaultVal) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

async function emitPricingMetric(
  scope: "global" | "tenant",
  operation: "update" | "revert",
  changeCount: number,
): Promise<void> {
  try {
    await cw.send(
      new PutMetricDataCommand({
        Namespace: "RapidCortex/PricingAdmin",
        MetricData: [
          {
            MetricName: "PricingChanges",
            Value: changeCount,
            Unit: "Count",
            Timestamp: new Date(),
            Dimensions: [
              { Name: "Scope", Value: scope },
              { Name: "Operation", Value: operation },
            ],
          },
        ],
      }),
    );
  } catch {
    // metrics must not block writes
  }
}

export class PricingAdminService {
  assertTablesConfigured(): void {
    if (!env.pricingConfigTable || !env.tenantPricingOverridesTable || !env.pricingAuditTable) {
      throw new Error("Pricing tables not configured");
    }
  }

  async getGlobal(user: UserContext) {
    authz.assertCanPerform(user, "billing.manage");
    this.assertTablesConfigured();
    const row = await globalRepo.getGlobal();
    const overrides = row?.overrides ?? {};
    return {
      pk: "GLOBAL" as const,
      sk: "v1" as const,
      overrides,
      pricing: effectiveOverrides(overrides),
      version: row?.version ?? 0,
      lastModifiedBy: row?.lastModifiedBy ?? "",
      lastModifiedAt: row?.lastModifiedAt ?? "",
    };
  }

  async putGlobal(user: UserContext, changes: PricingOverrides, reason: string) {
    authz.assertCanPerform(user, "billing.revenue_view");
    this.assertTablesConfigured();

    const existing = await globalRepo.getGlobal();
    const before = existing?.overrides ?? {};
    const after = mergeOverrides(before, changes);
    const changeEntries = buildChangeEntries(before, after);
    if (changeEntries.length === 0) {
      return { ok: true as const, changeCount: 0 };
    }

    const ts = nowIso();
    await globalRepo.putGlobal({
      pk: "GLOBAL",
      sk: "v1",
      overrides: after,
      version: (existing?.version ?? 0) + 1,
      lastModifiedBy: actorLabel(user),
      lastModifiedAt: ts,
    });

    await auditRepo.append({
      ts,
      actor: user.userId,
      actorEmail: user.email,
      scope: "global",
      reason,
      changes: changeEntries,
    });

    console.info("[pricingAdmin] global update", { changeCount: changeEntries.length });
    await emitPricingMetric("global", "update", changeEntries.length);
    return { ok: true as const, changeCount: changeEntries.length };
  }

  async listTenants(user: UserContext): Promise<{ tenants: TenantPricingSummary[] }> {
    authz.assertCanPerform(user, "billing.manage");
    this.assertTablesConfigured();
    const rows = await tenantRepo.listAll();
    const tenants: TenantPricingSummary[] = [];
    for (const row of rows) {
      const agency = await agencies.get(row.agencyId);
      tenants.push({
        agencyId: row.agencyId,
        agencyName: agency?.name ?? row.agencyId,
        plan: agency?.planId,
        overrideCount: Object.keys(row.overrides ?? {}).length,
        lastModifiedAt: row.setAt,
        setBy: row.setBy,
      });
    }
    tenants.sort((a, b) => a.agencyName.localeCompare(b.agencyName));
    return { tenants };
  }

  async getTenant(user: UserContext, agencyId: string) {
    authz.assertCanPerform(user, "billing.manage");
    this.assertTablesConfigured();

    const agency = await agencies.get(agencyId);
    if (!agency) throw new Error("AGENCY_NOT_FOUND");

    const globalRow = await globalRepo.getGlobal();
    const globalOverrides = globalRow?.overrides ?? {};
    const tenantRow = await tenantRepo.get(agencyId);
    const tenantOverrides = tenantRow?.overrides ?? {};

    return {
      pk: `AGENCY#${agencyId}`,
      sk: "PRICING" as const,
      agencyId,
      overrides: tenantOverrides,
      reason: tenantRow?.reason ?? "",
      setBy: tenantRow?.setBy ?? "",
      setAt: tenantRow?.setAt ?? "",
      effectivePricing: effectiveOverrides(globalOverrides, tenantOverrides),
    };
  }

  async putTenant(
    user: UserContext,
    agencyId: string,
    changes: PricingOverrides,
    reason: string,
  ) {
    authz.assertCanPerform(user, "billing.revenue_view");
    this.assertTablesConfigured();

    const agency = await agencies.get(agencyId);
    if (!agency) throw new Error("AGENCY_NOT_FOUND");

    const existing = await tenantRepo.get(agencyId);
    const before = existing?.overrides ?? {};
    const after = mergeOverrides(before, changes);
    const changeEntries = buildChangeEntries(before, after);
    if (changeEntries.length === 0) {
      return { ok: true as const, changeCount: 0 };
    }

    const ts = nowIso();
    await tenantRepo.put({
      pk: `AGENCY#${agencyId}`,
      sk: "PRICING",
      agencyId,
      overrides: after,
      reason,
      setBy: actorLabel(user),
      setAt: ts,
    });

    await auditRepo.append({
      ts,
      actor: user.userId,
      actorEmail: user.email,
      scope: "tenant",
      tenantId: agencyId,
      tenantName: agency.name,
      reason,
      changes: changeEntries,
    });

    console.info("[pricingAdmin] tenant update", {
      agencyId,
      changeCount: changeEntries.length,
    });
    await emitPricingMetric("tenant", "update", changeEntries.length);
    return { ok: true as const, changeCount: changeEntries.length };
  }

  async deleteTenant(user: UserContext, agencyId: string, reason: string) {
    authz.assertCanPerform(user, "billing.revenue_view");
    this.assertTablesConfigured();

    const agency = await agencies.get(agencyId);
    if (!agency) throw new Error("AGENCY_NOT_FOUND");

    const existing = await tenantRepo.get(agencyId);
    const before = existing?.overrides ?? {};
    if (Object.keys(before).length === 0) {
      return { ok: true as const, changeCount: 0 };
    }

    await tenantRepo.delete(agencyId);

    const ts = nowIso();
    const changeEntries = Object.entries(before).map(([key, from]) => ({
      key,
      from,
      to: PRICING_DEFAULTS[key as PricingKey] ?? 0,
    }));

    await auditRepo.append({
      ts,
      actor: user.userId,
      actorEmail: user.email,
      scope: "tenant",
      tenantId: agencyId,
      tenantName: agency.name,
      reason,
      changes: changeEntries,
    });

    console.info("[pricingAdmin] tenant revert all", {
      agencyId,
      changeCount: changeEntries.length,
    });
    await emitPricingMetric("tenant", "revert", changeEntries.length);
    return { ok: true as const, changeCount: changeEntries.length };
  }

  async getAudit(
    user: UserContext,
    params: { scope?: string; agencyId?: string; limit?: number; before?: string },
  ) {
    authz.assertCanPerform(user, "billing.manage");
    this.assertTablesConfigured();
    return auditRepo.query(params);
  }
}

export const pricingAdminService = new PricingAdminService();
