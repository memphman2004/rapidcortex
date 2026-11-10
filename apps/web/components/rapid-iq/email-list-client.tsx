"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMAIL_LIST_UI_VERTICALS,
  emailListPartitionsForVertical,
  emailListVerticalLabel,
  normalizeEmailListVertical,
  type EmailListEntry,
  type EmailListVertical,
} from "rapid-cortex-shared";
import {
  addEmailListEntry,
  exportEmailListCsv,
  importEmailListCsv,
  listEmailList,
  moveEmailListEntry,
  removeEmailListEntry,
  syncEmailListFromApollo,
} from "@/lib/rapid-iq/email-list-api";
import {
  addNewsletterRecipients,
  listSalesDrafts,
} from "@/lib/rapid-iq/sales-automation-api";

type Props = {
  /** RC admins may remove / suppress; contractors may add and export. */
  canRemove: boolean;
  /** When true, selected rows can be added to the latest Signal newsletter campaign. */
  canAddToSignal?: boolean;
};

const TABS: Array<EmailListVertical | "ALL"> = ["ALL", ...EMAIL_LIST_UI_VERTICALS];

type StatusFilter = "active" | "inactive" | "all";

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function normalizeImportVertical(raw: string): EmailListVertical | null {
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, EmailListVertical> = {
    PSAP: "PSAP",
    RC911: "PSAP",
    "911": "PSAP",
    // Law / fire fall under the PSAP / 911 list.
    LAW_ENFORCEMENT: "PSAP",
    POLICE: "PSAP",
    FIRE_EMS: "PSAP",
    FIRE: "PSAP",
    EMS: "PSAP",
    CAMPUS: "CAMPUS",
    VENUE: "VENUE",
    HOSPITAL: "HOSPITAL",
    TRANSIT: "TRANSIT",
  };
  return aliases[key] ?? null;
}

function isInactive(row: EmailListEntry): boolean {
  return row.unsubscribed === true;
}

function rowKey(row: Pick<EmailListEntry, "vertical" | "email">): string {
  return `${row.vertical}:${row.email}`;
}

export function EmailListClient({ canRemove, canAddToSignal = false }: Props) {
  const [vertical, setVertical] = useState<EmailListVertical | "ALL">("PSAP");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<EmailListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [addVertical, setAddVertical] = useState<EmailListVertical>("PSAP");
  const [busy, setBusy] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

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

  const tabPartitions = useMemo(() => {
    if (vertical === "ALL") return null;
    return new Set(emailListPartitionsForVertical(vertical));
  }, [vertical]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      // PSAP tab includes legacy LAW_ENFORCEMENT / FIRE_EMS partitions.
      if (tabPartitions && !tabPartitions.has(e.vertical)) return false;
      if (statusFilter === "active" && isInactive(e)) return false;
      if (statusFilter === "inactive" && !isInactive(e)) return false;
      if (!q) return true;
      const hay = `${e.email} ${e.name ?? ""} ${e.agencyName ?? ""} ${e.source}`.toLowerCase();
      return hay.includes(q);
    });
  }, [entries, tabPartitions, statusFilter, search]);

  const filteredKeys = useMemo(() => filtered.map(rowKey), [filtered]);

  const selectedVisibleCount = useMemo(
    () => filteredKeys.filter((k) => selectedKeys.has(k)).length,
    [filteredKeys, selectedKeys],
  );

  const allVisibleSelected =
    filteredKeys.length > 0 && selectedVisibleCount === filteredKeys.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  // Drop selections that are no longer in the current filtered view.
  useEffect(() => {
    setSelectedKeys((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(filteredKeys);
      let changed = false;
      const next = new Set<string>();
      for (const key of prev) {
        if (visible.has(key)) next.add(key);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [filteredKeys]);

  const counts = useMemo(() => {
    const scoped =
      tabPartitions == null
        ? entries
        : entries.filter((e) => tabPartitions.has(e.vertical));
    const inactive = scoped.filter(isInactive).length;
    return {
      total: scoped.length,
      active: scoped.length - inactive,
      inactive,
    };
  }, [entries, tabPartitions]);

  function toggleRow(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedKeys((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const key of filteredKeys) next.delete(key);
        return next;
      }
      const next = new Set(prev);
      for (const key of filteredKeys) next.add(key);
      return next;
    });
  }

  function clearSelection() {
    setSelectedKeys(new Set());
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      await addEmailListEntry({
        email: email.trim(),
        vertical: addVertical,
        name: name.trim() || undefined,
      });
      setEmail("");
      setName("");
      setToast(`Added ${email.trim()} to ${emailListVerticalLabel(addVertical)}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate(row: EmailListEntry) {
    if (!canRemove) return;
    if (
      !confirm(
        `Deactivate ${row.email}? They stay on this list (greyed out) and will not receive campaigns.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await removeEmailListEntry({ email: row.email, vertical: row.vertical });
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(rowKey(row));
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deactivate failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivateSelected() {
    if (!canRemove || selectedKeys.size === 0) return;
    const targets = filtered.filter(
      (row) => selectedKeys.has(rowKey(row)) && !isInactive(row),
    );
    if (targets.length === 0) {
      setToast("No active addresses in the current selection.");
      return;
    }
    if (
      !confirm(
        `Deactivate ${targets.length} selected address(es)? They stay on this list (greyed out) and will not receive campaigns.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setToast(null);
    let ok = 0;
    const failures: string[] = [];
    try {
      for (const row of targets) {
        try {
          await removeEmailListEntry({ email: row.email, vertical: row.vertical });
          ok += 1;
        } catch (err) {
          failures.push(
            `${row.email}: ${err instanceof Error ? err.message : "failed"}`,
          );
        }
      }
      clearSelection();
      await load();
      if (failures.length) {
        setError(`Deactivated ${ok}; ${failures.length} failed. ${failures[0]}`);
      } else {
        setToast(`Deactivated ${ok} address(es).`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onAddSelectedToSignal() {
    if (!canAddToSignal || selectedKeys.size === 0) return;
    const targets = filtered.filter(
      (row) => selectedKeys.has(rowKey(row)) && !isInactive(row),
    );
    if (targets.length === 0) {
      setToast("No active addresses in the current selection.");
      return;
    }
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      const drafts = await listSalesDrafts();
      const signalDrafts = drafts
        .filter((d) => d.contentType === "newsletter" && d.status !== "archived")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const draft = signalDrafts[0];
      if (!draft) {
        setError(
          "No Signal newsletter draft found. Publish an edition (or open Sales Automation → Content) so it can sync, then try again.",
        );
        return;
      }
      const label = draft.subject?.trim() || draft.newsletterSlug || draft.draftId;
      if (
        !confirm(
          `Add ${targets.length} selected address(es) to “${label}” as draft recipients?\n\n` +
            "They will not be emailed until you Approve & send Signal in Sales Automation.",
        )
      ) {
        return;
      }
      const result = await addNewsletterRecipients({
        draftId: draft.draftId,
        emails: targets.map((t) => t.email),
      });
      clearSelection();
      setToast(
        `Added ${result.queued} to Signal` +
          (result.skipped ? ` · ${result.skipped} already queued` : "") +
          (result.suppressed ? ` · ${result.suppressed} suppressed` : "") +
          (result.notFound ? ` · ${result.notFound} not on list` : "") +
          ". Finish send from Sales Automation → Campaigns.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add to Signal failed");
    } finally {
      setBusy(false);
    }
  }

  async function onChangeVertical(row: EmailListEntry, next: EmailListVertical) {
    const toVertical = normalizeEmailListVertical(next);
    if (toVertical === row.vertical) return;
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      await moveEmailListEntry({
        email: row.email,
        fromVertical: row.vertical,
        vertical: toVertical,
      });
      setToast(`Moved ${row.email} to ${emailListVerticalLabel(toVertical)}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vertical update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    setBusy(true);
    setError(null);
    try {
      // Export the currently filtered vertical; include status in CSV from API.
      // Client-side also respects Active/Inactive by filtering before download when not ALL status.
      const { csv, count } = await exportEmailListCsv(vertical);
      let out = csv;
      let outCount = count;
      if (statusFilter !== "all") {
        const lines = csv.split(/\r?\n/).filter(Boolean);
        const header = lines[0] ?? "";
        const body = lines.slice(1).filter((line) => {
          const statusCol = line.split(",").at(5)?.replace(/^"|"$/g, "") ?? "";
          if (statusFilter === "active") return statusCol !== "unsubscribed";
          return statusCol === "unsubscribed";
        });
        out = [header, ...body].join("\n");
        outCount = body.length;
      }
      const blob = new Blob([out], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexcortiq-email-list-${String(vertical).toLowerCase()}-${statusFilter}-${outCount}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setToast(
        `Exported ${outCount} ${statusFilter === "all" ? "" : statusFilter + " "}address${outCount === 1 ? "" : "es"} for ${vertical === "ALL" ? "all verticals" : emailListVerticalLabel(vertical)}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function onImportFile(file: File) {
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      const text = await file.text();
      const rawRows = parseCsv(text);
      const rows: Array<{
        email: string;
        vertical: EmailListVertical;
        firstName?: string;
        lastName?: string;
        title?: string;
        agencyName?: string;
        state?: string;
        name?: string;
      }> = [];
      const parseErrors: string[] = [];
      const looksApollo = rawRows.some(
        (r) =>
          Boolean(r["company name"] || r.companyname || r.company) &&
          Boolean(r["first name"] || r.firstname || r.first_name),
      );
      const fallbackVertical = vertical !== "ALL" ? vertical : addVertical;
      for (const raw of rawRows) {
        const emailVal = (raw.email ?? "").trim().toLowerCase();
        const verticalVal =
          normalizeImportVertical(raw.vertical ?? "") ??
          (looksApollo ? fallbackVertical : null);
        if (!emailVal || !verticalVal) {
          parseErrors.push(emailVal || "missing-email");
          continue;
        }
        const firstName = raw.firstname || raw.first_name || raw["first name"] || undefined;
        const lastName = raw.lastname || raw.last_name || raw["last name"] || undefined;
        const agencyName =
          raw.agencyname ||
          raw.agency_name ||
          raw.agency ||
          raw["company name"] ||
          raw.companyname ||
          raw.company ||
          undefined;
        const name =
          raw.name ||
          [firstName, lastName].filter(Boolean).join(" ") ||
          undefined;
        rows.push({
          email: emailVal,
          vertical: verticalVal,
          firstName,
          lastName,
          title: raw.title || undefined,
          agencyName,
          state: raw.state || undefined,
          name,
        });
      }
      if (rows.length === 0) {
        setError(
          `No valid rows. Required columns: email, vertical (or Apollo Company Name with a vertical tab selected). Parse errors: ${parseErrors.length}`,
        );
        return;
      }
      const result = await importEmailListCsv(rows, looksApollo ? "apollo" : "import");
      setToast(
        `Imported ${result.imported}, skipped ${result.skipped} (suppressed/unsubscribed), ${result.errors.length + parseErrors.length} error${result.errors.length + parseErrors.length === 1 ? "" : "s"}.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onApolloSync() {
    if (vertical === "ALL") {
      setError("Pick a vertical tab before Sync from Apollo.");
      return;
    }
    if (!canRemove) return;
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      const { result } = await syncEmailListFromApollo(vertical, true);
      setToast(
        `Apollo sync (${emailListVerticalLabel(vertical)}): scanned ${result.scanned}, imported ${result.imported}, skipped ${result.skipped}, errors ${result.errors}.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apollo sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Filter by product vertical below before exporting or queueing a campaign — only that
        vertical&apos;s <span className="text-slate-300">active</span> addresses receive mail.
        Unsubscribed contacts stay on the list (greyed out) and are never sent to.
      </p>

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
            {tab === "ALL" ? "ALL" : emailListVerticalLabel(tab)}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          {canRemove && vertical !== "ALL" ? (
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => void onApolloSync()}
              className="rounded border border-sky-600/50 px-3 py-1.5 text-xs text-sky-200 hover:border-sky-400 disabled:opacity-50"
            >
              Sync from Apollo
            </button>
          ) : null}
          {canRemove ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onImportFile(file);
                }}
              />
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => fileRef.current?.click()}
                className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-violet-500/40 disabled:opacity-50"
              >
                Import CSV
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void onExport()}
            className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-violet-500/40 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded border border-[#1e2130] bg-[#0a0b0f] p-0.5">
          {(
            [
              { id: "active", label: `Active (${counts.active})` },
              { id: "inactive", label: `Inactive (${counts.inactive})` },
              { id: "all", label: `All (${counts.total})` },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                statusFilter === opt.id
                  ? "bg-slate-700/80 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search email, name, company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[14rem] flex-1 rounded border border-[#1e2130] bg-[#12141c] px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
        />
      </div>

      {error && (
        <p className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}
      {toast && (
        <p className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {toast}
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
          {EMAIL_LIST_UI_VERTICALS.map((v) => (
            <option key={v} value={v}>
              {emailListVerticalLabel(v)}
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

      {selectedVisibleCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
          <span>
            {selectedVisibleCount} selected
            {filteredKeys.length !== selectedVisibleCount
              ? ` of ${filteredKeys.length} shown`
              : ""}
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs text-sky-200/90 underline hover:text-white"
          >
            Clear
          </button>
          {canAddToSignal ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onAddSelectedToSignal()}
              className="rounded border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-200 disabled:opacity-50"
            >
              Add selected to Signal campaign
            </button>
          ) : null}
          {canRemove ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onDeactivateSelected()}
              className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200 disabled:opacity-50"
            >
              Deactivate selected
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded border border-[#1e2130]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#12141c] text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={loading || filteredKeys.length === 0}
                  onChange={toggleSelectAllVisible}
                  aria-label="Select all visible emails"
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-[#0a0b0f] text-sky-500 focus:ring-sky-500/40"
                />
              </th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Vertical</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Added</th>
              {canRemove && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canRemove ? 9 : 8} className="px-3 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={canRemove ? 9 : 8} className="px-3 py-6 text-center text-slate-500">
                  No addresses match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const inactive = isInactive(row);
                const key = rowKey(row);
                const checked = selectedKeys.has(key);
                return (
                  <tr
                    key={key}
                    className={`border-t border-[#1e2130] ${inactive ? "bg-slate-950/40 opacity-55" : ""} ${checked && !inactive ? "bg-sky-950/20" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRow(key)}
                        aria-label={`Select ${row.email}`}
                        className="h-3.5 w-3.5 rounded border-slate-600 bg-[#0a0b0f] text-sky-500 focus:ring-sky-500/40"
                      />
                    </td>
                    <td
                      className={`px-3 py-2 ${inactive ? "text-slate-500 line-through decoration-slate-600" : "text-slate-200"}`}
                    >
                      {row.email}
                    </td>
                    <td className={`px-3 py-2 ${inactive ? "text-slate-600" : "text-slate-400"}`}>
                      {row.name ?? "—"}
                    </td>
                    <td className={`px-3 py-2 ${inactive ? "text-slate-600" : "text-slate-400"}`}>
                      {row.agencyName ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Vertical for ${row.email}`}
                        value={normalizeEmailListVertical(row.vertical)}
                        disabled={busy || inactive}
                        onChange={(e) =>
                          void onChangeVertical(row, e.target.value as EmailListVertical)
                        }
                        className="rounded border border-[#1e2130] bg-[#12141c] px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                      >
                        {EMAIL_LIST_UI_VERTICALS.map((v) => (
                          <option key={v} value={v}>
                            {emailListVerticalLabel(v)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {inactive ? (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Inactive
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300/90">
                          Active
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-2 ${inactive ? "text-slate-600" : "text-slate-500"}`}>
                      {row.source}
                    </td>
                    <td className={`px-3 py-2 ${inactive ? "text-slate-600" : "text-slate-500"}`}>
                      {row.createdAt.slice(0, 10)}
                    </td>
                    {canRemove && (
                      <td className="px-3 py-2 text-right">
                        {!inactive ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onDeactivate(row)}
                            className="text-xs text-amber-300/90 hover:underline disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wide text-slate-600">
                            Unsubscribed
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">
        Showing {filtered.length} of {counts.total} in{" "}
        {vertical === "ALL" ? "all verticals" : emailListVerticalLabel(vertical)}. Campaigns and
        newsletters only send to <strong className="font-medium text-slate-400">Active</strong>{" "}
        addresses. Public unsubscribe link goes out on every campaign email (
        nexcortiq.us/unsubscribe) and greys the contact out here without deleting them.
      </p>
    </div>
  );
}
