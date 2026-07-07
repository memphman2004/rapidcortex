"use client";

import { useState } from "react";
import type { TenantPricingSummary } from "@/lib/pricing/pricing-types";
import { deleteTenantPricing } from "@/lib/pricing/pricing-api";

type PricingTenantSelectorProps = {
  selectedTenant: string;
  tenants: TenantPricingSummary[];
  stagedCount: number;
  onTenantChange: (agencyId: string) => void;
  onRevertAllComplete: () => void;
};

export function PricingTenantSelector({
  selectedTenant,
  tenants,
  stagedCount,
  onTenantChange,
  onRevertAllComplete,
}: PricingTenantSelectorProps) {
  const [confirmName, setConfirmName] = useState("");
  const [showRevert, setShowRevert] = useState(false);

  const selected = tenants.find((t) => t.agencyId === selectedTenant);

  function handleChange(next: string) {
    if (next === selectedTenant) return;
    if (stagedCount > 0) {
      const ok = window.confirm(
        "You have unsaved changes. Discard and switch agency?",
      );
      if (!ok) return;
    }
    onTenantChange(next);
    setShowRevert(false);
    setConfirmName("");
  }

  async function handleRevertAll() {
    if (!selected) return;
    if (confirmName.trim() !== selected.agencyName.trim()) return;
    await deleteTenantPricing(selected.agencyId, `Revert all overrides for ${selected.agencyName}`);
    setShowRevert(false);
    setConfirmName("");
    onRevertAllComplete();
  }

  return (
    <div className="space-y-3">
      <select
        value={selectedTenant}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full max-w-xl rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
      >
        <option value="global">⊙ Global pricing (all agencies)</option>
        <optgroup label="Agency overrides">
          {tenants.map((t) => (
            <option key={t.agencyId} value={t.agencyId}>
              {t.agencyName} ({t.overrideCount} override{t.overrideCount === 1 ? "" : "s"})
            </option>
          ))}
        </optgroup>
      </select>

      {selected && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          <span className="text-amber-100">
            Editing <strong>{selected.agencyName}</strong> · {selected.overrideCount} active
            override{selected.overrideCount === 1 ? "" : "s"}
          </span>
          {!showRevert ? (
            <button
              type="button"
              className="text-xs text-amber-300 underline hover:text-amber-100"
              onClick={() => setShowRevert(true)}
            >
              Revert all to global
            </button>
          ) : (
            <span className="inline-flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder={`Type "${selected.agencyName}" to confirm`}
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white"
              />
              <button
                type="button"
                disabled={confirmName.trim() !== selected.agencyName.trim()}
                className="rounded bg-red-600/80 px-2 py-1 text-xs text-white disabled:opacity-40"
                onClick={() => void handleRevertAll()}
              >
                Confirm revert
              </button>
              <button
                type="button"
                className="text-xs text-slate-500"
                onClick={() => {
                  setShowRevert(false);
                  setConfirmName("");
                }}
              >
                Cancel
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
