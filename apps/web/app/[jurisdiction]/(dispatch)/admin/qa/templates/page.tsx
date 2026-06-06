"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  deleteQaTemplate,
  fetchQaTemplates,
  isApiConfigured,
  patchQaTemplate,
  postQaTemplate,
} from "@/lib/api";
import { isQaScoringEnabled } from "@/lib/runtime-flags";

type Row = { id: string; label: string; weight: string };

function emptyRow(): Row {
  return { id: `line_${Math.random().toString(36).slice(2, 10)}`, label: "", weight: "1" };
}

export default function AdminQaTemplatesPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["qa-templates"],
    queryFn: fetchQaTemplates,
    enabled: isQaScoringEnabled() && isApiConfigured(),
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLoad = isQaScoringEnabled() && isApiConfigured();

  const sorted = useMemo(
    () => [...(q.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [q.data],
  );

  const addRow = () => setRows((r) => [...r, emptyRow()]);

  const createTemplate = async () => {
    setError(null);
    const checklistItems = rows
      .map((r) => ({
        id: r.id.trim(),
        label: r.label.trim(),
        weight: r.weight.trim() === "" ? undefined : Number.parseFloat(r.weight),
      }))
      .filter((r) => r.id.length > 0 && r.label.length > 0);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (checklistItems.length === 0) {
      setError("Add at least one checklist line with id and label.");
      return;
    }
    for (const c of checklistItems) {
      if (c.weight != null && (Number.isNaN(c.weight) || c.weight < 0)) {
        setError(`Invalid weight for ${c.id}`);
        return;
      }
    }
    setSaving(true);
    try {
      await postQaTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        checklistItems,
      });
      setName("");
      setDescription("");
      setRows([emptyRow()]);
      await qc.invalidateQueries({ queryKey: ["qa-templates"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const removeTemplate = async (templateId: string) => {
    if (!globalThis.confirm("Delete this QA template?")) return;
    setError(null);
    try {
      await deleteQaTemplate(templateId);
      await qc.invalidateQueries({ queryKey: ["qa-templates"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const bumpLabel = async (templateId: string, nextLabel: string) => {
    setError(null);
    try {
      await patchQaTemplate(templateId, { name: nextLabel });
      await qc.invalidateQueries({ queryKey: ["qa-templates"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  if (!isQaScoringEnabled()) {
    return (
      <div className="p-6 text-sm text-slate-400">
        QA scoring is not enabled for this agency configuration. Contact your administrator to enable this feature.
      </div>
    );
  }

  if (!isApiConfigured()) {
    return <div className="p-6 text-sm text-slate-400">Configure the API (auth proxy or NEXT_PUBLIC_API_BASE).</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-white">QA protocol templates</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Checklists used for structured Bedrock scoring. Dispatchers pick a template when starting a QA session on
          the dashboard.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold text-white">Create template</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-slate-400">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            />
          </label>
          <label className="text-xs text-slate-400">
            Description (optional)
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            />
          </label>
        </div>
        <div className="mt-4">
          <div className="text-xs font-medium text-slate-500">Checklist lines</div>
          <ul className="mt-2 space-y-2">
            {rows.map((r, idx) => (
              <li key={r.id + idx} className="flex flex-wrap gap-2">
                <input
                  placeholder="id"
                  value={r.id}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, id: e.target.value } : x)))
                  }
                  className="w-28 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100"
                />
                <input
                  placeholder="label"
                  value={r.label}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                  }
                  className="min-w-[12rem] flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                />
                <input
                  placeholder="weight"
                  value={r.weight}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, weight: e.target.value } : x)))
                  }
                  className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                  className="rounded-md px-2 text-xs text-slate-500 hover:text-rose-300"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={addRow} className="mt-2 text-xs font-medium text-sky-400 hover:text-sky-300">
            + Add line
          </button>
        </div>
        <button
          type="button"
          disabled={saving || !canLoad}
          onClick={() => void createTemplate()}
          className="mt-4 rounded-md bg-amber-900/40 px-3 py-2 text-sm font-medium text-amber-100 ring-1 ring-amber-800 hover:bg-amber-900/60 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Create template"}
        </button>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-white">Existing templates</h2>
        {q.isLoading ? <p className="mt-2 text-sm text-slate-500">Loading…</p> : null}
        {q.isError ? (
          <p className="mt-2 text-sm text-rose-300">{q.error instanceof Error ? q.error.message : "Load failed"}</p>
        ) : null}
        <ul className="mt-3 divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950/40">
          {sorted.map((t) => (
            <li key={t.templateId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <TemplateNameEditor
                  initialName={t.name}
                  onCommit={(next) => void bumpLabel(t.templateId, next)}
                />
                <p className="mt-1 font-mono text-[10px] text-slate-600">{t.templateId}</p>
                {t.description ? <p className="mt-1 text-xs text-slate-500">{t.description}</p> : null}
                <p className="mt-1 text-[11px] text-slate-600">
                  v{t.version} · {t.checklistItems.length} lines
                </p>
              </div>
              <button
                type="button"
                onClick={() => void removeTemplate(t.templateId)}
                className="shrink-0 self-start rounded-md bg-slate-900 px-2 py-1 text-xs text-rose-300 ring-1 ring-slate-800 hover:bg-slate-800"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TemplateNameEditor({ initialName, onCommit }: { initialName: string; onCommit: (next: string) => void }) {
  const [value, setValue] = useState(initialName);
  useEffect(() => {
    setValue(initialName);
  }, [initialName]);
  const dirty = value !== initialName;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm font-medium text-white"
      />
      <button
        type="button"
        disabled={!dirty || value.trim().length < 2}
        onClick={() => onCommit(value.trim())}
        className="rounded-md bg-slate-800 px-2 py-1 text-xs text-sky-300 ring-1 ring-slate-700 disabled:opacity-40"
      >
        Rename
      </button>
    </div>
  );
}
