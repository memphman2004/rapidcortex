"use client";

import { useState } from "react";
import type { LoadoutKeyRecord } from "rapid-cortex-shared/loadout";

interface KeysClientProps {
  keys: LoadoutKeyRecord[];
  tenantId: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-900 text-emerald-300",
  suspended: "bg-yellow-900 text-yellow-300",
  revoked: "bg-red-900 text-red-300",
};

export function KeysClient({ keys, tenantId }: KeysClientProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  async function handleProvision() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/loadout/features", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      // Provisioning via admin scripts only; show guidance
      setNewKey("Use scripts/provision-loadout-key.ts to generate a new key securely.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          API keys for tenant <code className="text-violet-300 text-xs bg-slate-800 px-1 rounded">{tenantId || "—"}</code>
        </p>
        <button
          onClick={handleProvision}
          disabled={loading}
          className="px-3 py-1.5 text-xs bg-violet-700 text-white rounded hover:bg-violet-600 transition-colors disabled:opacity-50"
        >
          {loading ? "…" : "Provision Key"}
        </button>
      </div>

      {newKey && (
        <div className="rounded-md border border-violet-700 bg-violet-950/40 px-4 py-3 text-xs text-violet-300">
          {newKey}
        </div>
      )}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {keys.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-5 py-8 text-center text-sm text-slate-400">
          No API keys provisioned yet. Use <code className="text-violet-300">scripts/provision-loadout-key.ts</code> to create one.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Tier</th>
                <th className="text-left px-4 py-3 font-medium">Features</th>
                <th className="text-right px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.keyHash} className="border-b border-slate-800/50 text-slate-300 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{key.keyName}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[key.status] ?? "bg-slate-700 text-slate-300"}`}>
                      {key.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{key.tier}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {key.enabledFeatures.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
