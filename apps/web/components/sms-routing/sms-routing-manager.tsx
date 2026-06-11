"use client";

import { useCallback, useEffect, useState } from "react";
import type { SmsRoutingRecord, SmsRoutingVertical } from "rapid-cortex-shared";

function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return e164;
}

type Props = {
  agencyId: string;
  agencyName: string;
  defaultVertical: SmsRoutingVertical;
  canManage: boolean;
  compact?: boolean;
};

export function SmsRoutingManager({
  agencyId,
  agencyName,
  defaultVertical,
  canManage,
  compact = false,
}: Props) {
  const [items, setItems] = useState<SmsRoutingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("Main reporting line");
  const [vertical, setVertical] = useState<SmsRoutingVertical>(defaultVertical);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ agencyId });
      const res = await fetch(`/api/sms-routing?${params}`, { credentials: "include" });
      const body = (await res.json()) as { items?: SmsRoutingRecord[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load SMS numbers");
      setItems(body.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = items.filter((i) => i.active);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sms-routing", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phone.trim(),
          agencyId,
          vertical,
          agencyName,
          label: label.trim(),
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to register number");
      setModalOpen(false);
      setPhone("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to register");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: SmsRoutingRecord, next: boolean) {
    const enc = encodeURIComponent(row.phoneNumber);
    const res = await fetch(`/api/sms-routing/${enc}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: next }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      setError(body.error ?? "Update failed");
      return;
    }
    await load();
  }

  if (compact) {
    if (loading) return <p className="text-xs text-slate-500">Loading SMS numbers…</p>;
    if (active.length === 0) {
      return (
        <p className="text-xs text-amber-200/90">
          No SMS reporting numbers configured — register one in SMS Numbers settings to print on signs.
        </p>
      );
    }
    return (
      <ul className="space-y-1 text-xs text-slate-300">
        {active.map((row) => (
          <li key={row.phoneNumber}>
            Text{" "}
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(row.phoneNumber)}
              className="font-mono text-emerald-300 hover:underline"
            >
              {formatPhoneDisplay(row.phoneNumber)}
            </button>
            {row.label ? ` · ${row.label}` : ""}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Each agency needs a dedicated Twilio number. Incoming texts to that number route to this agency
          automatically — no keywords or prefixes required.
        </p>
        {canManage ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600"
          >
            Add number
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-100">
          No SMS routing configured — texts to shared or unknown numbers will not be routed to this agency.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Vertical</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.phoneNumber} className="border-t border-slate-800/80">
                  <td className="px-3 py-2 font-mono text-slate-200">{formatPhoneDisplay(row.phoneNumber)}</td>
                  <td className="px-3 py-2 text-slate-300">{row.label}</td>
                  <td className="px-3 py-2 capitalize text-slate-400">{row.vertical}</td>
                  <td className="px-3 py-2">
                    {canManage ? (
                      <input
                        type="checkbox"
                        checked={row.active}
                        onChange={(e) => void toggleActive(row, e.target.checked)}
                      />
                    ) : (
                      <span className={row.active ? "text-emerald-400" : "text-slate-500"}>
                        {row.active ? "Yes" : "No"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(row.phoneNumber)}
                      className="text-xs text-sky-400 hover:underline"
                    >
                      Copy E.164
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={(e) => void onAdd(e)}
            className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5"
          >
            <h3 className="text-lg font-semibold text-white">Register SMS number</h3>
            <p className="mt-1 text-xs text-slate-500">Paste the Twilio number in E.164 format (e.g. +17065551234).</p>
            <label className="mt-4 block text-sm text-slate-300">
              Phone number *
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+17065551234"
                className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 font-mono"
              />
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              Label
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5"
              />
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              Vertical
              <select
                value={vertical}
                onChange={(e) => setVertical(e.target.value as SmsRoutingVertical)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5"
              >
                <option value="campus">Campus</option>
                <option value="venue">Venue</option>
                <option value="911">911</option>
                <option value="hospital">Hospital</option>
                <option value="transit">Transit</option>
              </select>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-sky-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
