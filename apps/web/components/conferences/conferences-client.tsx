"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import type {
  Conference,
  ConferenceChangeRecord,
  ConferencePriority,
  CreateConferenceBody,
} from "rapid-cortex-shared";
import {
  CONFERENCES_QUERY_KEY,
  createConference,
  listConferences,
  patchConference,
} from "@/lib/conferences/api";
import {
  conferencePriorityCounts,
  conferencePriorityLabel,
  ensureUsdFeeInput,
  feeForSave,
  filterConferencesByPriority,
  USD_FEE_DEFAULT,
  type ConferencePriorityFilter,
} from "@/lib/conferences/format";
import { ConferenceEditModal } from "./conference-edit-modal";
import { ConferencesTable } from "./conferences-table";

type Props = {
  compact?: boolean;
};

const PRIORITY_FILTERS: ConferencePriorityFilter[] = ["all", "green", "amber", "red"];

function chipClass(id: ConferencePriorityFilter, active: boolean): string {
  if (!active) {
    return "border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300";
  }
  if (id === "green") return "border-emerald-500/60 bg-emerald-500/15 text-emerald-200";
  if (id === "amber") return "border-amber-500/60 bg-amber-500/15 text-amber-200";
  if (id === "red") return "border-red-500/60 bg-red-500/15 text-red-200";
  return "border-sky-500/60 bg-sky-500/10 text-sky-300";
}

function chipLabel(id: ConferencePriorityFilter): string {
  if (id === "all") return "All";
  if (id === "green") return "Going";
  if (id === "amber") return "Maybe";
  return "Not attending";
}

export function ConferencesClient({ compact }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Conference | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<ConferencePriorityFilter>("all");

  const listQ = useQuery({
    queryKey: CONFERENCES_QUERY_KEY,
    queryFn: listConferences,
  });

  const patchM = useMutation({
    mutationFn: ({
      conferenceId,
      payload,
    }: {
      conferenceId: string;
      payload: Parameters<typeof patchConference>[1];
    }) => patchConference(conferenceId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CONFERENCES_QUERY_KEY });
      setEditing(null);
      setError(null);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Update failed");
    },
  });

  const createM = useMutation({
    mutationFn: (payload: CreateConferenceBody) => createConference(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CONFERENCES_QUERY_KEY });
      setAdding(false);
      setError(null);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Create failed");
    },
  });

  function onDismiss(conf: Conference, change: ConferenceChangeRecord) {
    setError(null);
    patchM.mutate({
      conferenceId: conf.conferenceId,
      payload: { action: "dismiss_change", changeId: change.changeId },
    });
  }

  function onApply(conf: Conference, change: ConferenceChangeRecord) {
    setError(null);
    patchM.mutate({
      conferenceId: conf.conferenceId,
      payload: { action: "apply_change", changeId: change.changeId },
    });
  }

  const items = listQ.data ?? [];
  const counts = useMemo(() => conferencePriorityCounts(items), [items]);
  const visible = useMemo(
    () => filterConferencesByPriority(items, priorityFilter),
    [items, priorityFilter],
  );

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#050c1a]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Conferences</h2>
          <p className="text-xs text-slate-500">
            Weekly website check for date, location, and cancellation changes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {compact ? (
            <Link href="/rc-admin/conferences" className="text-xs text-sky-400 hover:text-sky-300">
              View all
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setError(null);
              }}
              className="rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
            >
              Add conference
            </button>
          )}
        </div>
      </div>
      <div
        className="flex flex-wrap gap-1.5 border-b border-white/[0.06] px-4 py-2"
        role="tablist"
        aria-label="Conference priority"
      >
        {PRIORITY_FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={priorityFilter === id}
            title={id === "all" ? "All conferences" : conferencePriorityLabel(id)}
            onClick={() => setPriorityFilter(id)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${chipClass(id, priorityFilter === id)}`}
          >
            {chipLabel(id)} ({counts[id]})
          </button>
        ))}
      </div>

      {listQ.isLoading ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">Loading conferences…</p>
      ) : listQ.isError ? (
        <p className="px-4 py-8 text-center text-sm text-red-400">
          {listQ.error instanceof Error ? listQ.error.message : "Could not load conferences"}
        </p>
      ) : (
        <ConferencesTable
          conferences={visible}
          compact={compact}
          groupByPriority={priorityFilter === "all"}
          emptyLabel={
            priorityFilter === "all" ? "No conferences yet." : "No conferences in this group."
          }
          busyId={patchM.isPending ? patchM.variables?.conferenceId ?? null : null}
          onEdit={setEditing}
          onDismiss={onDismiss}
          onApply={onApply}
        />
      )}

      {error && !editing ? (
        <p className="border-t border-white/[0.06] px-4 py-2 text-xs text-red-400">{error}</p>
      ) : null}

      {editing ? (
        <ConferenceEditModal
          conference={editing}
          busy={patchM.isPending}
          error={error}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            patchM.mutate({
              conferenceId: editing.conferenceId,
              payload: {
                name: patch.name,
                website: patch.website || "",
                sourceUrl: patch.sourceUrl,
                startDate: patch.startDate,
                endDate: patch.endDate || undefined,
                location: patch.location,
                venue: patch.venue || undefined,
                registrationFee: patch.registrationFee || null,
                boothFee: patch.boothFee || null,
                registrationDeadline: patch.registrationDeadline || null,
                priority: patch.priority,
                autoUpdateEnabled: patch.autoUpdateEnabled,
              },
            });
          }}
        />
      ) : null}

      {adding ? (
        <AddConferenceModal
          busy={createM.isPending}
          error={error}
          onClose={() => setAdding(false)}
          onSave={(payload) => createM.mutate(payload)}
        />
      ) : null}
    </div>
  );
}

function AddConferenceModal({
  busy,
  error,
  onClose,
  onSave,
}: {
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: CreateConferenceBody) => void;
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [venue, setVenue] = useState("");
  const [registrationFee, setRegistrationFee] = useState(USD_FEE_DEFAULT);
  const [boothFee, setBoothFee] = useState(USD_FEE_DEFAULT);
  const [priority, setPriority] = useState<ConferencePriority>("amber");

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <form
        className="w-full max-w-lg space-y-3 rounded-2xl border border-white/10 bg-[#0b1220] p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const site = website.trim();
          const source = sourceUrl.trim();
          if (!site && !source) return;
          onSave({
            name: name.trim(),
            website: site || undefined,
            sourceUrl: source || undefined,
            startDate: startDate.trim(),
            endDate: endDate.trim() || undefined,
            location: location.trim(),
            venue: venue.trim() || undefined,
            registrationFee: feeForSave(registrationFee) || undefined,
            boothFee: feeForSave(boothFee) || undefined,
            priority,
            autoUpdateEnabled: true,
          });
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Add conference</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-white">
            Close
          </button>
        </div>
        <label className="block text-xs text-slate-400">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Website
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            required={!sourceUrl.trim()}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Source URL (optional override)
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-slate-400">
            Start date
            <input
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              placeholder="YYYY-MM-DD or TBD"
              className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            End date
            <input
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <label className="block text-xs text-slate-400">
          Location
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Venue
          <input
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-slate-400">
            Registration fee
            <input
              value={registrationFee}
              onChange={(e) => setRegistrationFee(ensureUsdFeeInput(e.target.value))}
              inputMode="decimal"
              placeholder="$"
              className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Booth fee
            <input
              value={boothFee}
              onChange={(e) => setBoothFee(ensureUsdFeeInput(e.target.value))}
              inputMode="decimal"
              placeholder="$"
              className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <label className="block text-xs text-slate-400">
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as ConferencePriority)}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
          >
            <option value="green">{conferencePriorityLabel("green")}</option>
            <option value="amber">{conferencePriorityLabel("amber")}</option>
            <option value="red">{conferencePriorityLabel("red")}</option>
          </select>
        </label>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}
