"use client";

import { useCallback, useMemo, useState } from "react";
import { PRICING_DEFAULTS, type PricingKey } from "@/lib/pricing/pricing-defaults";
import type { GlobalPricingConfig, PricingOverrides, TenantPricingSummary } from "@/lib/pricing/pricing-types";
import {
  effectivePrice,
  isGlobalOverride,
  isTenantOverride,
} from "@/lib/pricing/pricing-resolver";
import {
  fetchGlobalPricing,
  fetchTenantPricing,
  fetchTenants,
  putGlobalPricing,
  putTenantPricing,
} from "@/lib/pricing/pricing-api";
import { PricingPlansTab } from "@/components/admin/pricing/pricing-plans-tab";
import { PricingVerticalsTab } from "@/components/admin/pricing/pricing-verticals-tab";
import { PricingCadTab } from "@/components/admin/pricing/pricing-cad-tab";
import { PricingAddonsTab } from "@/components/admin/pricing/pricing-addons-tab";
import { PricingAuditTab } from "@/components/admin/pricing/pricing-audit-tab";
import { PricingSaveBar } from "@/components/admin/pricing/pricing-save-bar";
import { PricingTenantSelector } from "@/components/admin/pricing/pricing-tenant-selector";
import type { PriceFieldProps } from "@/components/admin/pricing/price-field";

type TabId = "plans" | "verticals" | "cad" | "addons" | "audit";

type Props = {
  initialGlobal: GlobalPricingConfig & { pricing?: PricingOverrides };
  initialTenants: TenantPricingSummary[];
};

export function PricingDashboardClient({ initialGlobal, initialTenants }: Props) {
  const [tab, setTab] = useState<TabId>("plans");
  const [editMode, setEditMode] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<string>("global");
  const [globalOverrides, setGlobalOverrides] = useState<PricingOverrides>(
    initialGlobal.overrides ?? {},
  );
  const [tenantOverrides, setTenantOverrides] = useState<PricingOverrides>({});
  const [tenantList, setTenantList] = useState<TenantPricingSummary[]>(initialTenants);
  const [staged, setStaged] = useState<PricingOverrides>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [lastModifiedAt, setLastModifiedAt] = useState(initialGlobal.lastModifiedAt ?? "");
  const [lastModifiedBy, setLastModifiedBy] = useState(initialGlobal.lastModifiedBy ?? "");

  const targetLabel = useMemo(() => {
    if (selectedTenant === "global") return "global pricing";
    const t = tenantList.find((x) => x.agencyId === selectedTenant);
    return t?.agencyName ?? "tenant";
  }, [selectedTenant, tenantList]);

  const refreshTenants = useCallback(async () => {
    const data = await fetchTenants();
    setTenantList(data.tenants);
  }, []);

  const onStage = useCallback(
    (key: string, value: number) => {
      const effective = effectivePrice(
        key as PricingKey,
        globalOverrides,
        selectedTenant === "global" ? undefined : tenantOverrides,
      );
      setStaged((prev: PricingOverrides) => {
        const next = { ...prev };
        if (value === effective) {
          delete next[key];
        } else {
          next[key] = value;
        }
        return next;
      });
    },
    [globalOverrides, tenantOverrides, selectedTenant],
  );

  const onRevert = useCallback(
    async (key: string) => {
      setStaged((prev: PricingOverrides) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      const defaultVal = PRICING_DEFAULTS[key as PricingKey];
      if (defaultVal === undefined) return;

      try {
        if (selectedTenant === "global") {
          await putGlobalPricing({ [key]: defaultVal }, "Single field revert");
          setGlobalOverrides((prev: PricingOverrides) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        } else {
          await putTenantPricing(
            selectedTenant,
            { [key]: defaultVal },
            "Single field revert",
          );
          setTenantOverrides((prev: PricingOverrides) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          await refreshTenants();
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Revert failed");
      }
    },
    [selectedTenant, refreshTenants],
  );

  const onSave = useCallback(
    async (reason: string) => {
      setSaving(true);
      setSaveError(null);
      try {
        if (selectedTenant === "global") {
          await putGlobalPricing(staged, reason);
          setGlobalOverrides((prev: PricingOverrides) => {
            const merged = { ...prev, ...staged };
            for (const [k, v] of Object.entries(staged)) {
              if (v === PRICING_DEFAULTS[k as PricingKey]) delete merged[k];
            }
            return merged;
          });
          const refreshed = await fetchGlobalPricing();
          setLastModifiedAt(refreshed.lastModifiedAt ?? "");
          setLastModifiedBy(refreshed.lastModifiedBy ?? "");
        } else {
          await putTenantPricing(selectedTenant, staged, reason);
          setTenantOverrides((prev) => ({ ...prev, ...staged }));
          await refreshTenants();
        }
        setStaged({});
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [selectedTenant, staged, refreshTenants],
  );

  const onTenantChange = useCallback(
    async (agencyId: string) => {
      setSelectedTenant(agencyId);
      setStaged({});
      if (agencyId === "global") {
        setTenantOverrides({});
        return;
      }
      const data = await fetchTenantPricing(agencyId);
      setTenantOverrides(data.overrides ?? {});
    },
    [],
  );

  const getFieldProps = useCallback(
    (key: string, opts?: { decimals?: number; suffix?: string }) => {
      const pk = key as PricingKey;
      const effective = effectivePrice(
        pk,
        globalOverrides,
        selectedTenant === "global" ? undefined : tenantOverrides,
      );
      const defaultValue = PRICING_DEFAULTS[pk];
      const stagedValue = staged[key];
      const displayEffective = stagedValue ?? effective;

      return {
        stagedValue,
        effectiveValue: displayEffective,
        defaultValue,
        isGlobalOverride: isGlobalOverride(pk, globalOverrides),
        isTenantOverride: isTenantOverride(pk, tenantOverrides),
        decimals: opts?.decimals,
        suffix: opts?.suffix,
      } satisfies Omit<PriceFieldProps, "priceKey" | "editMode" | "onStage" | "onRevert">;
    },
    [globalOverrides, tenantOverrides, staged, selectedTenant],
  );

  const tabProps = {
    editMode,
    globalOverrides,
    tenantOverrides: selectedTenant === "global" ? undefined : tenantOverrides,
    staged,
    onStage,
    onRevert: (key: string) => void onRevert(key),
    getFieldProps,
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "plans", label: "Plans" },
    { id: "verticals", label: "Verticals" },
    { id: "cad", label: "CAD" },
    { id: "addons", label: "Add-ons" },
    { id: "audit", label: "Audit" },
  ];

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Pricing configuration</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Master guide defaults with global and per-agency overrides. All changes require a
            reason and are recorded in the immutable audit log.
          </p>
          {lastModifiedAt ? (
            <p className="mt-1 text-xs text-slate-500">
              Last changed{" "}
              {new Date(lastModifiedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZoneName: "short",
              })}
              {lastModifiedBy ? ` · ${lastModifiedBy}` : ""}
            </p>
          ) : null}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={editMode}
            onChange={(e) => setEditMode(e.target.checked)}
            className="rounded border-slate-600"
          />
          Edit mode
        </label>
      </div>

      <PricingTenantSelector
        selectedTenant={selectedTenant}
        tenants={tenantList}
        stagedCount={Object.keys(staged).length}
        onTenantChange={(id) => void onTenantChange(id)}
        onRevertAllComplete={() => {
          void refreshTenants();
          if (selectedTenant !== "global") {
            void onTenantChange(selectedTenant);
          }
        }}
      />

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "plans" && <PricingPlansTab {...tabProps} />}
      {tab === "verticals" && <PricingVerticalsTab {...tabProps} />}
      {tab === "cad" && <PricingCadTab {...tabProps} />}
      {tab === "addons" && <PricingAddonsTab {...tabProps} />}
      {tab === "audit" && (
        <PricingAuditTab
          tenants={tenantList}
          onSelectTenant={(id) => {
            setTab("plans");
            void onTenantChange(id);
          }}
          onTenantsRefresh={refreshTenants}
        />
      )}

      <PricingSaveBar
        changeCount={Object.keys(staged).length}
        targetLabel={targetLabel}
        saving={saving}
        saveError={saveError}
        savedFlash={savedFlash}
        onDiscard={() => setStaged({})}
        onSave={(reason) => void onSave(reason)}
      />
    </div>
  );
}
