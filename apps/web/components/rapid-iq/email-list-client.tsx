"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EMAIL_LIST_VERTICALS,
  type EmailListEntry,
  type EmailListVertical,
} from "rapid-cortex-shared";
import {
  addEmailListEntry,
  exportEmailListCsv,
  listEmailList,
  removeEmailListEntry,
} from "@/lib/rapid-iq/email-list-api";

type Props = {
  /** RC admins may remove / suppress; contractors may add and export. */
  canRemove: boolean;
};

const TABS: Array<EmailListVertical | "ALL"> = ["ALL", ...EMAIL_LIST_VERTICALS];

export function EmailListClient({ canRemove }: Props) {
  const [vertical, setVertical] = useState<EmailListVertical | "ALL">("PSAP");
  const [entries, setEntries] = useState<EmailListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [addVertical, setAddVertical] = useState<EmailListVertical>("PSAP");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listEmailList(vertical);
      setEntries(res.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load list");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [vertical]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (vertical === "ALL") return entries;
    return entries.filter((e) => e.vertical === vertical);
  }, [entries, vertical]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addEmailListEntry({
        email: email.trim(),
        vertical: addVertical,
        name: name.trim() || undefined,
      });
      setEmail("");
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(row: EmailListEntry) {
    if (!canRemove) return;
    if (!confirm(`Remove ${row.email} from ${row.vertical} and suppress sends?`)) return;
    setBusy(true);
    setError(null);
    try {
      await removeEmailListEntry({ email: row.email, vertical: row.vertical });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    setBusy(true);
    setError(null);
    try {
      const { csv, count } = await exportEmailListCsv(vertical);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexcortiq-email-list-${vertical.toLowerCase()}-${count}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setVertical(tab)}
            className={`rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
              vertical === tab
                ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/40"
                : "bg-[#12141c] text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab}
          </button>
        ))}
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void onExport()}
          className="ml-auto rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-violet-500/40 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {error && (
        <p className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => void onAdd(e)}
        className="grid gap-2 rounded border border-[#1e2130] bg-[#0a0b0f] p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
      >
        <input
          type="email"
          required
          placeholder="email@agency.gov"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-[#1e2130] bg-[#12141c] px-2.5 py-1.5 text-sm text-slate-200"
        />
        <input
          type="text"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-[#1e2130] bg-[#12141c] px-2.5 py-1.5 text-sm text-slate-200"
        />
        <select
          value={addVertical}
          onChange={(e) => setAddVertical(e.target.value as EmailListVertical)}
          className="rounded border border-[#1e2130] bg-[#12141c] px-2.5 py-1.5 text-sm text-slate-200"
        >
          {EMAIL_LIST_VERTICALS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy}
          className="rounded border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 disabled:opacity-50"
        >
          Add email
        </button>
      </form>

      <div className="overflow-hidden rounded border border-[#1e2130]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#12141c] text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Vertical</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Added</th>
              {canRemove && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canRemove ? 6 : 5} className="px-3 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={canRemove ? 6 : 5} className="px-3 py-6 text-center text-slate-500">
                  No subscribers in this vertical yet.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={`${row.vertical}:${row.email}`} className="border-t border-[#1e2130]">
                  <td className="px-3 py-2 text-slate-200">{row.email}</td>
                  <td className="px-3 py-2 text-slate-400">{row.name ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-400">{row.vertical}</td>
                  <td className="px-3 py-2 text-slate-500">{row.source}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {row.createdAt.slice(0, 10)}
                  </td>
                  {canRemove && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onRemove(row)}
                        className="text-xs text-rose-300 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">
        {filtered.length} address{filtered.length === 1 ? "" : "es"}. Public unsubscribe clears
        the list and unchecks Save contact on PSAP Prospects.
      </p>
    </div>
  );
}
