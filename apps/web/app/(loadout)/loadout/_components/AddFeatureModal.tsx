"use client";

import { useState } from "react";
import type { LoadoutFeature } from "rapid-cortex-shared/loadout";

interface AddFeatureModalProps {
  feature: LoadoutFeature;
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddFeatureModal({ feature, tenantId, onClose, onSuccess }: AddFeatureModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/loadout/features/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, featureId: feature.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-[#0f1117] p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-white mb-1">Add Feature</h2>
        <p className="text-sm text-slate-400 mb-4">
          Enable <strong className="text-white">{feature.name}</strong> for tenant{" "}
          <code className="text-violet-300 text-xs bg-slate-800 px-1 rounded">{tenantId}</code>?
        </p>
        <div className="rounded-md bg-slate-800/50 p-3 mb-4 text-xs text-slate-400">
          <p>Base: <span className="text-white">${feature.monthlyBaseCents !== null ? (feature.monthlyBaseCents / 100).toFixed(0) : "custom"}/mo</span></p>
          {feature.includedCalls !== null && (
            <p>Included calls: <span className="text-white">{feature.includedCalls.toLocaleString()}</span></p>
          )}
          {feature.overagePer1kCents !== null && (
            <p>Overage: <span className="text-white">${(feature.overagePer1kCents / 100).toFixed(3)}/1k calls</span></p>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-400 mb-3">{error}</p>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm bg-violet-700 text-white rounded hover:bg-violet-600 transition-colors disabled:opacity-50"
          >
            {loading ? "Adding…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
