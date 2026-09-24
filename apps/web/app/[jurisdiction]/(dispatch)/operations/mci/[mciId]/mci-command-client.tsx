"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, X } from "lucide-react";
import type { HospitalCapacityEntry, MCIEvent, MCIPatient } from "rapid-cortex-shared";
import { featureSuiteFetch } from "@/lib/feature-suite-client";
import { isFeaturesSuiteUiEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string; mciId: string }> };

type MciStatusResponse = { mci: MCIEvent; patients: MCIPatient[] };

const TRIAGE_COLS = ["red", "yellow", "green", "black", "gray"] as const;
const TRIAGE_STYLE: Record<string, string> = {
  red: "border-red-700/60 bg-red-950/30",
  yellow: "border-amber-700/60 bg-amber-950/20",
  green: "border-emerald-700/60 bg-emerald-950/20",
  black: "border-slate-600 bg-slate-900/60",
  gray: "border-slate-700 bg-slate-800/40",
};

function elapsed(iso: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function MciCommandClient({ params }: Props) {
  const { mciId, jurisdiction } = use(params);
  const qc = useQueryClient();
  const enabled = isFeaturesSuiteUiEnabled();
  const [clock, setClock] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [hospitalOpen, setHospitalOpen] = useState(false);
  const [transportPatient, setTransportPatient] = useState<MCIPatient | null>(null);

  const [tagNumber, setTagNumber] = useState("");
  const [triageColor, setTriageColor] =
    useState<(typeof TRIAGE_COLS)[number]>("yellow");
  const [zone, setZone] = useState("A");
  const [complaint, setComplaint] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"M" | "F" | "U">("U");

  const [hospName, setHospName] = useState("");
  const [hospBeds, setHospBeds] = useState(10);
  const [hospTrauma, setHospTrauma] = useState<"I" | "II" | "III" | "IV" | "V" | "none">("II");
  const [hospDiversion, setHospDiversion] = useState(false);

  const [transportHospital, setTransportHospital] = useState("");
  const [transportUnit, setTransportUnit] = useState("");

  useEffect(() => {
    const id = window.setInterval(() => setClock((c) => c + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const statusQ = useQuery({
    queryKey: ["mci", mciId],
    queryFn: () =>
      featureSuiteFetch<MciStatusResponse>(`mci/${encodeURIComponent(mciId)}`),
    enabled,
    refetchInterval: 10_000,
  });

  const mci = statusQ.data?.mci;
  const patients = statusQ.data?.patients ?? [];
  void clock;

  const byColor = useMemo(() => {
    const map: Record<string, MCIPatient[]> = {
      red: [],
      yellow: [],
      green: [],
      black: [],
      gray: [],
    };
    for (const p of patients) {
      const key = TRIAGE_COLS.includes(p.triageColor as (typeof TRIAGE_COLS)[number])
        ? p.triageColor
        : "gray";
      map[key].push(p);
    }
    return map;
  }, [patients]);

  const awaiting = patients.filter((p) => p.transportStatus === "awaiting");

  const addPatientMut = useMutation({
    mutationFn: () =>
      featureSuiteFetch(`mci/${encodeURIComponent(mciId)}/patients`, {
        method: "POST",
        body: JSON.stringify({
          tagNumber,
          triageColor,
          zone,
          chiefComplaint: complaint || undefined,
          age: age || undefined,
          sex,
        }),
      }),
    onSuccess: () => {
      setAddOpen(false);
      setTagNumber("");
      setComplaint("");
      void qc.invalidateQueries({ queryKey: ["mci", mciId] });
    },
  });

  const hospitalMut = useMutation({
    mutationFn: () => {
      const existing = mci?.hospitalBoard ?? [];
      const entry: HospitalCapacityEntry = {
        hospitalId: `h-${Date.now()}`,
        hospitalName: hospName,
        traumaLevel: hospTrauma,
        diversion: hospDiversion,
        availableBeds: hospBeds,
        acceptingPatients: {
          trauma: !hospDiversion,
          pediatric: true,
          burn: false,
          cardiac: true,
          stroke: true,
        },
        lastUpdated: new Date().toISOString(),
      };
      return featureSuiteFetch(`mci/${encodeURIComponent(mciId)}/hospitals`, {
        method: "PATCH",
        body: JSON.stringify({ hospitals: [...existing, entry] }),
      });
    },
    onSuccess: () => {
      setHospitalOpen(false);
      setHospName("");
      void qc.invalidateQueries({ queryKey: ["mci", mciId] });
    },
  });

  const transportMut = useMutation({
    mutationFn: (patientId: string) =>
      featureSuiteFetch(
        `mci/${encodeURIComponent(mciId)}/patients/${encodeURIComponent(patientId)}/transport`,
        {
          method: "POST",
          body: JSON.stringify({
            transportStatus: "assigned",
            hospital: transportHospital || undefined,
            unit: transportUnit || undefined,
            departed: false,
          }),
        },
      ),
    onSuccess: () => {
      setTransportPatient(null);
      void qc.invalidateQueries({ queryKey: ["mci", mciId] });
    },
  });

  if (!enabled) {
    return <div className="p-6 text-sm text-slate-400">MCI command is not enabled.</div>;
  }

  if (statusQ.isLoading) {
    return <div className="p-6 text-sm text-slate-400">Loading MCI console…</div>;
  }

  if (statusQ.isError || !mci) {
    return (
      <div className="p-6 text-sm text-red-400">
        {(statusQ.error as Error)?.message || "MCI not found"}
        <a
          href={`/${jurisdiction}/operations/mci`}
          className="mt-2 block text-sky-400 hover:underline"
        >
          Back to MCI list
        </a>
      </div>
    );
  }

  const summary = mci.triageSummary;

  return (
    <div className="flex min-h-full flex-col bg-[#0f1117] text-[#e2e4ea]">
      {/* Top bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#161b2e] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div>
            <div className="font-semibold text-white">{mci.name}</div>
            <div className="text-xs text-slate-400">
              <span className="capitalize">{mci.status}</span>
              {mci.commanderName ? ` · Cmd: ${mci.commanderName}` : ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="text-red-400">RED: {summary.red}</span>
            <span className="text-amber-300">YELLOW: {summary.yellow}</span>
            <span className="text-emerald-400">GREEN: {summary.green}</span>
            <span className="text-slate-300">BLACK: {summary.black}</span>
            <span className="text-slate-500">GRAY: {summary.gray}</span>
          </div>
        </div>
        <div className="font-mono text-sm text-slate-300">{elapsed(mci.activatedAt)}</div>
      </header>

      <div className="grid flex-1 gap-3 p-3 lg:grid-cols-[1fr_320px]">
        {/* Triage board */}
        <section className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Patient triage</h2>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1 rounded bg-sky-700 px-2.5 py-1 text-xs text-white hover:bg-sky-600"
            >
              <Plus className="h-3.5 w-3.5" /> Add patient
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {TRIAGE_COLS.map((col) => (
              <div
                key={col}
                className={`min-h-[200px] rounded-lg border p-2 ${TRIAGE_STYLE[col]}`}
              >
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider">
                  {col === "gray" ? "Unclassified" : col} ({byColor[col].length})
                </div>
                <div className="space-y-2">
                  {byColor[col].map((p) => (
                    <button
                      key={p.patientId}
                      type="button"
                      onClick={() => {
                        setTransportPatient(p);
                        setTransportHospital(p.assignedHospital || "");
                        setTransportUnit(p.assignedUnit || "");
                      }}
                      className="w-full rounded border border-slate-700/80 bg-[#0f1117]/80 p-2 text-left"
                    >
                      <div className="text-lg font-bold">{p.tagNumber}</div>
                      <div className="text-[11px] text-slate-400">
                        {p.chiefComplaint || "—"}
                        {p.age || p.sex ? ` · ${p.age || "?"}/${p.sex || "?"}` : ""}
                      </div>
                      <div className="mt-1 text-[10px] uppercase text-slate-500">
                        {p.zone} · {p.transportStatus.replace(/_/g, " ")}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Hospital board */}
        <aside className="rounded-lg border border-slate-800 bg-[#161b2e] p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Hospital board</h2>
            <button
              type="button"
              onClick={() => setHospitalOpen(true)}
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              Update
            </button>
          </div>
          <div className="space-y-2">
            {(mci.hospitalBoard ?? []).map((h) => (
              <div
                key={h.hospitalId}
                className={`rounded border p-2 text-xs ${
                  h.diversion
                    ? "border-red-800/50 bg-red-950/20"
                    : (h.availableBeds ?? 0) < 5
                      ? "border-amber-800/40 bg-amber-950/10"
                      : "border-emerald-800/40 bg-emerald-950/10"
                }`}
              >
                <div className="font-medium text-white">{h.hospitalName}</div>
                <div className="mt-0.5 text-slate-400">
                  Trauma {h.traumaLevel}
                  {h.distanceMiles != null ? ` · ${h.distanceMiles} mi` : ""}
                  {" · "}
                  Beds: {h.availableBeds ?? "—"}
                  {h.diversion ? " · DIVERSION" : " · Accepting"}
                </div>
              </div>
            ))}
            {(mci.hospitalBoard ?? []).length === 0 && (
              <p className="text-xs text-slate-500">No hospitals on board yet.</p>
            )}
          </div>
        </aside>
      </div>

      {/* Transport bar */}
      <footer className="border-t border-slate-800 bg-[#161b2e] px-4 py-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Transport coordinator — awaiting ({awaiting.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {awaiting.slice(0, 12).map((p) => (
            <button
              key={p.patientId}
              type="button"
              onClick={() => setTransportPatient(p)}
              className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
            >
              {p.tagNumber} · {p.triageColor}
            </button>
          ))}
          {awaiting.length === 0 && (
            <span className="text-xs text-slate-500">No patients awaiting transport.</span>
          )}
        </div>
      </footer>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-[#161b2e] p-4">
            <div className="mb-3 flex justify-between">
              <h3 className="font-semibold">Add patient</h3>
              <button type="button" onClick={() => setAddOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                placeholder="Tag number"
                value={tagNumber}
                onChange={(e) => setTagNumber(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <select
                value={triageColor}
                onChange={(e) => setTriageColor(e.target.value as typeof triageColor)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm capitalize"
              >
                {TRIAGE_COLS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                placeholder="Zone"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <input
                placeholder="Chief complaint"
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <input
                  placeholder="Age"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="flex-1 rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
                />
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as typeof sex)}
                  className="w-20 rounded border border-slate-700 bg-[#0f1117] px-2 py-2 text-sm"
                >
                  <option value="M">M</option>
                  <option value="F">F</option>
                  <option value="U">U</option>
                </select>
              </div>
              <button
                type="button"
                disabled={!tagNumber || addPatientMut.isPending}
                onClick={() => addPatientMut.mutate()}
                className="w-full rounded bg-sky-700 py-2 text-sm text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {hospitalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-[#161b2e] p-4">
            <div className="mb-3 flex justify-between">
              <h3 className="font-semibold">Add hospital</h3>
              <button type="button" onClick={() => setHospitalOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                placeholder="Hospital name"
                value={hospName}
                onChange={(e) => setHospName(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <select
                value={hospTrauma}
                onChange={(e) => setHospTrauma(e.target.value as typeof hospTrauma)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              >
                {(["I", "II", "III", "IV", "V", "none"] as const).map((t) => (
                  <option key={t} value={t}>
                    Trauma {t}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={hospBeds}
                onChange={(e) => setHospBeds(Number(e.target.value))}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hospDiversion}
                  onChange={(e) => setHospDiversion(e.target.checked)}
                />
                On diversion
              </label>
              <button
                type="button"
                disabled={!hospName || hospitalMut.isPending}
                onClick={() => hospitalMut.mutate()}
                className="w-full rounded bg-sky-700 py-2 text-sm text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {transportPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-[#161b2e] p-4">
            <div className="mb-3 flex justify-between">
              <h3 className="font-semibold">Assign transport — {transportPatient.tagNumber}</h3>
              <button type="button" onClick={() => setTransportPatient(null)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-2">
              <select
                value={transportHospital}
                onChange={(e) => setTransportHospital(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              >
                <option value="">Select hospital…</option>
                {(mci.hospitalBoard ?? []).map((h) => (
                  <option key={h.hospitalId} value={h.hospitalName}>
                    {h.hospitalName}
                  </option>
                ))}
              </select>
              <input
                placeholder="Unit"
                value={transportUnit}
                onChange={(e) => setTransportUnit(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={transportMut.isPending}
                onClick={() => transportMut.mutate(transportPatient.patientId)}
                className="w-full rounded bg-sky-700 py-2 text-sm text-white disabled:opacity-50"
              >
                Assign transport
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
