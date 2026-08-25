"use client";

import { useState } from "react";
import type { Conference, ConferencePriority } from "rapid-cortex-shared";
import { conferencePriority, conferenceSourceUrl } from "rapid-cortex-shared";
import { conferencePriorityLabel, formatCheckedExact } from "@/lib/conferences/format";

type Props = {
  conference: Conference;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (patch: {
    autoUpdateEnabled: boolean;
    sourceUrl: string;
    name: string;
    website: string;
    startDate: string;
    endDate: string;
    location: string;
    venue: string;
    registrationFee: string;
    boothFee: string;
    registrationDeadline: string;
    priority: ConferencePriority;
  }) => void;
};

export function ConferenceEditModal({ conference, busy, error, onClose, onSave }: Props) {
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(conference.autoUpdateEnabled !== false);
  const [sourceUrl, setSourceUrl] = useState(conferenceSourceUrl(conference));
  const [name, setName] = useState(conference.name);
  const [website, setWebsite] = useState(conference.website ?? "");
  const [startDate, setStartDate] = useState(conference.startDate);
  const [endDate, setEndDate] = useState(conference.endDate ?? "");
  const [location, setLocation] = useState(conference.location);
  const [venue, setVenue] = useState(conference.venue ?? "");
  const [registrationFee, setRegistrationFee] = useState(conference.registrationFee ?? "");
  const [boothFee, setBoothFee] = useState(conference.boothFee ?? "");
  const [registrationDeadline, setRegistrationDeadline] = useState(
    conference.registrationDeadline ?? "",
  );
  const [priority, setPriority] = useState<ConferencePriority>(conferencePriority(conference));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b1220] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Edit conference</h2>
            <p className="mt-1 text-xs text-slate-500">{conference.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-white">
            Close
          </button>
        </div>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              autoUpdateEnabled,
              sourceUrl: sourceUrl.trim(),
              name: name.trim(),
              website: website.trim(),
              startDate: startDate.trim(),
              endDate: endDate.trim(),
              location: location.trim(),
              venue: venue.trim(),
              registrationFee: registrationFee.trim(),
              boothFee: boothFee.trim(),
              registrationDeadline: registrationDeadline.trim(),
              priority,
            });
          }}
        >
          <label className="block text-xs text-slate-400">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-400">
              Start date
              <input
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
                required
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
              className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
              required
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
                onChange={(e) => setRegistrationFee(e.target.value)}
                placeholder="e.g. $425 member"
                className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-slate-400">
              Booth fee
              <input
                value={boothFee}
                onChange={(e) => setBoothFee(e.target.value)}
                placeholder="e.g. $1,200 10x10"
                className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
          <label className="block text-xs text-slate-400">
            Website
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Registration deadline
            <input
              value={registrationDeadline}
              onChange={(e) => setRegistrationDeadline(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
            />
          </label>
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

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Auto-update
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoUpdateEnabled}
              onClick={() => setAutoUpdateEnabled((v) => !v)}
              className="mt-2 flex w-full items-start gap-3 text-left"
            >
              <span
                className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border ${
                  autoUpdateEnabled
                    ? "border-sky-500/60 bg-sky-600"
                    : "border-white/15 bg-slate-700"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white transition ${
                    autoUpdateEnabled ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </span>
              <span className="text-sm text-slate-200">
                Automatically check this website for date/location changes
              </span>
            </button>
            <p className="mt-2 text-[11px] text-slate-500">
              Last checked: {formatCheckedExact(conference.lastChecked)}
            </p>
            <label className="mt-2 block text-xs text-slate-400">
              Source URL
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www.apco2026.org"
                className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
              />
            </label>
            <p className="mt-1 text-[11px] text-slate-600">
              Override when the dates live on a subpage rather than the homepage.
            </p>
          </div>

          {error ? <p className="text-xs text-red-400">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
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
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
