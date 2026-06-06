"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { patchPremiseNote, postCreatePremiseNote } from "@/lib/api";
import { loadCallerCard } from "@/lib/queries";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import type {
  CallerCardPriorIncident,
  CallerCardPremiseNoteItem,
  GetCallerCardResponse,
  PremiseHazardType,
} from "rapid-cortex-shared";

function cadStatusClasses(status: GetCallerCardResponse["cadData"]["status"]): string {
  if (status === "live") return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30";
  if (status === "mock") return "bg-amber-500/15 text-amber-100 ring-amber-500/30";
  return "bg-slate-600/20 text-slate-400 ring-slate-500/20";
}

function mapHref(card: GetCallerCardResponse): string {
  const { location } = card;
  if (typeof location.latitude === "number" && typeof location.longitude === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`;
}

function LocationProvenanceLabel({ source }: { source: GetCallerCardResponse["location"]["source"] }) {
  if (source === "cad") return <span className="text-sky-200/90">From CAD</span>;
  return <span className="text-slate-200/90">From incident</span>;
}

const HAZARD_OPTIONS: { value: PremiseHazardType; label: string }[] = [
  { value: "weapons", label: "Weapons" },
  { value: "dogs", label: "Dogs / animals" },
  { value: "mental_health", label: "Mental health" },
  { value: "hazmat", label: "Hazmat" },
  { value: "violent_history", label: "Violent history" },
  { value: "other", label: "Other hazard" },
];

function hazardLabel(ht: PremiseHazardType | null | undefined): string {
  if (!ht) return "—";
  return HAZARD_OPTIONS.find((o) => o.value === ht)?.label ?? ht;
}

function priorityBadgeClass(urgency: string | undefined): string {
  switch (urgency) {
    case "critical":
      return "bg-rose-600/25 text-rose-100 ring-rose-500/40";
    case "high":
      return "bg-orange-500/20 text-orange-100 ring-orange-500/35";
    case "moderate":
      return "bg-amber-500/15 text-amber-100 ring-amber-500/30";
    case "low":
      return "bg-slate-600/20 text-slate-200 ring-slate-500/30";
    default:
      return "bg-slate-600/20 text-slate-300 ring-slate-500/30";
  }
}

function PriorRow({
  p,
  href,
}: {
  p: CallerCardPriorIncident;
  href: string;
}) {
  const [open, setOpen] = useState(false);
  const when = new Date(p.createdAt);
  const dateStr = Number.isNaN(when.getTime()) ? p.createdAt : when.toLocaleDateString();
  const priority = p.priority ?? "—";
  const resolution = p.resolution ?? p.disposition ?? "—";
  return (
    <li className="rounded-md border border-slate-800/80 bg-slate-900/30">
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5">
        <Link
          href={href}
          className="text-[11px] font-medium text-cyan-300/95 underline-offset-2 hover:underline"
          title="Open this incident in the queue"
        >
          {p.incidentId.slice(0, 10)}…
        </Link>
        <span className="text-[10px] text-slate-500">·</span>
        <span className="text-[10px] text-slate-400">{dateStr}</span>
        {p.relativeTimeLabel ? (
          <span className="text-[10px] text-slate-500">({p.relativeTimeLabel})</span>
        ) : null}
        <span
          className={`ml-0.5 inline-flex rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide ring-1 ${priorityBadgeClass(
            p.priority,
          )}`}
        >
          {priority}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-slate-800/40 px-2 py-1 text-[10px] text-slate-400">
        <span className="font-medium text-slate-300">{p.incidentType ?? "—"}</span>
        <span className="text-slate-600">·</span>
        <span>Resolution: {resolution}</span>
        {(p.summary?.trim() || "") && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto text-[10px] text-slate-500 hover:text-slate-300"
          >
            {open ? "Hide" : "Summary"}
          </button>
        )}
      </div>
      {open && p.summary?.trim() ? (
        <p className="border-t border-slate-800/60 px-2 py-1.5 text-[11px] leading-snug text-slate-300">
          {p.summary}
        </p>
      ) : null}
    </li>
  );
}

function PremiseNoteCard({
  n,
  incidentId,
  onSaved,
}: {
  n: CallerCardPremiseNoteItem;
  incidentId: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(n.text);
  const [hazardType, setHazardType] = useState<PremiseHazardType | "">(
    (n.hazardType as PremiseHazardType | undefined) ?? "",
  );
  const [isHazard, setIsHazard] = useState(Boolean(n.isHazard));
  const [knownOccupants, setKnownOccupants] = useState(n.knownOccupants ?? "");
  const [specialInstructions, setSpecialInstructions] = useState(n.specialInstructions ?? "");

  const saveEdit = useMutation({
    mutationFn: () =>
      patchPremiseNote(incidentId, n.noteId, {
        text: text.trim(),
        hazardType: hazardType === "" ? null : hazardType,
        isHazard,
        knownOccupants: knownOccupants.trim() || null,
        specialInstructions: specialInstructions.trim() || null,
      }),
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
  });

  return (
    <li className="rounded border border-slate-800/80 bg-slate-900/40 p-2 text-[12px] text-slate-200">
      <div className="flex flex-wrap items-start gap-1">
        {n.isHazard ? (
          <span className="rounded bg-rose-600/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Hazard
          </span>
        ) : null}
        {n.hazardType ? (
          <span className="rounded bg-rose-950/60 px-1.5 py-0.5 text-[9px] text-rose-100 ring-1 ring-rose-700/50">
            {hazardLabel(n.hazardType)}
          </span>
        ) : null}
        {!editing ? (
          <button
            type="button"
            className="ml-auto text-[10px] text-cyan-300/90 hover:underline"
            onClick={() => {
              setText(n.text);
              setHazardType((n.hazardType as PremiseHazardType | undefined) ?? "");
              setIsHazard(Boolean(n.isHazard));
              setKnownOccupants(n.knownOccupants ?? "");
              setSpecialInstructions(n.specialInstructions ?? "");
              setEditing(true);
            }}
          >
            Edit
          </button>
        ) : null}
      </div>
      {!editing ? (
        <>
          <p className="mt-1 whitespace-pre-wrap">{n.text}</p>
          {n.knownOccupants?.trim() ? (
            <p className="mt-1 text-[11px] text-slate-300">
              <span className="font-semibold text-slate-400">Occupants:</span> {n.knownOccupants}
            </p>
          ) : null}
          {n.specialInstructions?.trim() ? (
            <p className="mt-1 text-[11px] text-slate-300">
              <span className="font-semibold text-slate-400">Instructions:</span> {n.specialInstructions}
            </p>
          ) : null}
          <p className="mt-1 text-[10px] text-slate-500">
            {n.createdBy} · {n.createdAt}
            {n.updatedAt ? ` · edited ${n.updatedAt}` : ""}
          </p>
        </>
      ) : (
        <div className="mt-2 space-y-2">
          <textarea
            className="w-full min-h-[64px] resize-y rounded border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-[12px] text-slate-200"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <label className="block text-[10px] text-slate-500">
            Hazard type
            <select
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[12px] text-slate-200"
              value={hazardType}
              onChange={(e) => {
                const v = e.target.value as PremiseHazardType | "";
                setHazardType(v);
                if (v && v !== "other") setIsHazard(true);
                if (!v) setIsHazard(false);
              }}
            >
              <option value="">None</option>
              {HAZARD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={isHazard} onChange={(e) => setIsHazard(e.target.checked)} />
            Mark as hazard (show red banner)
          </label>
          <input
            className="w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-[12px] text-slate-200"
            placeholder="Known occupants (optional)"
            value={knownOccupants}
            onChange={(e) => setKnownOccupants(e.target.value)}
          />
          <textarea
            className="w-full min-h-[48px] resize-y rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-[12px] text-slate-200"
            placeholder="Special instructions (optional)"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-900 hover:bg-white disabled:opacity-50"
              disabled={saveEdit.isPending || text.trim().length === 0}
              onClick={() => saveEdit.mutate()}
            >
              {saveEdit.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200"
              disabled={saveEdit.isPending}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
          {saveEdit.isError ? (
            <p className="text-[10px] text-amber-200/90">Could not save changes.</p>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function CallerCardPanel({ incidentId }: { incidentId: string }) {
  const to = useJurisdictionLink();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [hazardType, setHazardType] = useState<PremiseHazardType | "">("");
  const [isHazard, setIsHazard] = useState(false);
  const [knownOccupants, setKnownOccupants] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [showAllPrior, setShowAllPrior] = useState(false);

  const q = useQuery({
    queryKey: ["caller-card", incidentId],
    queryFn: () => loadCallerCard(incidentId),
    enabled: Boolean(incidentId),
    staleTime: 30_000,
    retry: 1,
  });

  const saveNote = useMutation({
    mutationFn: () =>
      postCreatePremiseNote(incidentId, {
        text: draft.trim(),
        ...(hazardType ? { hazardType } : {}),
        isHazard,
        ...(knownOccupants.trim() ? { knownOccupants: knownOccupants.trim() } : {}),
        ...(specialInstructions.trim() ? { specialInstructions: specialInstructions.trim() } : {}),
      }),
    onSuccess: () => {
      setDraft("");
      setHazardType("");
      setIsHazard(false);
      setKnownOccupants("");
      setSpecialInstructions("");
      void queryClient.invalidateQueries({ queryKey: ["caller-card", incidentId] });
    },
  });

  const hasPremiseHazard = useMemo(
    () => Boolean(q.data?.premiseNotes.some((n) => n.isHazard)),
    [q.data?.premiseNotes],
  );

  if (q.isLoading) {
    return (
      <aside className="flex w-80 min-w-0 shrink-0 flex-col border-l border-slate-800 bg-slate-950/50 p-3">
        <div className="mb-2 h-3 w-2/3 animate-pulse rounded bg-slate-800" />
        <div className="mb-3 h-24 animate-pulse rounded bg-slate-800/60" />
        <div className="space-y-2">
          <div className="h-2 w-full animate-pulse rounded bg-slate-800/50" />
          <div className="h-2 w-5/6 animate-pulse rounded bg-slate-800/50" />
        </div>
        <p className="mt-3 text-xs text-slate-600">Loading caller context…</p>
      </aside>
    );
  }

  if (q.isError) {
    return (
      <aside className="flex w-80 min-w-0 shrink-0 flex-col border-l border-rose-900/50 bg-rose-950/20 p-3 text-xs text-rose-100/90">
        Could not load caller / premise data. Check permissions or try again.
      </aside>
    );
  }

  if (!q.data) {
    return (
      <aside className="flex w-80 min-w-0 shrink-0 flex-col border-l border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-500">
        Caller card is off, unavailable, or you do not have access. When enabled, set a caller address from
        dispatch actions to normalize prior history and notes.
      </aside>
    );
  }

  const card = q.data;
  const priorTotal = card.priorIncidentsTotal ?? card.priorIncidents.length;
  const priorShown = showAllPrior ? card.priorIncidents : card.priorIncidents.slice(0, 10);
  const showPriorExpand = priorTotal > 10 || card.priorIncidents.length > 10;
  const trauma = card.addressTraumaFlags;
  const traumaRecent = trauma.mostRecentAt ? new Date(trauma.mostRecentAt) : null;
  const traumaRecentLabel =
    traumaRecent && !Number.isNaN(traumaRecent.getTime())
      ? traumaRecent.toLocaleString()
      : trauma.mostRecentAt;

  return (
    <aside className="flex w-80 min-w-0 max-w-[min(100%,20rem)] shrink-0 flex-col border-l border-slate-800 bg-slate-950/50">
      <div className="border-b border-slate-800 px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Caller / premise</h2>
        {hasPremiseHazard ? (
          <p className="mt-2 rounded border border-rose-700/60 bg-rose-950/40 px-2 py-1.5 text-[11px] font-semibold text-rose-100">
            ⚠ HAZARD — premise notes flag this location.
          </p>
        ) : null}
        {card.normalizedAddress ? (
          <p
            className="mt-1 break-all text-[10px] text-slate-500"
            title="Lookup key (agency-scoped; not a mailing label)"
          >
            Key: {card.normalizedAddress}
          </p>
        ) : (
          <p className="mt-1 text-[10px] text-amber-200/80">No normalized address for correlation yet.</p>
        )}
        <p className="mt-1 text-[10px] text-slate-500">Updated {new Date(card.generatedAt).toLocaleString()}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3 text-xs text-slate-200">
        <section>
          <h3 className="text-[10px] font-semibold uppercase text-slate-500">Location</h3>
          <p className="mt-1 text-[11px] leading-snug text-slate-300">
            {priorTotal} prior incidents (12 mo) · {card.premiseNotes.length} premise notes
            {hasPremiseHazard ? (
              <>
                {" "}
                · <span className="font-semibold text-rose-300">Hazards on file</span>
              </>
            ) : null}
          </p>
          {trauma.count > 0 ? (
            <p className="mt-1 text-[11px] text-amber-100/95">
              ⚠ {trauma.count} prior trauma flag{trauma.count === 1 ? "" : "s"} at this address
              {traumaRecentLabel ? ` · most recent ${traumaRecentLabel}` : ""}
              {trauma.mostRecentTraumaFlagType ? ` (${trauma.mostRecentTraumaFlagType})` : ""}
            </p>
          ) : null}
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-snug text-slate-200">{card.location.address}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            Provenance: <LocationProvenanceLabel source={card.location.source} />
          </p>
          <a
            href={mapHref(card)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex h-20 items-center justify-center rounded border border-dashed border-slate-700/80 bg-slate-900/40 text-[10px] text-cyan-300/90 hover:border-slate-500 hover:bg-slate-900/60"
          >
            Open map preview
          </a>
        </section>

        <section>
          <h3 className="text-[10px] font-semibold uppercase text-slate-500">Prior at this address</h3>
          <p className="text-[10px] text-slate-500">Source: prior_incidents (agency-scoped, last 12 months)</p>
          {card.priorIncidents.length === 0 ? (
            <p className="mt-1 text-slate-600">No prior incidents for this key in the last 12 months.</p>
          ) : (
            <>
              <ol className="mt-1 space-y-1">
                {priorShown.map((p) => (
                  <PriorRow
                    key={p.incidentId}
                    p={p}
                    href={to(`/dashboard?incident=${encodeURIComponent(p.incidentId)}`)}
                  />
                ))}
              </ol>
              {showPriorExpand && !showAllPrior ? (
                <button
                  type="button"
                  className="mt-1.5 text-[10px] font-medium text-cyan-300/90 hover:underline"
                  onClick={() => setShowAllPrior(true)}
                >
                  Show all{priorTotal > card.priorIncidents.length ? ` (${card.priorIncidents.length} loaded)` : ""}
                </button>
              ) : null}
              {showPriorExpand && showAllPrior && card.priorIncidents.length > 10 ? (
                <button
                  type="button"
                  className="mt-1.5 text-[10px] text-slate-500 hover:text-slate-300"
                  onClick={() => setShowAllPrior(false)}
                >
                  Show fewer
                </button>
              ) : null}
              {card.priorIncidentsTruncated ? (
                <p className="mt-1 text-[10px] text-amber-200/80">
                  List may be capped — more incidents may exist at this address.
                </p>
              ) : null}
            </>
          )}
        </section>

        <section>
          <h3 className="text-[10px] font-semibold uppercase text-slate-500">Premise notes</h3>
          <p className="text-[10px] text-slate-500">Manual note — persists by normalized address</p>
          <ul className="mt-1 space-y-2">
            {card.premiseNotes.length === 0 ? (
              <li className="text-slate-600">None on file for this key.</li>
            ) : (
              card.premiseNotes.map((n) => (
                <PremiseNoteCard
                  key={n.noteId}
                  n={n}
                  incidentId={incidentId}
                  onSaved={() => void queryClient.invalidateQueries({ queryKey: ["caller-card", incidentId] })}
                />
              ))
            )}
          </ul>
          <label className="mt-2 block text-[10px] text-slate-500">
            Hazard type (optional)
            <select
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-[12px] text-slate-200"
              value={hazardType}
              onChange={(e) => {
                const v = e.target.value as PremiseHazardType | "";
                setHazardType(v);
                if (v && v !== "other") setIsHazard(true);
                if (!v) setIsHazard(false);
              }}
            >
              <option value="">None</option>
              {HAZARD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={isHazard} onChange={(e) => setIsHazard(e.target.checked)} />
            Mark as hazard (show red banner)
          </label>
          <input
            className="mt-2 w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600"
            placeholder="Known occupants (optional)"
            value={knownOccupants}
            onChange={(e) => setKnownOccupants(e.target.value)}
            disabled={saveNote.isPending}
          />
          <textarea
            className="mt-2 w-full min-h-[48px] resize-y rounded border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600"
            placeholder="Special instructions (optional)"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            disabled={saveNote.isPending}
          />
          <textarea
            className="mt-2 w-full min-h-[72px] resize-y rounded border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600"
            placeholder="Add a premise note (visible for future dispatches)…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={saveNote.isPending}
          />
          <button
            type="button"
            className="mt-1 rounded bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-900 hover:bg-white disabled:opacity-50"
            disabled={saveNote.isPending || draft.trim().length === 0}
            onClick={() => saveNote.mutate()}
          >
            {saveNote.isPending ? "Saving…" : "Save note"}
          </button>
          {saveNote.isError ? (
            <p className="mt-1 text-[10px] text-amber-200/90">Note could not be saved. Check address and permissions.</p>
          ) : null}
        </section>

        <section>
          <h3 className="text-[10px] font-semibold uppercase text-slate-500">Connected device / CAD</h3>
          <p className="text-[10px] text-slate-500">From CAD (integration)</p>
          <p className="mt-1">
            <span
              className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${cadStatusClasses(
                card.cadData.status,
              )}`}
            >
              {card.cadData.status === "mock" ? "Mock-backed" : null}
              {card.cadData.status === "live" ? "Live-backed" : null}
              {card.cadData.status === "unavailable" ? "Unavailable" : null}
            </span>
          </p>
          {card.cadData.status === "unavailable" && (
            <p className="mt-2 text-slate-500">CAD enrichment is not available for this request.</p>
          )}
          {(card.cadData.status === "mock" || card.cadData.status === "live") && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-slate-300/95">
              {card.cadData.callerName ? <li>Name: {card.cadData.callerName}</li> : null}
              {card.cadData.callbackPhone ? <li>Callback: {card.cadData.callbackPhone}</li> : null}
              {card.cadData.emergencyContacts && card.cadData.emergencyContacts.length > 0 ? (
                <li>Contacts: {card.cadData.emergencyContacts.join(", ")}</li>
              ) : null}
              {card.cadData.premiseWarnings && card.cadData.premiseWarnings.length > 0 ? (
                <li className="text-amber-100/90">Warnings: {card.cadData.premiseWarnings.join(" · ")}</li>
              ) : null}
            </ul>
          )}
          {card.cadData.deviceData && Object.keys(card.cadData.deviceData).length > 0 ? (
            <pre className="mt-2 max-h-32 overflow-auto rounded border border-slate-800/80 bg-black/25 p-2 text-[10px] text-slate-400">
              {JSON.stringify(card.cadData.deviceData, null, 2)}
            </pre>
          ) : null}
        </section>

        <p className="border-t border-slate-800/80 pt-2 text-[10px] leading-relaxed text-slate-500">
          {card.provenanceSummary}
        </p>
      </div>
    </aside>
  );
}
