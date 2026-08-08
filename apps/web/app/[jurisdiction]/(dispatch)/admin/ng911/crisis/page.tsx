"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type {
  CrisisDestinationType,
  CrisisProtocolStep,
} from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { isApiConfigured } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import {
  deleteCrisisDestination,
  deleteCrisisProtocol,
  getCrisisConfig,
  listClinicianConsults,
  listCrisisDestinations,
  listCrisisProtocols,
  patchClinicianConsult,
  upsertCrisisConfig,
  upsertCrisisDestination,
  upsertCrisisProtocol,
} from "@/lib/ng911/ng911-api";
import { isNg911AssistEnabled } from "@/lib/runtime-flags";

const DEST_TYPES: CrisisDestinationType[] = [
  "988",
  "mobile_crisis",
  "community_responder",
  "le_ems",
  "portal_sms",
];

function canManage(role: string | undefined): boolean {
  return (
    role === "agencyadmin" ||
    role === "agencyit" ||
    role === "rcsuperadmin" ||
    role === "rcadmin"
  );
}

function canViewQueue(role: string | undefined): boolean {
  return (
    canManage(role) ||
    role === "supervisor" ||
    role === "dispatcher" ||
    role === "analyst" ||
    role === "auditor"
  );
}

const emptyStep = (): CrisisProtocolStep => ({
  stepId: `step_${Math.random().toString(36).slice(2, 8)}`,
  sortOrder: 0,
  question: "",
  hardStopOnYes: false,
});

export default function AdminCrisisDiversionPage() {
  const { user } = useSession();
  const to = useJurisdictionLink();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"protocols" | "destinations" | "config" | "clinician">(
    "protocols",
  );
  const [message, setMessage] = useState<string | null>(null);

  const [protoName, setProtoName] = useState("Behavioral health safety screen");
  const [protoId, setProtoId] = useState<string | undefined>();
  const [steps, setSteps] = useState<CrisisProtocolStep[]>([
    {
      stepId: "weapons",
      sortOrder: 0,
      question: "Are there weapons involved or accessible?",
      hardStopOnYes: true,
      hardStopReason: "weapons",
    },
    {
      stepId: "crime",
      sortOrder: 1,
      question: "Is a crime in progress or has a crime just occurred?",
      hardStopOnYes: true,
      hardStopReason: "crime_in_progress",
    },
  ]);
  const [defaultDest, setDefaultDest] = useState<CrisisDestinationType>("988");

  const [destForm, setDestForm] = useState({
    destinationId: undefined as string | undefined,
    type: "988" as CrisisDestinationType,
    name: "",
    phoneE164: "",
    portalUrl: "",
    smsTemplate: "",
    enabled: true,
  });

  const [costLe, setCostLe] = useState("");
  const [costEms, setCostEms] = useState("");

  const enabled = Boolean(
    user && isApiConfigured() && isNg911AssistEnabled() && canViewQueue(user.role),
  );

  const protocolsQuery = useQuery({
    queryKey: ["crisis-protocols"],
    queryFn: listCrisisProtocols,
    enabled,
  });
  const destQuery = useQuery({
    queryKey: ["crisis-destinations"],
    queryFn: listCrisisDestinations,
    enabled,
  });
  const configQuery = useQuery({
    queryKey: ["crisis-config"],
    queryFn: getCrisisConfig,
    enabled,
  });
  const consultQuery = useQuery({
    queryKey: ["crisis-clinician-queue"],
    queryFn: listClinicianConsults,
    enabled,
    refetchInterval: 15_000,
  });

  const saveProtocolMut = useMutation({
    mutationFn: () =>
      upsertCrisisProtocol({
        protocolId: protoId,
        name: protoName.trim(),
        steps: steps.map((s, i) => ({ ...s, sortOrder: i, question: s.question.trim() })),
        defaultDestination: defaultDest,
        enabled: true,
      }),
    onSuccess: async () => {
      setMessage("Protocol saved.");
      setProtoId(undefined);
      await qc.invalidateQueries({ queryKey: ["crisis-protocols"] });
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const saveDestMut = useMutation({
    mutationFn: () =>
      upsertCrisisDestination({
        destinationId: destForm.destinationId,
        type: destForm.type,
        name: destForm.name.trim(),
        phoneE164: destForm.phoneE164.trim() || undefined,
        portalUrl: destForm.portalUrl.trim() || undefined,
        smsTemplate: destForm.smsTemplate.trim() || undefined,
        enabled: destForm.enabled,
      }),
    onSuccess: async () => {
      setMessage("Destination saved.");
      setDestForm({
        destinationId: undefined,
        type: "988",
        name: "",
        phoneE164: "",
        portalUrl: "",
        smsTemplate: "",
        enabled: true,
      });
      await qc.invalidateQueries({ queryKey: ["crisis-destinations"] });
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const saveConfigMut = useMutation({
    mutationFn: () =>
      upsertCrisisConfig({
        enabled: true,
        unitCostAvoidedLeUsd: costLe ? Number(costLe) : undefined,
        unitCostAvoidedEmsUsd: costEms ? Number(costEms) : undefined,
        warmTransferMock: true,
        defaultProtocolId: protocolsQuery.data?.[0]?.protocolId,
      }),
    onSuccess: async () => {
      setMessage("Crisis config saved.");
      await qc.invalidateQueries({ queryKey: ["crisis-config"] });
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const pendingConsults = useMemo(
    () => (consultQuery.data ?? []).filter((c) => c.status === "pending" || c.status === "accepted"),
    [consultQuery.data],
  );

  if (!user) return null;

  if (!canViewQueue(user.role)) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-300">You do not have permission to view crisis diversion.</p>
      </div>
    );
  }

  if (!isNg911AssistEnabled()) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <h1 className="text-lg font-semibold text-white">Crisis diversion</h1>
        <p className="text-sm text-slate-400">
          NG9-1-1 assist is not enabled for this agency. Contact Rapid Cortex support to turn it on.
        </p>
      </div>
    );
  }

  const manage = canManage(user.role);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400/90">
          Crisis diversion
        </p>
        <h1 className="text-lg font-semibold text-white">Behavioral health protocol</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          CSG-style hard-stop assessment with destinations (988, mobile crisis, community responder,
          LE/EMS, portal SMS). Warm transfer is mock telephony until CPE integration.
        </p>
        <p className="mt-2 text-sm">
          <Link href={to("/admin/ng911/diversion")} className="text-sky-400 hover:underline">
            Non-emergency SMS diversion
          </Link>
          {" · "}
          <Link href={to("/admin/ng911/metrics")} className="text-sky-400 hover:underline">
            Metrics
          </Link>
        </p>
      </div>

      {message ? <p className="text-sm text-sky-300">{message}</p> : null}

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {(
          [
            ["protocols", "Protocols"],
            ["destinations", "Destinations"],
            ["config", "Cost & config"],
            ["clinician", `Clinician queue (${pendingConsults.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              tab === id
                ? "bg-amber-900/50 text-amber-100"
                : "text-slate-400 hover:bg-slate-900 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "protocols" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Editor</h2>
            {!manage ? (
              <p className="text-xs text-slate-500">View only — agency admin can edit protocols.</p>
            ) : null}
            <label className="block text-xs text-slate-400">
              Name
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
                value={protoName}
                disabled={!manage}
                onChange={(e) => setProtoName(e.target.value)}
              />
            </label>
            <label className="block text-xs text-slate-400">
              Default destination (no hard stop)
              <select
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
                value={defaultDest}
                disabled={!manage}
                onChange={(e) => setDefaultDest(e.target.value as CrisisDestinationType)}
              >
                {DEST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div key={step.stepId} className="rounded border border-slate-800 bg-slate-900/40 p-3">
                  <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">
                    Step {idx + 1}
                  </p>
                  <textarea
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
                    rows={2}
                    disabled={!manage}
                    value={step.question}
                    onChange={(e) => {
                      const next = [...steps];
                      next[idx] = { ...step, question: e.target.value };
                      setSteps(next);
                    }}
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={step.hardStopOnYes}
                      disabled={!manage}
                      onChange={(e) => {
                        const next = [...steps];
                        next[idx] = {
                          ...step,
                          hardStopOnYes: e.target.checked,
                          hardStopReason: e.target.checked ? step.hardStopReason ?? "other_public_safety" : undefined,
                        };
                        setSteps(next);
                      }}
                    />
                    Hard stop on Yes → LE/EMS
                  </label>
                </div>
              ))}
            </div>
            {manage ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200"
                  onClick={() => setSteps([...steps, emptyStep()])}
                >
                  Add step
                </button>
                <button
                  type="button"
                  className="rounded border border-amber-700 bg-amber-900/40 px-3 py-1 text-xs font-medium text-amber-100 disabled:opacity-50"
                  disabled={saveProtocolMut.isPending || !protoName.trim() || steps.some((s) => !s.question.trim())}
                  onClick={() => saveProtocolMut.mutate()}
                >
                  {saveProtocolMut.isPending ? "Saving…" : protoId ? "Update protocol" : "Save protocol"}
                </button>
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-white">Saved protocols</h2>
            {(protocolsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">None yet — save a protocol or start an assessment to seed defaults.</p>
            ) : (
              <ul className="space-y-2">
                {(protocolsQuery.data ?? []).map((p) => (
                  <li
                    key={p.protocolId}
                    className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-white">{p.name}</p>
                        <p className="text-xs text-slate-500">
                          {p.steps.length} steps · default {p.defaultDestination}
                        </p>
                      </div>
                      {manage ? (
                        <div className="flex gap-2 text-xs">
                          <button
                            type="button"
                            className="text-sky-400 hover:underline"
                            onClick={() => {
                              setProtoId(p.protocolId);
                              setProtoName(p.name);
                              setSteps(p.steps);
                              setDefaultDest(p.defaultDestination);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-rose-400 hover:underline"
                            onClick={async () => {
                              await deleteCrisisProtocol(p.protocolId);
                              await qc.invalidateQueries({ queryKey: ["crisis-protocols"] });
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {tab === "destinations" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Add / edit destination</h2>
            <label className="block text-xs text-slate-400">
              Type
              <select
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
                value={destForm.type}
                disabled={!manage}
                onChange={(e) =>
                  setDestForm({ ...destForm, type: e.target.value as CrisisDestinationType })
                }
              >
                {DEST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Name
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
                value={destForm.name}
                disabled={!manage}
                onChange={(e) => setDestForm({ ...destForm, name: e.target.value })}
              />
            </label>
            <label className="block text-xs text-slate-400">
              Phone (E.164)
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
                placeholder="+18002738255"
                value={destForm.phoneE164}
                disabled={!manage}
                onChange={(e) => setDestForm({ ...destForm, phoneE164: e.target.value })}
              />
            </label>
            <label className="block text-xs text-slate-400">
              Portal URL
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
                value={destForm.portalUrl}
                disabled={!manage}
                onChange={(e) => setDestForm({ ...destForm, portalUrl: e.target.value })}
              />
            </label>
            {manage ? (
              <button
                type="button"
                className="rounded border border-amber-700 bg-amber-900/40 px-3 py-1.5 text-xs font-medium text-amber-100 disabled:opacity-50"
                disabled={saveDestMut.isPending || !destForm.name.trim()}
                onClick={() => saveDestMut.mutate()}
              >
                Save destination
              </button>
            ) : null}
          </div>
          <ul className="space-y-2">
            {(destQuery.data ?? []).map((d) => (
              <li
                key={d.destinationId}
                className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-300"
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">
                      {d.name}{" "}
                      <span className="font-normal text-slate-500">· {d.type}</span>
                    </p>
                    {d.phoneE164 ? <p className="text-xs text-slate-500">{d.phoneE164}</p> : null}
                  </div>
                  {manage ? (
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        className="text-sky-400 hover:underline"
                        onClick={() =>
                          setDestForm({
                            destinationId: d.destinationId,
                            type: d.type,
                            name: d.name,
                            phoneE164: d.phoneE164 ?? "",
                            portalUrl: d.portalUrl ?? "",
                            smsTemplate: d.smsTemplate ?? "",
                            enabled: d.enabled,
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-rose-400 hover:underline"
                        onClick={async () => {
                          await deleteCrisisDestination(d.destinationId);
                          await qc.invalidateQueries({ queryKey: ["crisis-destinations"] });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "config" ? (
        <section className="max-w-lg space-y-3">
          <h2 className="text-sm font-semibold text-white">Unit costs (savings estimates)</h2>
          <p className="text-xs text-slate-500">
            Agency-supplied avoided-response costs used for savings estimates in metrics.
            {configQuery.data
              ? ` Current: LE $${configQuery.data.unitCostAvoidedLeUsd ?? 0} · EMS $${configQuery.data.unitCostAvoidedEmsUsd ?? 0}.`
              : null}
          </p>
          <label className="block text-xs text-slate-400">
            Avoided LE response (USD)
            <input
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
              value={costLe}
              disabled={!manage}
              onChange={(e) => setCostLe(e.target.value)}
              placeholder="350"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Avoided EMS response (USD)
            <input
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
              value={costEms}
              disabled={!manage}
              onChange={(e) => setCostEms(e.target.value)}
              placeholder="800"
            />
          </label>
          {manage ? (
            <button
              type="button"
              className="rounded border border-amber-700 bg-amber-900/40 px-3 py-1.5 text-xs font-medium text-amber-100"
              disabled={saveConfigMut.isPending}
              onClick={() => saveConfigMut.mutate()}
            >
              Save config
            </button>
          ) : null}
        </section>
      ) : null}

      {tab === "clinician" ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Clinician consult queue</h2>
          <p className="text-xs text-slate-500">
            Uses existing supervisor / agency admin roles. Dispatchers can request consults from
            the NG9-1-1 assist panel.
          </p>
          {(consultQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No consults yet.</p>
          ) : (
            <ul className="space-y-2">
              {(consultQuery.data ?? []).map((c) => (
                <li
                  key={c.consultId}
                  className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-300"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">
                        {c.status}{" "}
                        <span className="font-normal text-slate-500">· {c.consultId.slice(0, 18)}…</span>
                      </p>
                      {c.summary ? <p className="mt-1 text-xs text-slate-400">{c.summary}</p> : null}
                    </div>
                    {canManage(user.role) || user.role === "supervisor" ? (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {c.status === "pending" ? (
                          <button
                            type="button"
                            className="text-sky-400 hover:underline"
                            onClick={async () => {
                              await patchClinicianConsult(c.consultId, {
                                status: "accepted",
                                assignedTo: user.userId,
                              });
                              await qc.invalidateQueries({ queryKey: ["crisis-clinician-queue"] });
                            }}
                          >
                            Accept
                          </button>
                        ) : null}
                        {c.status === "accepted" || c.status === "in_progress" ? (
                          <button
                            type="button"
                            className="text-emerald-400 hover:underline"
                            onClick={async () => {
                              await patchClinicianConsult(c.consultId, { status: "completed" });
                              await qc.invalidateQueries({ queryKey: ["crisis-clinician-queue"] });
                            }}
                          >
                            Complete
                          </button>
                        ) : null}
                        {c.status !== "escalated_le" && c.status !== "completed" ? (
                          <button
                            type="button"
                            className="text-rose-400 hover:underline"
                            onClick={async () => {
                              await patchClinicianConsult(c.consultId, { status: "escalated_le" });
                              await qc.invalidateQueries({ queryKey: ["crisis-clinician-queue"] });
                            }}
                          >
                            Escalate LE
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
