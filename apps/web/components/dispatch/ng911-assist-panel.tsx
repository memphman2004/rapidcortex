"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CrisisAssessment, CrisisDestinationType, CrisisProtocol } from "rapid-cortex-shared";
import {
  answerCrisisStep,
  autoBuildAdditionalData,
  completeCrisisAssessment,
  createClinicianConsult,
  getAdditionalDataPackage,
  getIncidentEido,
  listCrisisDestinations,
  Ng911ApiError,
  partnerEidoHandoff,
  requestCrisisWarmTransfer,
  selectCrisisDestination,
  startCrisisAssessment,
} from "@/lib/ng911/ng911-api";
import { isNg911AssistEnabled } from "@/lib/runtime-flags";

const DEST_TYPES: CrisisDestinationType[] = [
  "988",
  "mobile_crisis",
  "community_responder",
  "le_ems",
  "portal_sms",
];

export function Ng911AssistPanel({ incidentId }: { incidentId: string | null }) {
  const qc = useQueryClient();
  const [eidoJson, setEidoJson] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<CrisisAssessment | null>(null);
  const [protocol, setProtocol] = useState<CrisisProtocol | null>(null);
  const [callerPhone, setCallerPhone] = useState("");

  const pkgQuery = useQuery({
    queryKey: ["ng911-additional-data", incidentId],
    queryFn: () => getAdditionalDataPackage(incidentId!),
    enabled: Boolean(incidentId) && isNg911AssistEnabled(),
  });

  const destQuery = useQuery({
    queryKey: ["crisis-destinations"],
    queryFn: listCrisisDestinations,
    enabled: isNg911AssistEnabled(),
  });

  const autoBuildMut = useMutation({
    mutationFn: () => autoBuildAdditionalData(incidentId!),
    onSuccess: async () => {
      setMessage("Additional Data package rebuilt from incident sources.");
      await qc.invalidateQueries({ queryKey: ["ng911-additional-data", incidentId] });
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const eidoMut = useMutation({
    mutationFn: () => getIncidentEido(incidentId!, true),
    onSuccess: (doc) => {
      setEidoJson(JSON.stringify(doc, null, 2));
      setMessage("EIDO export ready.");
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const handoffMut = useMutation({
    mutationFn: () =>
      partnerEidoHandoff({
        incidentId: incidentId!,
        partnerAgencyId: "partner-mock",
        dryRun: true,
        includeAdditionalData: true,
      }),
    onSuccess: (r) => setMessage(`Partner EIDO handoff: ${r.status} (${r.handoffId.slice(0, 16)}…)`),
    onError: (e: Error) => setMessage(e.message),
  });

  const startMut = useMutation({
    mutationFn: () =>
      startCrisisAssessment({
        incidentId: incidentId ?? undefined,
      }),
    onSuccess: (r) => {
      setAssessment(r.assessment);
      setProtocol(r.protocol);
      setMessage("Crisis assessment started.");
    },
    onError: (e: Error) => setMessage(e.message),
  });

  if (!isNg911AssistEnabled()) {
    return <p className="p-3 text-xs text-slate-500">NG9-1-1 assist is not enabled for this deployment.</p>;
  }

  const items = pkgQuery.data?.items ?? [];
  const nextStep =
    protocol && assessment?.status === "in_progress"
      ? protocol.steps
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .find((s) => !assessment.answers.some((a) => a.stepId === s.stepId))
      : undefined;

  return (
    <div className="space-y-4 p-3 text-xs text-slate-300">
      <section className="space-y-2 border-b border-slate-800 pb-3">
        <p className="font-semibold uppercase tracking-wide text-amber-400/90">Crisis assessment</p>
        {!assessment ? (
          <button
            type="button"
            className="rounded border border-amber-700 bg-amber-900/40 px-2 py-1 font-medium text-amber-100 hover:bg-amber-800/50 disabled:opacity-50"
            disabled={startMut.isPending}
            onClick={() => {
              setMessage(null);
              startMut.mutate();
            }}
          >
            {startMut.isPending ? "Starting…" : "Start crisis diversion"}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-slate-400">
              Status: <span className="text-white">{assessment.status}</span>
              {assessment.hardStopReason ? (
                <span className="ml-2 text-rose-300">Hard stop: {assessment.hardStopReason}</span>
              ) : null}
            </p>
            {nextStep ? (
              <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
                <p className="font-medium text-white">{nextStep.question}</p>
                {nextStep.hardStopOnYes ? (
                  <p className="mt-1 text-[10px] text-rose-300">Yes → hard stop (LE/EMS)</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  {(["yes", "no", "unknown"] as const).map((ans) => (
                    <button
                      key={ans}
                      type="button"
                      className="rounded border border-slate-600 px-2 py-0.5 capitalize text-slate-200 hover:bg-slate-800"
                      onClick={async () => {
                        try {
                          const next = await answerCrisisStep({
                            assessmentId: assessment.assessmentId,
                            stepId: nextStep.stepId,
                            answer: ans,
                          });
                          setAssessment(next);
                          setMessage(
                            next.status === "hard_stopped"
                              ? "Hard stop — route to LE/EMS."
                              : "Answer recorded.",
                          );
                        } catch (e) {
                          setMessage(e instanceof Error ? e.message : "Answer failed");
                        }
                      }}
                    >
                      {ans}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {(assessment.status === "destination_selected" ||
              assessment.status === "hard_stopped" ||
              assessment.status === "handoff_in_progress" ||
              assessment.recommendedDestination) &&
            assessment.status !== "completed" ? (
              <div className="space-y-2 rounded border border-slate-800 bg-slate-950/60 p-2">
                <p className="text-slate-400">
                  Recommended:{" "}
                  <span className="text-white">
                    {assessment.recommendedDestination ?? assessment.selectedDestination ?? "—"}
                  </span>
                </p>
                {assessment.status !== "hard_stopped" ? (
                  <div className="flex flex-wrap gap-1">
                    {DEST_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="rounded border border-sky-800 px-2 py-0.5 text-sky-200 hover:bg-sky-950"
                        onClick={async () => {
                          try {
                            const dest = destQuery.data?.find((d) => d.type === t && d.enabled);
                            const next = await selectCrisisDestination({
                              assessmentId: assessment.assessmentId,
                              destinationType: t,
                              destinationId: dest?.destinationId,
                              callerPhoneE164:
                                t === "portal_sms" && callerPhone.trim()
                                  ? callerPhone.trim()
                                  : undefined,
                            });
                            setAssessment(next);
                            setMessage(`Destination: ${t}`);
                          } catch (e) {
                            setMessage(e instanceof Error ? e.message : "Select failed");
                          }
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="rounded border border-rose-800 px-2 py-0.5 text-rose-200"
                    onClick={async () => {
                      const next = await selectCrisisDestination({
                        assessmentId: assessment.assessmentId,
                        destinationType: "le_ems",
                      });
                      setAssessment(next);
                    }}
                  >
                    Confirm LE/EMS
                  </button>
                )}
                {assessment.selectedDestination === "portal_sms" ||
                assessment.recommendedDestination === "portal_sms" ? (
                  <input
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-white"
                    placeholder="Caller +E.164 for portal SMS"
                    value={callerPhone}
                    onChange={(e) => setCallerPhone(e.target.value)}
                  />
                ) : null}
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded border border-violet-700 px-2 py-0.5 text-violet-200"
                    onClick={async () => {
                      try {
                        const next = await requestCrisisWarmTransfer({
                          assessmentId: assessment.assessmentId,
                        });
                        setAssessment(next);
                        setMessage(
                          `Warm transfer ${next.warmTransfer?.status}${next.warmTransfer?.mock ? " (mock)" : ""}`,
                        );
                      } catch (e) {
                        setMessage(e instanceof Error ? e.message : "Transfer failed");
                      }
                    }}
                  >
                    Warm transfer
                  </button>
                  <button
                    type="button"
                    className="rounded border border-emerald-800 px-2 py-0.5 text-emerald-200"
                    onClick={async () => {
                      try {
                        await createClinicianConsult({ assessmentId: assessment.assessmentId });
                        setMessage("Clinician consult requested.");
                      } catch (e) {
                        setMessage(e instanceof Error ? e.message : "Consult failed");
                      }
                    }}
                  >
                    Request clinician
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-600 px-2 py-0.5 text-slate-200"
                    onClick={async () => {
                      try {
                        const next = await completeCrisisAssessment({
                          assessmentId: assessment.assessmentId,
                          phoneResolved: true,
                          divertedFromLe: assessment.selectedDestination !== "le_ems",
                          divertedFromEms: assessment.selectedDestination !== "le_ems",
                        });
                        setAssessment(next);
                        setMessage("Outcome recorded.");
                      } catch (e) {
                        setMessage(e instanceof Error ? e.message : "Complete failed");
                      }
                    }}
                  >
                    Complete
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {!incidentId ? (
        <p className="text-slate-500">Select an incident for EIDO / Additional Data.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-sky-700 bg-sky-900/40 px-2 py-1 font-medium text-sky-200 hover:bg-sky-800/50 disabled:opacity-50"
              disabled={autoBuildMut.isPending}
              onClick={() => {
                setMessage(null);
                autoBuildMut.mutate();
              }}
            >
              {autoBuildMut.isPending ? "Building…" : "Auto-build Additional Data"}
            </button>
            <button
              type="button"
              className="rounded border border-violet-700 bg-violet-900/40 px-2 py-1 font-medium text-violet-200 hover:bg-violet-800/50 disabled:opacity-50"
              disabled={eidoMut.isPending}
              onClick={() => {
                setMessage(null);
                eidoMut.mutate();
              }}
            >
              {eidoMut.isPending ? "Exporting…" : "Export EIDO"}
            </button>
            <button
              type="button"
              className="rounded border border-slate-600 px-2 py-1 text-slate-200 disabled:opacity-50"
              disabled={handoffMut.isPending}
              onClick={() => {
                setMessage(null);
                handoffMut.mutate();
              }}
            >
              Partner EIDO (mock)
            </button>
          </div>

          <div>
            <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
              Additional Data ({items.length})
            </p>
            {pkgQuery.isLoading ? (
              <p className="text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-slate-500">No package yet. Auto-build from the incident record.</p>
            ) : (
              <ul className="max-h-40 space-y-2 overflow-y-auto">
                {items.map((item) => (
                  <li key={item.itemId} className="rounded border border-slate-800 bg-slate-950/50 p-2">
                    <p className="font-medium text-slate-200">
                      [{item.provider}] {item.label}
                    </p>
                    <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-slate-400">{item.value}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {eidoJson ? (
            <div>
              <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">EIDO JSON</p>
              <pre className="max-h-48 overflow-auto rounded border border-slate-800 bg-slate-950/80 p-2 text-[10px] text-slate-400">
                {eidoJson}
              </pre>
            </div>
          ) : null}
        </>
      )}

      {message ? <p className="text-sky-300/90">{message}</p> : null}
      {pkgQuery.isError ? (
        <p className="text-rose-300">
          {pkgQuery.error instanceof Ng911ApiError
            ? pkgQuery.error.message
            : "Failed to load Additional Data"}
        </p>
      ) : null}
    </div>
  );
}
