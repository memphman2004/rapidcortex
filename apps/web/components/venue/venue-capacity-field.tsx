"use client";

import { useEffect, useState } from "react";

export function VenueCapacityField({
  venueCode,
  initialCapacity = 0,
}: {
  venueCode: string;
  initialCapacity?: number;
}) {
  const [capacity, setCapacity] = useState(initialCapacity);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/venue/code/${venueCode}/profile`);
        if (!res.ok) return;
        const data = (await res.json()) as { profile?: { capacity?: number } };
        if (!cancelled && typeof data.profile?.capacity === "number") {
          setCapacity(data.profile.capacity);
        }
      } catch {
        // Profile may not exist yet for new venues.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [venueCode]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/venue/code/${venueCode}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save capacity");
      setMessage("Saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3 md:col-span-2">
      <label className="text-xs uppercase tracking-wide text-slate-500" htmlFor="venue-capacity">
        Venue Capacity
      </label>
      <p className="mt-1 text-xs text-slate-500">
        Total seated capacity including all levels and suites. Used for live gate-count percentage on the ops dashboard.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          id="venue-capacity"
          type="number"
          min={0}
          value={capacity}
          onChange={(event) => setCapacity(parseInt(event.target.value, 10) || 0)}
          placeholder="71000"
          className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save capacity"}
        </button>
        {message && <span className="text-xs text-slate-400">{message}</span>}
      </div>
    </div>
  );
}
