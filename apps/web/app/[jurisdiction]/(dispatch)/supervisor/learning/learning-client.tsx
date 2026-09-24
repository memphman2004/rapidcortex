"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  Cog,
  GraduationCap,
  Users,
} from "lucide-react";
import type {
  LearningPattern,
  LearningPatternStatus,
  TrainingRecommendationType,
} from "rapid-cortex-shared";
import { featureSuiteFetch } from "@/lib/feature-suite-client";

const SURFACE = "bg-[#161b2e] border border-[#1e2130]";

const STATUS_STYLE: Record<LearningPatternStatus, string> = {
  new: "bg-sky-500/15 text-sky-300",
  acknowledged: "bg-slate-500/15 text-slate-300",
  in_remediation: "bg-amber-500/15 text-amber-300",
  resolved: "bg-emerald-500/15 text-emerald-300",
  monitoring: "bg-purple-500/15 text-purple-300",
};

const REC_ICON: Record<TrainingRecommendationType, typeof GraduationCap> = {
  scenario_training: GraduationCap,
  protocol_review: BookOpen,
  coaching_session: Users,
  policy_update: BookOpen,
  system_config: Cog,
};

type Props = { jurisdiction: string; agencyId: string };
type Tab = "patterns" | "pir";

function impactRingClass(score: number): string {
  if (score >= 80) return "border-[#E24B4A] text-[#E24B4A]";
  if (score >= 50) return "border-[#EF9F27] text-[#EF9F27]";
  return "border-[#1D9E75] text-[#1D9E75]";
}

export function LearningClient({ agencyId }: Props) {
  const [tab, setTab] = useState<Tab>("patterns");
  const [localStatus, setLocalStatus] = useState<Record<string, LearningPatternStatus>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [completedRecs, setCompletedRecs] = useState<Record<string, boolean>>({});

  const query = useQuery({
    queryKey: ["feature-learning", agencyId],
    queryFn: () =>
      featureSuiteFetch<{ patterns: LearningPattern[] }>("learning/patterns"),
  });

  const patterns = useMemo(() => {
    const list = [...(query.data?.patterns ?? [])];
    list.sort((a, b) => b.impactScore - a.impactScore);
    return list.map((p) => ({
      ...p,
      status: localStatus[p.patternId] ?? p.status,
    }));
  }, [query.data, localStatus]);

  const stats = useMemo(() => {
    const counts = {
      new: 0,
      highImpact: 0,
      remediation: 0,
      resolved: 0,
    };
    for (const p of patterns) {
      if (p.status === "new") counts.new += 1;
      if (p.impactScore >= 80) counts.highImpact += 1;
      if (p.status === "in_remediation") counts.remediation += 1;
      if (p.status === "resolved") counts.resolved += 1;
    }
    return counts;
  }, [patterns]);

  const lastRun = patterns[0]?.detectedAt
    ? new Date(patterns[0].detectedAt).toLocaleString()
    : "—";

  return (
    <div className="min-h-full bg-[#0f1117] p-4 text-[#e2e4ea] md:p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">After-Action Learning</h1>
        <p className="mt-1 text-sm text-[#9ca3af]">
          Patterns ranked by operational impact with remediation recommendations.
        </p>
      </header>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "New patterns", value: stats.new, icon: Activity },
          { label: "High impact", value: stats.highImpact, icon: Activity },
          { label: "In remediation", value: stats.remediation, icon: BookOpen },
          { label: "Resolved", value: stats.resolved, icon: CheckCircle2 },
        ].map((card) => (
          <div key={card.label} className={`${SURFACE} rounded-lg p-4`}>
            <div className="flex items-center justify-between text-xs text-[#6b7280]">
              {card.label}
              <card.icon className="h-4 w-4 text-[#378ADD]" />
            </div>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>
      <p className="mb-4 text-xs text-[#6b7280]">Last analysis run: {lastRun}</p>

      <div className="mb-4 flex gap-2">
        {(
          [
            ["patterns", "Patterns"],
            ["pir", "PIR insights"],
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

      {tab === "pir" ? (
        <div className={`${SURFACE} rounded-lg p-8 text-center text-sm text-[#9ca3af]`}>
          Quarterly PIR insights appear here when generated from after-action reviews. No PIR
          insights are available for this agency yet.
        </div>
      ) : query.isLoading ? (
        <div className={`${SURFACE} rounded-lg p-8 text-center text-sm text-[#9ca3af]`}>
          Loading patterns…
        </div>
      ) : query.isError ? (
        <div className={`${SURFACE} rounded-lg p-8 text-center text-sm text-[#E24B4A]`}>
          {(query.error as Error).message}
        </div>
      ) : patterns.length === 0 ? (
        <div className={`${SURFACE} rounded-lg p-8 text-center text-sm text-[#9ca3af]`}>
          No learning patterns detected yet.
        </div>
      ) : (
        <div className="space-y-4">
          {patterns.map((pattern) => {
            const Icon =
              REC_ICON[pattern.recommendations?.[0]?.type ?? "coaching_session"] ?? Users;
            return (
              <article key={pattern.patternId} className={`${SURFACE} rounded-lg p-4`}>
                <div className="flex flex-wrap items-start gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${impactRingClass(pattern.impactScore)}`}
                    title="Impact score"
                  >
                    {Math.round(pattern.impactScore)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold">{pattern.title}</h2>
                      <span className="rounded bg-[#1a2035] px-2 py-0.5 text-[11px] text-[#9ca3af]">
                        {pattern.patternType.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] capitalize ${STATUS_STYLE[pattern.status]}`}
                      >
                        {pattern.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#6b7280]">
                      {pattern.frequency} occurrences · last {pattern.lookbackDays} days
                    </p>
                    <p className="mt-2 text-sm text-[#9ca3af]">{pattern.description}</p>
                    {pattern.rootCauseHypothesis ? (
                      <p className="mt-2 text-sm italic text-[#7C3AED]/90">
                        {pattern.rootCauseHypothesis}
                      </p>
                    ) : null}

                    {(pattern.evidenceSnippets ?? []).length > 0 ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          className="text-xs text-[#378ADD] hover:underline"
                          onClick={() =>
                            setExpanded((e) => ({
                              ...e,
                              [pattern.patternId]: !e[pattern.patternId],
                            }))
                          }
                        >
                          {expanded[pattern.patternId] ? "Hide" : "Show"} evidence snippets
                        </button>
                        {expanded[pattern.patternId] ? (
                          <ul className="mt-2 space-y-1 text-xs text-[#6b7280]">
                            {pattern.evidenceSnippets.map((snip, i) => (
                              <li key={i} className="rounded bg-[#0f1117] px-2 py-1.5">
                                {snip}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {pattern.status === "new" ? (
                        <button
                          type="button"
                          className="rounded-md bg-[#378ADD] px-2.5 py-1.5 text-xs font-medium text-white"
                          onClick={() =>
                            setLocalStatus((s) => ({
                              ...s,
                              [pattern.patternId]: "acknowledged",
                            }))
                          }
                        >
                          Acknowledge
                        </button>
                      ) : null}
                      <select
                        className="rounded-md border border-[#1e2130] bg-[#0f1117] px-2 py-1.5 text-xs text-[#e2e4ea]"
                        value={pattern.status}
                        onChange={(e) =>
                          setLocalStatus((s) => ({
                            ...s,
                            [pattern.patternId]: e.target.value as LearningPatternStatus,
                          }))
                        }
                      >
                        {(
                          [
                            "new",
                            "acknowledged",
                            "in_remediation",
                            "resolved",
                            "monitoring",
                          ] as LearningPatternStatus[]
                        ).map((st) => (
                          <option key={st} value={st}>
                            {st.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {(pattern.recommendations ?? []).length > 0 ? (
                  <div className="mt-4 border-t border-[#1e2130] pt-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                      Recommendations
                    </h3>
                    <ul className="space-y-2">
                      {pattern.recommendations.map((rec) => {
                        const RecIcon = REC_ICON[rec.type] ?? Icon;
                        const done = completedRecs[rec.recommendationId];
                        return (
                          <li
                            key={rec.recommendationId}
                            className="flex flex-wrap items-start gap-3 rounded-md bg-[#0f1117] p-3"
                          >
                            <RecIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#378ADD]" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">{rec.title}</span>
                                <span className="rounded bg-[#1a2035] px-1.5 py-0.5 text-[10px] uppercase text-[#9ca3af]">
                                  {rec.priority}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[#9ca3af]">{rec.description}</p>
                              {rec.estimatedEffort ? (
                                <p className="mt-1 text-[11px] text-[#6b7280]">
                                  Effort: {rec.estimatedEffort}
                                </p>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="rounded-md bg-[#1a2035] px-2 py-1 text-[11px] disabled:opacity-50"
                                  disabled={done}
                                  onClick={() =>
                                    setCompletedRecs((c) => ({
                                      ...c,
                                      [rec.recommendationId]: true,
                                    }))
                                  }
                                >
                                  {done ? "Completed" : "Mark complete"}
                                </button>
                                {rec.linkedScenarioId ? (
                                  <span className="rounded-md bg-[#7C3AED]/20 px-2 py-1 text-[11px] text-purple-200">
                                    Scenario {rec.linkedScenarioId}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
