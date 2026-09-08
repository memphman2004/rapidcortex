"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CLERY_ACT_GEOGRAPHIES,
  CLERY_ACT_GEOGRAPHY_LABELS,
  CLERY_DCL_DISPOSITIONS,
  CLERY_OFFENSE_CATEGORIES,
  CLERY_OFFENSE_DISPLAY_NAMES,
  HATE_CRIME_BIASES,
  type CleryActGeography,
  type CleryOffenseCategory,
  type CleryRecord,
  type HateCrimeBias,
} from "rapid-cortex-shared";

type SuggestionPayload = {
  advisoryOnly: boolean;
  notice: string;
  suggestion: {
    primaryOffense: string;
    confidence: number;
    rationale: string;
    isHateCrimePossible: boolean;
    isVAWAPossible: boolean;
    questionsForCoordinator: string[];
  };
  geography: { geography: string | null; zoneConfigured: boolean; message?: string; buildingName?: string };
  timelyWarning: { recommended: boolean; likelihood: string; rationale: string };
  incident: {
    id: string;
    type: string;
    description: string;
    buildingLabel: string;
    zoneLabel: string;
    createdAt: string;
    isAnonymous: boolean;
  };
  record: CleryRecord;
};

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function CampusCleryReviewClient({
  campusCode,
  canReview,
}: {
  campusCode: string;
  canReview: boolean;
}) {
  const code = campusCode.toUpperCase();
  const qs = `campusCode=${encodeURIComponent(code)}`;
  const [records, setRecords] = useState<CleryRecord[]>([]);
  const [filter, setFilter] = useState("PENDING_REVIEW");
  const [selected, setSelected] = useState<string | null>(null);
  const [payload, setPayload] = useState<SuggestionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incidentId, setIncidentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmClassify, setConfirmClassify] = useState(false);
  const [unfoundOpen, setUnfoundOpen] = useState(false);
  const [unfoundReason, setUnfoundReason] = useState("");
  const [investigation, setInvestigation] = useState(false);
  const [canUnfound, setCanUnfound] = useState(false);

  const [primaryOffense, setPrimaryOffense] = useState<CleryOffenseCategory>("NOT_CLERY_REPORTABLE");
  const [geography, setGeography] = useState<CleryActGeography>("ON_CAMPUS");
  const [residential, setResidential] = useState(false);
  const [hate, setHate] = useState(false);
  const [hateBiases, setHateBiases] = useState<HateCrimeBias[]>([]);
  const [vawa, setVawa] = useState(false);
  const [location, setLocation] = useState("");
  const [reportedAt, setReportedAt] = useState("");
  const [disposition, setDisposition] = useState<(typeof CLERY_DCL_DISPOSITIONS)[number]>(
    "Open — Investigation Ongoing",
  );
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    const statusQs = filter ? `&status=${encodeURIComponent(filter)}` : "";
    const data = await readJson<{ records: CleryRecord[] }>(
      await fetch(`/api/campus/clery/records?${qs}${statusQs}`, { cache: "no-store" }),
    );
    setRecords(data.records);
  }, [filter, qs]);

  useEffect(() => {
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/campus/clery/csa/me", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { canUnfound?: boolean };
      setCanUnfound(Boolean(data.canUnfound));
    })();
  }, []);

  const overdueCount = useMemo(
    () => records.filter((r) => r.dailyCrimeLogOverdue).length,
    [records],
  );

  async function openReview(recordId: string) {
    setError(null);
    setSelected(recordId);
    const data = await readJson<SuggestionPayload>(
      await fetch(`/api/campus/clery/records/${encodeURIComponent(recordId)}/suggestion?${qs}`, {
        cache: "no-store",
      }),
    );
    setPayload(data);
    setPrimaryOffense((data.suggestion.primaryOffense as CleryOffenseCategory) || "NOT_CLERY_REPORTABLE");
    setGeography((data.geography.geography as CleryActGeography) || "ON_CAMPUS");
    setLocation(data.record.generalLocationDescription);
    setResidential(data.record.isResidentialFacility);
    setReportedAt(toDatetimeLocalValue(data.record.reportedToInstitutionAt));
  }

  async function createFromIncident() {
    if (!incidentId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await readJson<{ record: CleryRecord }>(
        await fetch("/api/campus/clery/records", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ campusCode: code, incidentId: incidentId.trim() }),
        }),
      );
      setIncidentId("");
      await load();
      await openReview(data.record.recordId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function classify() {
    if (!selected || !payload) return;
    setBusy(true);
    setError(null);
    try {
      await readJson(
        await fetch(`/api/campus/clery/records/${encodeURIComponent(selected)}/classify`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            campusCode: code,
            primaryOffense,
            cleryGeography: geography,
            isResidentialFacility: residential,
            isHateCrime: hate,
            hateCrimeBiasCategories: hate ? hateBiases : [],
            isVAWAOffense: vawa,
            generalLocationDescription: location,
            reportedToInstitutionAt: fromDatetimeLocalValue(reportedAt) ?? payload.record.reportedToInstitutionAt,
            dailyCrimeLogDisposition: disposition,
            classificationNotes: notes,
            aiSuggestionAccepted: primaryOffense === payload.suggestion.primaryOffense,
            confirm: true,
          }),
        }),
      );
      setConfirmClassify(false);
      setSelected(null);
      setPayload(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Classify failed");
    } finally {
      setBusy(false);
    }
  }

  async function unfound() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await readJson(
        await fetch(`/api/campus/clery/records/${encodeURIComponent(selected)}/unfound`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            campusCode: code,
            reason: unfoundReason,
            fullInvestigationCompleted: true,
          }),
        }),
      );
      setUnfoundOpen(false);
      setSelected(null);
      setPayload(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unfound failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clery Act · 20 U.S.C. § 1092(f)</p>
        <h1 className="text-xl font-semibold text-white">Clery review queue</h1>
        <p className="text-sm text-amber-200/90">
          {overdueCount} overdue for Daily Crime Log · {records.length} in this filter. AI suggestions are advisory
          only — they never count in statistics until you classify.
        </p>
      </header>

      {error ? <p className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {["PENDING_REVIEW", "PENDING_INFORMATION", "CLASSIFIED", "UNFOUNDED", "EXCLUDED", ""].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded px-3 py-1 text-xs ${filter === s ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-300"}`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {canReview ? (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="Campus incident ID"
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void createFromIncident()}
            className="rounded bg-sky-700 px-3 py-2 text-sm text-white"
          >
            Create Clery record
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="space-y-2">
          {records.map((r) => (
            <li key={r.recordId} className="rounded border border-slate-700 bg-slate-900 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400">{r.status}</span>
                {r.dailyCrimeLogOverdue ? (
                  <span className="text-xs font-semibold text-red-400">OVERDUE</span>
                ) : null}
              </div>
              <p className="text-sm text-white">
                {r.aiSuggestedOffense ?? r.primaryOffense} · {r.generalLocationDescription}
              </p>
              <p className="text-xs text-slate-400">
                Reported {r.reportedToInstitutionAt.slice(0, 16).replace("T", " ")} · DCL deadline{" "}
                {r.dailyCrimeLogDeadline.slice(0, 10)}
              </p>
              {r.aiSuggestedOffense ? (
                <p className="mt-1 text-xs text-amber-300">
                  AI suggestion (advisory): {r.aiSuggestedOffense}{" "}
                  {r.aiSuggestionConfidence != null ? `(${Math.round(r.aiSuggestionConfidence * 100)}%)` : ""}
                </p>
              ) : null}
              {canReview ? (
                <button
                  type="button"
                  className="mt-2 text-xs text-sky-400 underline"
                  onClick={() => void openReview(r.recordId)}
                >
                  Review now
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        {payload && selected ? (
          <section className="space-y-3 rounded border border-slate-700 bg-slate-900 p-4">
            <h2 className="font-semibold text-white">Classification review · {payload.incident.id}</h2>
            <p className="text-sm text-slate-300">
              {payload.incident.type} · {payload.incident.buildingLabel} / {payload.incident.zoneLabel}
            </p>
            <p className="text-sm text-slate-200">{payload.incident.description}</p>
            <p className="text-xs text-slate-400">
              Reporter: {payload.incident.isAnonymous ? "Anonymous" : "On file (not shown)"}
            </p>

            <div className="rounded border border-amber-500/50 bg-amber-950/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                AI classification suggestion · Advisory only
              </p>
              <p className="text-sm text-amber-50">
                {payload.suggestion.primaryOffense} ({Math.round(payload.suggestion.confidence * 100)}%)
              </p>
              <p className="text-xs text-amber-100/80">{payload.suggestion.rationale}</p>
              {!payload.geography.zoneConfigured ? (
                <p className="mt-2 text-xs text-red-300">
                  {payload.geography.message ?? "Zone geography is not configured."}{" "}
                  <Link className="underline" href={`/app/campus/${code}/clery/zones`}>
                    Configure zones
                  </Link>
                </p>
              ) : null}
              {payload.timelyWarning.recommended ? (
                <p className="mt-2 text-xs text-amber-200">
                  Timely warning likely ({payload.timelyWarning.likelihood}). Coordinator must decide.{" "}
                  <Link className="underline" href={`/app/campus/${code}/alerts`}>
                    Open occupant alerts
                  </Link>
                </p>
              ) : null}
            </div>

            {canReview ? (
              <>
                <label className="block text-xs text-slate-400">
                  Primary offense
                  <select
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-white"
                    value={primaryOffense}
                    onChange={(e) => setPrimaryOffense(e.target.value as CleryOffenseCategory)}
                  >
                    {CLERY_OFFENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CLERY_OFFENSE_DISPLAY_NAMES[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  Geography
                  <select
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-white"
                    value={geography}
                    onChange={(e) => setGeography(e.target.value as CleryActGeography)}
                  >
                    {CLERY_ACT_GEOGRAPHIES.map((g) => (
                      <option key={g} value={g}>
                        {CLERY_ACT_GEOGRAPHY_LABELS[g]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={residential} onChange={(e) => setResidential(e.target.checked)} />
                  Residential facility
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={hate} onChange={(e) => setHate(e.target.checked)} />
                  Hate crime
                </label>
                {hate ? (
                  <fieldset className="rounded border border-slate-700 p-2">
                    <legend className="text-xs text-slate-400">Bias category (required)</legend>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      {HATE_CRIME_BIASES.map((b) => (
                        <label key={b} className="flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={hateBiases.includes(b)}
                            onChange={(e) =>
                              setHateBiases((prev) =>
                                e.target.checked ? [...prev, b] : prev.filter((x) => x !== b),
                              )
                            }
                          />
                          {b.replaceAll("_", " ")}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={vawa} onChange={(e) => setVawa(e.target.checked)} />
                  VAWA offense
                </label>
                <label className="block text-xs text-slate-400">
                  General location (public log — no room numbers)
                  <input
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-white"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Myers Hall Residential"
                  />
                </label>
                <label className="block text-xs text-slate-400">
                  Reported to institution (starts the 2-business-day Daily Crime Log clock)
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-white"
                    value={reportedAt}
                    onChange={(e) => setReportedAt(e.target.value)}
                  />
                  <span className="mt-1 block text-[11px] text-slate-500">
                    Use the time campus received the report, not when it was entered in Rapid Cortex.
                  </span>
                </label>
                <label className="block text-xs text-slate-400">
                  Disposition
                  <select
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-white"
                    value={disposition}
                    onChange={(e) =>
                      setDisposition(e.target.value as (typeof CLERY_DCL_DISPOSITIONS)[number])
                    }
                  >
                    {CLERY_DCL_DISPOSITIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  Notes
                  <textarea
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-white"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <p className="text-xs text-slate-400">
                  Daily Crime Log deadline: {payload.record.dailyCrimeLogDeadline.slice(0, 10)}
                  {payload.record.dailyCrimeLogOverdue ? " · OVERDUE" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded bg-sky-700 px-3 py-2 text-sm text-white"
                    onClick={() => setConfirmClassify(true)}
                  >
                    Classify →
                  </button>
                  {canUnfound ? (
                    <button
                      type="button"
                      className="rounded border border-red-500/50 px-3 py-2 text-sm text-red-200"
                      onClick={() => setUnfoundOpen(true)}
                    >
                      Unfound
                    </button>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Unfounding requires a sworn officer CSA record with badge number.
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </section>
        ) : null}
      </div>

      {confirmClassify ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-md rounded bg-slate-900 p-4 text-sm text-slate-100">
            <p>
              This will add this record to the Daily Crime Log and count it in {new Date().getUTCFullYear()}{" "}
              statistics (unless marked not Clery-reportable). This action is audited. Proceed?
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="rounded bg-sky-700 px-3 py-2" onClick={() => void classify()}>
                Confirm classification
              </button>
              <button type="button" className="rounded px-3 py-2 text-slate-300" onClick={() => setConfirmClassify(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {unfoundOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-md space-y-2 rounded bg-slate-900 p-4 text-sm text-slate-100">
            <p className="font-semibold">Unfound record</p>
            <p>
              This removes the record from Clery statistics. Only a sworn law enforcement officer may unfound a
              crime.
            </p>
            <textarea
              className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-2"
              rows={4}
              placeholder="Required: document why no crime occurred"
              value={unfoundReason}
              onChange={(e) => setUnfoundReason(e.target.value)}
            />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={investigation} onChange={(e) => setInvestigation(e.target.checked)} />
              Full investigation completed
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!investigation || unfoundReason.trim().length < 20 || busy}
                className="rounded bg-red-800 px-3 py-2 disabled:opacity-40"
                onClick={() => void unfound()}
              >
                Unfound record
              </button>
              <button type="button" onClick={() => setUnfoundOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
