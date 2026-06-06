"use client";

import { useCallback, useEffect, useState } from "react";
import type { HospitalCapacity } from "rapid-cortex-shared";

import { fetchHospitalCapacityHistory } from "@/lib/hospital-portal/api";

export function RecentUpdatesPanel() {
  const [updates, setUpdates] = useState<HospitalCapacity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const items = await fetchHospitalCapacityHistory(10);
      setUpdates(items);
    } catch (e) {
      console.error("Failed to load capacity history", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-lg bg-slate-900 p-6">
      <h3 className="mb-4 text-lg font-semibold text-white">Recent updates</h3>
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : updates.length === 0 ? (
        <p className="text-sm text-slate-400">No updates yet</p>
      ) : (
        <ul className="space-y-3">
          {updates.map((update) => (
            <li key={update.timestamp} className="rounded-lg bg-slate-950 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-slate-400">{new Date(update.timestamp).toLocaleString()}</span>
                {update.diversion.isOnDiversion ? (
                  <span className="text-xs text-red-400">Diversion</span>
                ) : null}
              </div>
              <p className="text-white">
                ER: {update.availability.erBeds.available}/{update.availability.erBeds.total} beds
              </p>
              {update.updatedByName ? (
                <p className="mt-1 text-xs text-slate-500">By {update.updatedByName}</p>
              ) : null}
              {update.updateNotes ? (
                <p className="mt-2 text-xs italic text-slate-400">&ldquo;{update.updateNotes}&rdquo;</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
