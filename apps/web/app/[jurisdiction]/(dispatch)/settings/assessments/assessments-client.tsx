"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  Clock,
  Lock,
  Plus,
  X,
  XCircle,
} from "lucide-react";
import type { AssessmentSession, AssessmentStatus } from "rapid-cortex-shared";
import { featureSuiteFetch } from "@/lib/feature-suite-client";

const SURFACE = "bg-[#161b2e] border border-[#1e2130]";
const INPUT =
  "rounded-md border border-[#1e2130] bg-[#0f1117] px-3 py-2 text-sm text-[#e2e4ea] placeholder:text-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#378ADD]";

const SYSTEM_SCENARIOS = [
  { id: "sys-priority-assignment", title: "Priority assignment", locked: true },
  { id: "sys-location-verify", title: "Location verification", locked: true },
  { id: "sys-language-barrier", title: "Language barrier call", locked: true },
  { id: "sys-mci-intake", title: "MCI intake basics", locked: true },
] as const;

const STATUS_STYLE: Record<AssessmentStatus, string> = {
  not_started: "bg-slate-500/15 text-slate-300",
  in_progress: "bg-sky-500/15 text-sky-300",
  completed: "bg-emerald-500/15 text-emerald-300",
  expired: "bg-amber-500/15 text-amber-300",
  reviewed: "bg-purple-500/15 text-purple-300",
};

type Props = { jurisdiction: string; agencyId: string };
type Tab = "sessions" | "scenarios";

export function AssessmentsClient({ agencyId }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("sessions");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<AssessmentSession | null>(null);
  const [form, setForm] = useState({
    applicantName: "",
    applicantEmail: "",
    scenarioIds: [] as string[],
  });
  const [reviewNotes, setReviewNotes] = useState("");

  const sessionsQuery = useQuery({
    queryKey: ["feature-assessments", agencyId],
    queryFn: () =>
      featureSuiteFetch<{ sessions: AssessmentSession[] }>("assessment/sessions"),
  });

  const createMut = useMutation({
    mutationFn: () =>
      featureSuiteFetch<{ sessionId: string; message: string }>("assessment/sessions", {
        method: "POST",
        body: JSON.stringify({
          applicantName: form.applicantName.trim(),
          applicantEmail: form.applicantEmail.trim(),
          scenarioIds: form.scenarioIds,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feature-assessments", agencyId] });
      setShowCreate(false);
      setForm({ applicantName: "", applicantEmail: "", scenarioIds: [] });
    },
  });

  const sessions = sessionsQuery.data?.sessions ?? [];

  const detail = useMemo(() => {
    if (!selected) return null;
    return sessions.find((s) => s.sessionId === selected.sessionId) ?? selected;
  }, [selected, sessions]);

  const toggleScenario = (id: string) => {
    setForm((f) => ({
      ...f,
      scenarioIds: f.scenarioIds.includes(id)
        ? f.scenarioIds.filter((x) => x !== id)
        : [...f.scenarioIds, id],
    }));
  };

  return (
    <div className="min-h-full bg-[#0f1117] p-4 text-[#e2e4ea] md:p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Pre-Hire Assessments</h1>
        <p className="mt-1 text-sm text-[#9ca3af]">
          Create applicant sessions, assign scenarios, and review scored results.
        </p>
      </header>

      <div className="mb-4 flex gap-2">
        {(
          [
            ["sessions", "Manage assessments"],
            ["scenarios", "Scenarios"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === id
                ? "bg-[#378ADD] text-white"
                : "bg-[#161b2e] text-[#9ca3af] hover:text-[#e2e4ea]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "sessions" ? (
        <>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1D9E75] px-3 py-2 text-sm font-medium text-white"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-4 w-4" />
              Create assessment session
            </button>
          </div>

          {showCreate ? (
            <div className={`${SURFACE} mb-4 space-y-3 rounded-lg p-4`}>
              <h2 className="text-sm font-semibold">New session</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className={INPUT}
                  placeholder="Applicant name"
                  value={form.applicantName}
                  onChange={(e) => setForm((f) => ({ ...f, applicantName: e.target.value }))}
                />
                <input
                  className={INPUT}
                  type="email"
                  placeholder="Applicant email"
                  value={form.applicantEmail}
                  onChange={(e) => setForm((f) => ({ ...f, applicantEmail: e.target.value }))}
                />
              </div>
              <div>
                <p className="mb-2 text-xs text-[#9ca3af]">Select scenarios</p>
                <div className="flex flex-wrap gap-2">
                  {SYSTEM_SCENARIOS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleScenario(s.id)}
                      className={`rounded-md border px-2.5 py-1.5 text-xs ${
                        form.scenarioIds.includes(s.id)
                          ? "border-[#378ADD] bg-[#378ADD]/20 text-[#e2e4ea]"
                          : "border-[#1e2130] bg-[#0f1117] text-[#9ca3af]"
                      }`}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-[#6b7280]">Session expires in 7 days · invite emailed on create</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md bg-[#378ADD] px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  disabled={
                    !form.applicantName.trim() ||
                    !form.applicantEmail.trim() ||
                    form.scenarioIds.length === 0 ||
                    createMut.isPending
                  }
                  onClick={() => createMut.mutate()}
                >
                  Create &amp; send invite
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
              {createMut.isSuccess ? (
                <p className="text-xs text-emerald-300">{createMut.data.message}</p>
              ) : null}
            </div>
          ) : null}

          <div className={`${SURFACE} overflow-x-auto rounded-lg`}>
            {sessionsQuery.isLoading ? (
              <p className="p-8 text-center text-sm text-[#9ca3af]">Loading sessions…</p>
            ) : sessionsQuery.isError ? (
              <p className="p-8 text-center text-sm text-[#E24B4A]">
                {(sessionsQuery.error as Error).message}
              </p>
            ) : (
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b border-[#1e2130] text-xs uppercase text-[#6b7280]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Applicant</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Result</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr
                      key={s.sessionId}
                      className="cursor-pointer border-b border-[#1e2130]/80 hover:bg-[#1a2035]/60"
                      onClick={() => {
                        setSelected(s);
                        setReviewNotes(s.reviewNotes ?? "");
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{s.applicantName}</div>
                        <div className="text-xs text-[#6b7280]">{s.applicantEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[s.status]}`}
                        >
                          {s.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.totalScore != null ? `${s.totalScore}%` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {s.passed == null ? (
                          "—"
                        ) : s.passed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300">
                            <CheckCircle className="h-3.5 w-3.5" /> Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#E24B4A]">
                            <XCircle className="h-3.5 w-3.5" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#9ca3af]">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-[#9ca3af]">
                        {new Date(s.expiresAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-[#6b7280]">
                        No assessment sessions yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#9ca3af]">
            System scenarios are locked. Agency custom scenario authoring uses the same library when
            configured.
          </p>
          {SYSTEM_SCENARIOS.map((s) => (
            <div key={s.id} className={`${SURFACE} flex items-center justify-between rounded-lg px-4 py-3`}>
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-xs text-[#6b7280]">{s.id}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-[#6b7280]">
                <Lock className="h-3.5 w-3.5" /> System
              </span>
            </div>
          ))}
        </div>
      )}

      {detail ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
          <aside className="flex h-full w-full max-w-xl flex-col border-l border-[#1e2130] bg-[#0f1117]">
            <div className="flex items-center justify-between border-b border-[#1e2130] px-4 py-3">
              <div>
                <h2 className="font-semibold">{detail.applicantName}</h2>
                <p className="text-xs text-[#6b7280]">{detail.sessionId}</p>
              </div>
              <button
                type="button"
                className="rounded p-1 text-[#9ca3af] hover:bg-[#161b2e]"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="flex flex-wrap gap-3 text-xs text-[#9ca3af]">
                <span className={`rounded px-2 py-0.5 capitalize ${STATUS_STYLE[detail.status]}`}>
                  {detail.status.replace(/_/g, " ")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Expires {new Date(detail.expiresAt).toLocaleString()}
                </span>
                {detail.totalScore != null ? (
                  <span>
                    Score {detail.totalScore}% (pass ≥ {detail.passingScore}%)
                  </span>
                ) : null}
              </div>

              {(detail.scenarioResults ?? []).length === 0 ? (
                <p className="text-sm text-[#6b7280]">No scenario results yet.</p>
              ) : (
                detail.scenarioResults.map((r) => (
                  <div key={r.scenarioId} className={`${SURFACE} space-y-2 rounded-lg p-3`}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{r.scenarioId}</span>
                      <span>
                        {r.score}/{r.maxScore}
                      </span>
                    </div>
                    {r.aiEvaluation ? (
                      <p className="text-xs italic text-[#9ca3af]">{r.aiEvaluation}</p>
                    ) : null}
                    <p className="text-xs text-[#6b7280]">
                      Completed: {r.actionsCompleted.join(", ") || "—"}
                    </p>
                    <p className="text-xs text-[#6b7280]">
                      Missed: {r.actionsMissed.join(", ") || "—"}
                    </p>
                    {r.timeToFirstAction != null ? (
                      <p className="text-xs text-[#6b7280]">
                        Time to first action: {r.timeToFirstAction}s
                      </p>
                    ) : null}
                  </div>
                ))
              )}

              <div className={`${SURFACE} space-y-2 rounded-lg p-3`}>
                <label className="block text-xs text-[#9ca3af]">
                  Review notes
                  <textarea
                    className={`${INPUT} mt-1 w-full`}
                    rows={3}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                  />
                </label>
                <p className="text-[11px] text-[#6b7280]">
                  Mark reviewed is recorded locally for this session view. Full review write-back
                  ships with the assessment review endpoint.
                </p>
                <button
                  type="button"
                  className="rounded-md bg-[#7C3AED] px-3 py-1.5 text-xs font-medium text-white"
                  onClick={() => setSelected(null)}
                >
                  Mark reviewed
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
