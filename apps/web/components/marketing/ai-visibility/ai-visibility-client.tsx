"use client";

/**
 * AI Visibility Monitoring — Marketing Dashboard
 *
 * Tracks NexCort iQ's presence in AI search answers across ChatGPT, Claude,
 * Gemini, Perplexity, and Bing Chat.
 *
 * DATA STORAGE NOTE (Phase 1):
 * Test results are stored in localStorage (browser only). Results are not shared
 * across team members or devices. Phase 2 will add a shared backend via DynamoDB
 * + Lambda to persist results across the team.
 */

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type AiPlatform =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "perplexity"
  | "bing_copilot"
  | "other";

type TestCategory =
  | "911_psap"
  | "cad_interop"
  | "ng911"
  | "nexiq"
  | "campus"
  | "venue"
  | "transit"
  | "iq_vision";

type VisibilityResult = "mentioned" | "cited" | "not_mentioned" | "not_tested";

type TestResult = {
  id: string;
  question: string;
  category: TestCategory;
  platform: AiPlatform;
  testedAt: string; // ISO date string
  result: VisibilityResult;
  citationUrl?: string;
  competitorsMentioned?: string;
  notes?: string;
};

type QuestionTemplate = {
  id: string;
  question: string;
  category: TestCategory;
};

// ── Question library ──────────────────────────────────────────────────────────

const QUESTION_LIBRARY: QuestionTemplate[] = [
  // 911 / PSAP
  { id: "q_911_1", category: "911_psap", question: "What are the best AI tools for 911 dispatch centers?" },
  { id: "q_911_2", category: "911_psap", question: "What software can help 911 dispatchers with real-time call support?" },
  { id: "q_911_3", category: "911_psap", question: "What AI platforms support emergency communications centers?" },
  { id: "q_911_4", category: "911_psap", question: "Which companies sell AI software for PSAPs?" },
  { id: "q_911_5", category: "911_psap", question: "What technology helps 911 centers handle calls in multiple languages?" },
  // CAD interoperability
  { id: "q_cad_1", category: "cad_interop", question: "What software provides CAD-to-CAD interoperability?" },
  { id: "q_cad_2", category: "cad_interop", question: "Which software can integrate with an existing CAD system?" },
  { id: "q_cad_3", category: "cad_interop", question: "How can police departments share incidents between different CAD platforms?" },
  // NG911
  { id: "q_ng_1", category: "ng911", question: "What is the difference between NG911 and AI dispatch assistance?" },
  { id: "q_ng_2", category: "ng911", question: "What software helps agencies transition to NG911?" },
  // NEXiQ
  { id: "q_nx_1", category: "nexiq", question: "How can police departments automate non-emergency calls?" },
  { id: "q_nx_2", category: "nexiq", question: "What AI can handle police non-emergency line calls?" },
  { id: "q_nx_3", category: "nexiq", question: "How can cities add AI to 311 services?" },
  { id: "q_nx_4", category: "nexiq", question: "What alternatives exist to traditional 311 call handling?" },
  // Campus
  { id: "q_campus_1", category: "campus", question: "What technology helps university students report emergencies without an app?" },
  { id: "q_campus_2", category: "campus", question: "What is the best campus safety software for universities?" },
  { id: "q_campus_3", category: "campus", question: "What software handles QR code emergency reporting on college campuses?" },
  // Venue
  { id: "q_venue_1", category: "venue", question: "What software is used for stadium security incident reporting?" },
  { id: "q_venue_2", category: "venue", question: "What are the best tools for venue security operations?" },
  // Transit
  { id: "q_transit_1", category: "transit", question: "What software helps transit agencies manage safety incidents?" },
  { id: "q_transit_2", category: "transit", question: "What is the best transit safety management platform?" },
  // iQ Vision
  { id: "q_vision_1", category: "iq_vision", question: "What AI platforms provide security camera incident detection?" },
  { id: "q_vision_2", category: "iq_vision", question: "Can existing security cameras support AI incident detection?" },
  { id: "q_vision_3", category: "iq_vision", question: "Which public safety platforms provide AI camera incident monitoring?" },
];

const PLATFORM_LABELS: Record<AiPlatform, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
  bing_copilot: "Bing Copilot",
  other: "Other",
};

const PLATFORM_COLORS: Record<AiPlatform, string> = {
  chatgpt: "bg-emerald-900/40 text-emerald-300 border-emerald-800/40",
  claude: "bg-orange-900/40 text-orange-300 border-orange-800/40",
  gemini: "bg-blue-900/40 text-blue-300 border-blue-800/40",
  perplexity: "bg-purple-900/40 text-purple-300 border-purple-800/40",
  bing_copilot: "bg-sky-900/40 text-sky-300 border-sky-800/40",
  other: "bg-slate-800/40 text-slate-400 border-slate-700/40",
};

const CATEGORY_LABELS: Record<TestCategory, string> = {
  "911_psap": "911 / PSAP",
  cad_interop: "CAD Interop",
  ng911: "NG911",
  nexiq: "NEXiQ",
  campus: "Campus",
  venue: "Venue",
  transit: "Transit",
  iq_vision: "iQ Vision",
};

const RESULT_CONFIG: Record<VisibilityResult, { label: string; color: string; short: string }> = {
  mentioned: {
    label: "Mentioned NexCort iQ",
    short: "Mentioned",
    color: "text-emerald-300 bg-emerald-950/50 border-emerald-700/40",
  },
  cited: {
    label: "Cited nexcortiq.us",
    short: "Cited URL",
    color: "text-sky-300 bg-sky-950/50 border-sky-700/40",
  },
  not_mentioned: {
    label: "Not mentioned",
    short: "Not found",
    color: "text-slate-500 bg-slate-800/50 border-slate-700/40",
  },
  not_tested: {
    label: "Not tested yet",
    short: "Pending",
    color: "text-amber-400/60 bg-amber-950/20 border-amber-800/30",
  },
};

const STORAGE_KEY = "rc_ai_visibility_results_v1";

function loadResults(): TestResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TestResult[]) : [];
  } catch {
    return [];
  }
}

function saveResults(results: TestResult[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Summary computation ───────────────────────────────────────────────────────

function computeSummary(results: TestResult[]) {
  const total = results.length;
  const mentioned = results.filter((r) => r.result === "mentioned" || r.result === "cited").length;
  const cited = results.filter((r) => r.result === "cited").length;
  const notMentioned = results.filter((r) => r.result === "not_mentioned").length;

  const byPlatform: Partial<Record<AiPlatform, { total: number; mentioned: number }>> = {};
  for (const r of results) {
    if (!byPlatform[r.platform]) byPlatform[r.platform] = { total: 0, mentioned: 0 };
    byPlatform[r.platform]!.total += 1;
    if (r.result === "mentioned" || r.result === "cited") {
      byPlatform[r.platform]!.mentioned += 1;
    }
  }

  const byCategory: Partial<Record<TestCategory, { total: number; mentioned: number }>> = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = { total: 0, mentioned: 0 };
    byCategory[r.category]!.total += 1;
    if (r.result === "mentioned" || r.result === "cited") {
      byCategory[r.category]!.mentioned += 1;
    }
  }

  return { total, mentioned, cited, notMentioned, byPlatform, byCategory };
}

// ── Component ─────────────────────────────────────────────────────────────────

type TabId = "overview" | "question_library" | "log_result" | "results";

export function AiVisibilityClient() {
  const [tab, setTab] = useState<TabId>("overview");
  const [results, setResults] = useState<TestResult[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Form state for logging a new result
  const [form, setForm] = useState<{
    questionId: string;
    customQuestion: string;
    platform: AiPlatform;
    result: VisibilityResult;
    citationUrl: string;
    competitorsMentioned: string;
    notes: string;
    testedAt: string;
  }>({
    questionId: "",
    customQuestion: "",
    platform: "chatgpt",
    result: "not_mentioned",
    citationUrl: "",
    competitorsMentioned: "",
    notes: "",
    testedAt: new Date().toISOString().split("T")[0] ?? "",
  });

  useEffect(() => {
    setResults(loadResults());
    setHydrated(true);
  }, []);

  const addResult = useCallback(() => {
    const template = QUESTION_LIBRARY.find((q) => q.id === form.questionId);
    const questionText = template?.question ?? form.customQuestion.trim();
    if (!questionText) return;

    const newResult: TestResult = {
      id: uid(),
      question: questionText,
      category: template?.category ?? "911_psap",
      platform: form.platform,
      testedAt: form.testedAt,
      result: form.result,
      citationUrl: form.citationUrl.trim() || undefined,
      competitorsMentioned: form.competitorsMentioned.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    const updated = [newResult, ...results];
    setResults(updated);
    saveResults(updated);
    setForm((f) => ({
      ...f,
      questionId: "",
      customQuestion: "",
      citationUrl: "",
      competitorsMentioned: "",
      notes: "",
    }));
    setTab("results");
  }, [form, results]);

  const deleteResult = useCallback(
    (id: string) => {
      const updated = results.filter((r) => r.id !== id);
      setResults(updated);
      saveResults(updated);
    },
    [results],
  );

  if (!hydrated) {
    return <div className="animate-pulse text-sm text-slate-500 py-8">Loading…</div>;
  }

  const summary = computeSummary(results);

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "question_library", label: "Question Library" },
    { id: "log_result", label: "Log a Test" },
    { id: "results", label: `Results (${results.length})` },
  ];

  return (
    <div>
      {/* Storage disclaimer */}
      <div className="mb-4 rounded-lg border border-amber-900/30 bg-amber-950/20 px-4 py-2.5 text-xs text-amber-200/70">
        <strong>Phase 1 — Local storage only.</strong> Test results are saved in this browser only
        and are not shared with other team members. A shared backend (DynamoDB + Lambda) will be
        added in Phase 2.{" "}
        <span className="text-amber-300/60">
          Export results with the CSV download before clearing browser data.
        </span>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-[#0a1628] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-sky-700 text-white"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* KPI summary */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total tests logged"
              value={summary.total.toString()}
              note="across all platforms"
            />
            <KpiCard
              label="Tests with mention *"
              value={summary.total > 0 ? `${Math.round((summary.mentioned / summary.total) * 100)}%` : "—"}
              note={`${summary.mentioned} of ${summary.total} tests`}
              accent
            />
            <KpiCard
              label="Tests with URL citation"
              value={summary.cited.toString()}
              note="nexcortiq.us cited directly"
            />
            <KpiCard
              label="Not mentioned"
              value={summary.notMentioned.toString()}
              note="content gap opportunities"
            />
          </div>

          {/* By platform */}
          {Object.keys(summary.byPlatform).length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-200">Visibility by Platform</h2>
              <div className="space-y-3">
                {(Object.entries(summary.byPlatform) as [AiPlatform, { total: number; mentioned: number }][]).map(
                  ([platform, stats]) => {
                    const pct = Math.round((stats.mentioned / stats.total) * 100);
                    return (
                      <div key={platform} className="flex items-center gap-3">
                        <span
                          className={`w-28 shrink-0 rounded-full border px-2 py-0.5 text-center text-xs font-medium ${PLATFORM_COLORS[platform]}`}
                        >
                          {PLATFORM_LABELS[platform]}
                        </span>
                        <div className="flex-1">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full bg-sky-600 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-24 shrink-0 text-right text-xs text-slate-400">
                          {pct}% ({stats.mentioned}/{stats.total})
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          )}

          {/* By category */}
          {Object.keys(summary.byCategory).length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-200">Coverage by Category</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(Object.entries(summary.byCategory) as [TestCategory, { total: number; mentioned: number }][]).map(
                  ([cat, stats]) => {
                    const pct = Math.round((stats.mentioned / stats.total) * 100);
                    return (
                      <div
                        key={cat}
                        className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                      >
                        <p className="mb-1 text-xs text-slate-500">{CATEGORY_LABELS[cat]}</p>
                        <p className="text-lg font-bold text-white">{pct}%</p>
                        <p className="text-xs text-slate-500">
                          {stats.mentioned} of {stats.total} tests
                        </p>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          )}

          {/* Sampling caveat — always visible in overview */}
          <p className="text-[11px] leading-relaxed text-slate-600">
            * Results reflect{" "}
            <span
              title="Manual spot tests: single queries run by a human at a point in time. Not a comprehensive audit of all query variations, session types, or geographic regions."
              className="cursor-help underline decoration-dashed decoration-slate-600 underline-offset-2"
            >
              manual spot tests only
            </span>
            . AI platform responses vary by query phrasing, session context, and geography — a
            single test per question per platform is not statistically representative. Use this
            dashboard to track trends over time, not as a definitive audit.
          </p>

          {summary.total === 0 && (
            <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center">
              <p className="mb-3 text-sm text-slate-500">
                No tests logged yet. Use the Question Library to find test prompts, then log
                results after running them in each AI platform.
              </p>
              <button
                type="button"
                onClick={() => setTab("question_library")}
                className="rounded-lg bg-sky-700/20 px-4 py-2 text-sm text-sky-400 hover:bg-sky-700/40"
              >
                Browse question library →
              </button>
            </div>
          )}

          {/* AI referral note */}
          <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-200">AI Referral Attribution</h2>
            <p className="text-sm text-slate-400">
              AI-referred website visits and CRM leads are tracked via UTM parameters and referrer
              URL patterns. CRM leads with <code className="text-sky-400">utm_source=chatgpt</code>,{" "}
              <code className="text-sky-400">claude.ai</code> referrer, or similar signals are
              attributed in the Marketing Overview channel breakdown.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Note: Many AI answer-to-click sessions arrive as "direct" traffic with no referrer —
              AI attribution is an undercount, not a complete picture.
            </p>
            <a
              href="/rc-admin/marketing"
              className="mt-3 inline-block text-xs text-sky-500 hover:text-sky-400 hover:underline"
            >
              View Marketing Overview channel mix →
            </a>
          </div>
        </div>
      )}

      {/* ── Question Library ── */}
      {tab === "question_library" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Pre-seeded buyer questions organized by category. Run these in each AI platform and
            log whether NexCort iQ was mentioned or cited.
          </p>
          {(Object.entries(CATEGORY_LABELS) as [TestCategory, string][]).map(([cat, catLabel]) => {
            const questions = QUESTION_LIBRARY.filter((q) => q.category === cat);
            if (questions.length === 0) return null;
            return (
              <div
                key={cat}
                className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5"
              >
                <h3 className="mb-3 text-sm font-semibold text-slate-200">{catLabel}</h3>
                <div className="space-y-2">
                  {questions.map((q) => (
                    <div key={q.id} className="flex items-start justify-between gap-3">
                      <p className="text-sm text-slate-400">&ldquo;{q.question}&rdquo;</p>
                      <button
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, questionId: q.id }));
                          setTab("log_result");
                        }}
                        className="shrink-0 rounded-lg bg-sky-900/30 px-2 py-1 text-xs text-sky-400 hover:bg-sky-900/60"
                      >
                        Log result
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Log Result ── */}
      {tab === "log_result" && (
        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-6">
          <h2 className="mb-5 text-base font-semibold text-white">Log an AI Visibility Test</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">
                Question tested *
              </label>
              <select
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none"
                value={form.questionId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, questionId: e.target.value, customQuestion: "" }))
                }
              >
                <option value="">— Choose from library or enter custom —</option>
                {(Object.entries(CATEGORY_LABELS) as [TestCategory, string][]).map(([cat, catLabel]) => (
                  <optgroup key={cat} label={catLabel}>
                    {QUESTION_LIBRARY.filter((q) => q.category === cat).map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.question}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {!form.questionId && (
                <input
                  type="text"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none"
                  placeholder="Or type a custom question…"
                  value={form.customQuestion}
                  onChange={(e) => setForm((f) => ({ ...f, customQuestion: e.target.value }))}
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Platform tested *
                </label>
                <select
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none"
                  value={form.platform}
                  onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as AiPlatform }))}
                >
                  {(Object.entries(PLATFORM_LABELS) as [AiPlatform, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Result *
                </label>
                <select
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none"
                  value={form.result}
                  onChange={(e) => setForm((f) => ({ ...f, result: e.target.value as VisibilityResult }))}
                >
                  <option value="mentioned">Mentioned NexCort iQ (no URL)</option>
                  <option value="cited">Cited nexcortiq.us URL</option>
                  <option value="not_mentioned">Not mentioned</option>
                </select>
              </div>
            </div>

            {(form.result === "cited") && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Citation URL
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none"
                  placeholder="https://www.nexcortiq.us/..."
                  value={form.citationUrl}
                  onChange={(e) => setForm((f) => ({ ...f, citationUrl: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">
                Competitors mentioned (comma-separated)
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none"
                placeholder="e.g. Motorola, Mark43, Carbyne"
                value={form.competitorsMentioned}
                onChange={(e) => setForm((f) => ({ ...f, competitorsMentioned: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Date tested</label>
              <input
                type="date"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-sky-500/50 focus:outline-none"
                value={form.testedAt}
                onChange={(e) => setForm((f) => ({ ...f, testedAt: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Notes</label>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none"
                placeholder="Optional: mode used, search query context, response excerpt…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <button
              type="button"
              disabled={!form.questionId && !form.customQuestion.trim()}
              onClick={addResult}
              className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save result
            </button>
          </div>
        </div>
      )}

      {/* ── Results Log ── */}
      {tab === "results" && (
        <div className="space-y-3">
          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-slate-500">No results logged yet.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{results.length} results logged</p>
                <button
                  type="button"
                  onClick={() => {
                    const csv = [
                      ["Date", "Platform", "Category", "Question", "Result", "Citation URL", "Competitors", "Notes"].join(","),
                      ...results.map((r) =>
                        [
                          r.testedAt,
                          PLATFORM_LABELS[r.platform],
                          CATEGORY_LABELS[r.category],
                          `"${r.question.replace(/"/g, '""')}"`,
                          RESULT_CONFIG[r.result].label,
                          r.citationUrl ?? "",
                          r.competitorsMentioned ?? "",
                          `"${(r.notes ?? "").replace(/"/g, '""')}"`,
                        ].join(","),
                      ),
                    ].join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `ai-visibility-${new Date().toISOString().split("T")[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-slate-400 hover:border-white/20"
                >
                  Export CSV
                </button>
              </div>
              {results.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-white/[0.06] bg-[#0a1628] px-5 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${PLATFORM_COLORS[r.platform]}`}
                        >
                          {PLATFORM_LABELS[r.platform]}
                        </span>
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] text-slate-400">
                          {CATEGORY_LABELS[r.category]}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${RESULT_CONFIG[r.result].color}`}
                        >
                          {RESULT_CONFIG[r.result].short}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200">&ldquo;{r.question}&rdquo;</p>
                      {r.citationUrl && (
                        <a
                          href={r.citationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block truncate text-xs text-sky-500 hover:underline"
                        >
                          {r.citationUrl}
                        </a>
                      )}
                      {r.competitorsMentioned && (
                        <p className="mt-1 text-xs text-slate-500">
                          <span className="text-slate-400">Competitors:</span> {r.competitorsMentioned}
                        </p>
                      )}
                      {r.notes && (
                        <p className="mt-1 text-xs text-slate-500">{r.notes}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-slate-600">{r.testedAt}</span>
                      <button
                        type="button"
                        onClick={() => deleteResult(r.id)}
                        className="text-xs text-red-500/50 hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-sky-800/40 bg-sky-950/20" : "border-white/[0.06] bg-[#0a1628]"
      }`}
    >
      <p className="mb-1 text-xs text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${accent ? "text-sky-300" : "text-white"}`}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
    </div>
  );
}
