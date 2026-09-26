"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronLeft, ChevronRight, Plus, Users, X } from "lucide-react";
import type { EventType, PublicEvent } from "rapid-cortex-shared";
import { featureSuiteFetch } from "@/lib/feature-suite-client";

const SURFACE = "bg-[#161b2e] border border-[#1e2130]";
const INPUT =
  "rounded-md border border-[#1e2130] bg-[#0f1117] px-3 py-2 text-sm text-[#e2e4ea] placeholder:text-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#378ADD]";

const EVENT_COLORS: Record<string, string> = {
  sporting_event: "bg-[#378ADD]",
  concert: "bg-[#7C3AED]",
  festival: "bg-[#1D9E75]",
  marathon: "bg-[#1D9E75]",
  parade: "bg-[#1D9E75]",
  extreme_weather: "bg-[#EF9F27]",
  fireworks: "bg-[#EF9F27]",
  other: "bg-slate-500",
};

const EVENT_TYPES: EventType[] = [
  "sporting_event",
  "concert",
  "festival",
  "marathon",
  "parade",
  "political_rally",
  "fireworks",
  "graduation",
  "fair_expo",
  "extreme_weather",
  "holiday",
  "other",
];

type Props = { jurisdiction: string; agencyId: string };

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function EventsClient({ agencyId }: Props) {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<PublicEvent | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [acked, setAcked] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    name: "",
    eventType: "sporting_event" as EventType,
    venue: "",
    street: "",
    lat: "",
    lon: "",
    expectedAttendance: "",
    startAt: "",
    endAt: "",
    sourceUrl: "",
  });

  const query = useQuery({
    queryKey: ["feature-events", agencyId],
    queryFn: () => featureSuiteFetch<{ events: PublicEvent[] }>("events"),
  });

  const events = useMemo(() => {
    const list = [...(query.data?.events ?? [])];
    list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return list;
  }, [query.data]);

  const createMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        eventType: form.eventType,
        venue: form.venue.trim() || undefined,
        expectedAttendance: form.expectedAttendance
          ? Number(form.expectedAttendance)
          : undefined,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        sourceUrl: form.sourceUrl.trim() || undefined,
      };
      if (form.street.trim() && form.lat && form.lon) {
        body.address = {
          street: form.street.trim(),
          lat: Number(form.lat),
          lon: Number(form.lon),
        };
      }
      return featureSuiteFetch<{ eventId: string; surgeModel: PublicEvent["surgeModel"] }>(
        "events",
        { method: "POST", body: JSON.stringify(body) },
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feature-events", agencyId] });
      setShowCreate(false);
      setForm({
        name: "",
        eventType: "sporting_event",
        venue: "",
        street: "",
        lat: "",
        lon: "",
        expectedAttendance: "",
        startAt: "",
        endAt: "",
        sourceUrl: "",
      });
    },
  });

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const firstDow = startOfMonth(cursor).getDay();
  const dim = daysInMonth(cursor);
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: dim }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
  ];

  const eventsOnDay = (day: Date) =>
    events.filter((e) => sameDay(new Date(e.startAt), day));

  return (
    <div className="min-h-full bg-[#0f1117] p-4 text-[#e2e4ea] md:p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Event Preparedness</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">
            Calendar of upcoming events with surge models and staffing recommendations.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#1D9E75] px-3 py-2 text-sm font-medium text-white"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-4 w-4" />
          Add event
        </button>
      </header>

      {showCreate ? (
        <div className={`${SURFACE} mb-4 space-y-3 rounded-lg p-4`}>
          <h2 className="text-sm font-semibold">New public event</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className={INPUT}
              placeholder="Event name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <select
              className={INPUT}
              value={form.eventType}
              onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value as EventType }))}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <input
              className={INPUT}
              placeholder="Venue"
              value={form.venue}
              onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
            />
            <input
              className={INPUT}
              placeholder="Expected attendance"
              type="number"
              min={0}
              value={form.expectedAttendance}
              onChange={(e) => setForm((f) => ({ ...f, expectedAttendance: e.target.value }))}
            />
            <input
              className={INPUT}
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
            />
            <input
              className={INPUT}
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
            />
            <input
              className={`${INPUT} md:col-span-2`}
              placeholder="Address street (optional)"
              value={form.street}
              onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
            />
            <input
              className={INPUT}
              placeholder="Lat"
              value={form.lat}
              onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
            />
            <input
              className={INPUT}
              placeholder="Lon"
              value={form.lon}
              onChange={(e) => setForm((f) => ({ ...f, lon: e.target.value }))}
            />
            <input
              className={`${INPUT} md:col-span-2`}
              placeholder="Source URL (optional)"
              value={form.sourceUrl}
              onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md bg-[#378ADD] px-3 py-1.5 text-sm text-white disabled:opacity-50"
              disabled={
                !form.name.trim() || !form.startAt || !form.endAt || createMut.isPending
              }
              onClick={() => createMut.mutate()}
            >
              Create (generates surge model)
            </button>
            <button
              type="button"
              className="rounded-md bg-[#1a2035] px-3 py-1.5 text-sm text-[#9ca3af]"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
          </div>
          {createMut.isError ? (
            <p className="text-xs text-[#E24B4A]">{(createMut.error as Error).message}</p>
          ) : null}
          {createMut.isSuccess && createMut.data.surgeModel ? (
            <p className="text-xs text-emerald-300">
              Surge model ready: ~{createMut.data.surgeModel.predictedCallVolume} additional calls
              (CI {createMut.data.surgeModel.confidenceInterval[0]}–
              {createMut.data.surgeModel.confidenceInterval[1]})
            </p>
          ) : null}
        </div>
      ) : null}

      <section className={`${SURFACE} mb-6 rounded-lg p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className="rounded p-1 hover:bg-[#1a2035]"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
            }
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <Calendar className="h-4 w-4 text-[#378ADD]" />
            {monthLabel}
          </h2>
          <button
            type="button"
            className="rounded p-1 hover:bg-[#1a2035]"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
            }
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-[#6b7280]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => (
            <div
              key={idx}
              className="min-h-[72px] rounded border border-[#1e2130]/60 bg-[#0f1117] p-1"
            >
              {day ? (
                <>
                  <div className="text-[11px] text-[#6b7280]">{day.getDate()}</div>
                  <div className="mt-0.5 space-y-0.5">
                    {eventsOnDay(day).slice(0, 3).map((e) => (
                      <button
                        key={e.eventId}
                        type="button"
                        className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] text-white ${EVENT_COLORS[e.eventType] ?? EVENT_COLORS.other}`}
                        onClick={() => setSelected(e)}
                      >
                        {e.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Upcoming events</h2>
        {query.isLoading ? (
          <p className="text-sm text-[#9ca3af]">Loading events…</p>
        ) : query.isError ? (
          <p className="text-sm text-[#E24B4A]">{(query.error as Error).message}</p>
        ) : events.length === 0 ? (
          <div className={`${SURFACE} rounded-lg p-8 text-center text-sm text-[#9ca3af]`}>
            No upcoming events. Add one to generate a surge model.
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const surge = event.surgeModel;
              const breakdown = surge?.callTypeBreakdown
                ? Object.entries(surge.callTypeBreakdown)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")
                : null;
              return (
                <article key={event.eventId} className={`${SURFACE} rounded-lg p-4`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{event.name}</h3>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] text-white ${EVENT_COLORS[event.eventType] ?? EVENT_COLORS.other}`}
                        >
                          {event.eventType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#9ca3af]">
                        {event.venue ? `${event.venue} · ` : ""}
                        {new Date(event.startAt).toLocaleString()}
                        {event.expectedAttendance != null
                          ? ` · ${event.expectedAttendance.toLocaleString()} expected`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-md bg-[#1a2035] px-2.5 py-1.5 text-xs disabled:opacity-50"
                      disabled={acked[event.eventId]}
                      onClick={() => setAcked((a) => ({ ...a, [event.eventId]: true }))}
                    >
                      {acked[event.eventId] ? "Acknowledged" : "Mark acknowledged"}
                    </button>
                  </div>

                  {surge ? (
                    <div className="mt-3 rounded-md bg-[#0f1117] p-3 text-sm">
                      <p className="font-medium text-[#378ADD]">
                        +{surge.predictedCallVolume} predicted calls
                        <span className="ml-2 text-xs font-normal text-[#6b7280]">
                          CI {surge.confidenceInterval[0]}–{surge.confidenceInterval[1]}
                        </span>
                      </p>
                      {breakdown ? (
                        <p className="mt-1 text-xs text-[#9ca3af]">{breakdown}</p>
                      ) : null}
                      {surge.peakHour ? (
                        <p className="mt-1 text-xs text-[#6b7280]">
                          Peak hour: {new Date(surge.peakHour).toLocaleString()}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs italic text-[#6b7280]">{surge.modelBasis}</p>
                    </div>
                  ) : null}

                  {(event.staffingRecommendations ?? []).length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {event.staffingRecommendations!.map((rec) => (
                        <li
                          key={rec.recommendationId}
                          className="flex gap-2 rounded-md bg-[#0f1117] px-3 py-2 text-xs"
                        >
                          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1D9E75]" />
                          <div>
                            <span className="font-medium">
                              {rec.role}: +{rec.additionalStaffNeeded}
                            </span>
                            <span className="ml-2 rounded bg-[#1a2035] px-1.5 py-0.5 uppercase text-[10px] text-[#9ca3af]">
                              {rec.priority}
                            </span>
                            <p className="mt-0.5 text-[#6b7280]">
                              {new Date(rec.startAt).toLocaleString()} –{" "}
                              {new Date(rec.endAt).toLocaleString()}
                            </p>
                            <p className="text-[#9ca3af]">{rec.justification}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
          <aside className="flex h-full w-full max-w-md flex-col border-l border-[#1e2130] bg-[#0f1117]">
            <div className="flex items-center justify-between border-b border-[#1e2130] px-4 py-3">
              <h2 className="font-semibold">{selected.name}</h2>
              <button
                type="button"
                className="rounded p-1 text-[#9ca3af] hover:bg-[#161b2e]"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <p className="capitalize text-[#9ca3af]">
                {selected.eventType.replace(/_/g, " ")}
              </p>
              <p>{selected.venue}</p>
              <p className="text-xs text-[#6b7280]">
                {new Date(selected.startAt).toLocaleString()} –{" "}
                {new Date(selected.endAt).toLocaleString()}
              </p>
              {selected.surgeModel ? (
                <p className="text-[#378ADD]">
                  +{selected.surgeModel.predictedCallVolume} calls (CI{" "}
                  {selected.surgeModel.confidenceInterval.join("–")})
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
