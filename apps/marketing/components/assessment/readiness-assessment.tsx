"use client";

/**
 * 911 Modernization Readiness Assessment
 *
 * A short interactive questionnaire that surfaces relevant NexCort iQ capabilities
 * based on the agency's situation. Produces a non-binding readiness summary.
 *
 * IMPORTANT: Completing this assessment does not indicate compliance, certification,
 * or procurement readiness. It is a discovery tool, not an evaluation.
 */

import { useState, useCallback } from "react";

const DEFAULT_MARKETING_LEAD_URL =
  "https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com/api/marketing/lead";

function marketingLeadSubmitUrl(): string {
  const override =
    typeof process !== "undefined"
      ? (process.env.NEXT_PUBLIC_MARKETING_LEAD_URL?.trim() ?? "")
      : "";
  return override || DEFAULT_MARKETING_LEAD_URL;
}

// ── Question types ────────────────────────────────────────────────────────────

type QuestionId =
  | "cadPlatform"
  | "nonEmergencyVolume"
  | "translationNeeds"
  | "supervisorVisibility"
  | "cadInterop"
  | "cameraInfra"
  | "ngNineOneOne"
  | "timeline";

type QuestionOption = {
  value: string;
  label: string;
};

type Question = {
  id: QuestionId;
  text: string;
  options: QuestionOption[];
};

const QUESTIONS: Question[] = [
  {
    id: "cadPlatform",
    text: "Which CAD platform does your primary dispatch center use?",
    options: [
      { value: "motorola", label: "Motorola PremierOne" },
      { value: "tyler", label: "Tyler New World" },
      { value: "console1", label: "Console1" },
      { value: "hexagon", label: "Hexagon / Intergraph" },
      { value: "other", label: "Another platform" },
      { value: "none", label: "No CAD / evaluating CAD options" },
    ],
  },
  {
    id: "nonEmergencyVolume",
    text: "How significant is non-emergency call volume on your dispatch lines?",
    options: [
      { value: "major", label: "Major issue — impacts emergency response capacity" },
      { value: "moderate", label: "Moderate — we manage it but it's a known burden" },
      { value: "minor", label: "Minor — not a current priority" },
      { value: "unknown", label: "We haven't measured it" },
    ],
  },
  {
    id: "translationNeeds",
    text: "Does your center handle calls from non-English-speaking callers?",
    options: [
      { value: "frequent", label: "Frequently — multiple languages in our community" },
      { value: "occasional", label: "Occasionally — some language needs" },
      { value: "rare", label: "Rarely — primarily English-speaking community" },
    ],
  },
  {
    id: "supervisorVisibility",
    text: "How does your supervisor team monitor live dispatch operations?",
    options: [
      { value: "limited", label: "Limited — primarily ad hoc observation" },
      { value: "manual", label: "Manual review of logs after the fact" },
      { value: "basic_tools", label: "Basic tools — CAD supervisor view only" },
      { value: "good", label: "Good visibility with current tools" },
    ],
  },
  {
    id: "cadInterop",
    text: "Do you need to share incidents with neighboring agencies on different CAD systems?",
    options: [
      { value: "yes_critical", label: "Yes — critical for mutual aid and border incidents" },
      { value: "yes_helpful", label: "Yes — would improve coordination" },
      { value: "no", label: "No — we operate independently" },
      { value: "evaluating", label: "Currently evaluating this need" },
    ],
  },
  {
    id: "cameraInfra",
    text: "Does your center or agency have existing security camera infrastructure?",
    options: [
      { value: "extensive", label: "Extensive — SOC with many camera feeds" },
      { value: "some", label: "Some cameras — key locations" },
      { value: "minimal", label: "Minimal or none" },
    ],
  },
  {
    id: "ngNineOneOne",
    text: "Where is your center in the NG911 transition?",
    options: [
      { value: "esinet_live", label: "ESInet live — NG911 operational" },
      { value: "planning", label: "Planning phase / funding secured" },
      { value: "early", label: "Early evaluation" },
      { value: "not_started", label: "Not started" },
    ],
  },
  {
    id: "timeline",
    text: "What is your approximate timeline for evaluating new technology?",
    options: [
      { value: "immediate", label: "Immediate — ready to start in 30–60 days" },
      { value: "this_year", label: "This fiscal year" },
      { value: "next_year", label: "Next fiscal year" },
      { value: "planning", label: "Early planning — no committed timeline" },
    ],
  },
];

// ── Capability matching logic ─────────────────────────────────────────────────

type Capability = {
  title: string;
  description: string;
  link: string;
  linkLabel: string;
  relevanceScore: number;
};

function matchCapabilities(answers: Partial<Record<QuestionId, string>>): Capability[] {
  const caps: Capability[] = [];

  // Core 911 AI — always relevant for dispatch centers
  caps.push({
    title: "NexCort iQ Core — 911 / PSAP Intelligence",
    description:
      "Live call transcription, multilingual communication, Two-Way Text, supervisor visibility, and CAD-complementary incident intelligence for 911 dispatch centers and PSAPs.",
    link: "/product/core",
    linkLabel: "Core Platform Overview",
    relevanceScore: 90,
  });

  // NEXiQ — triggered by non-emergency volume
  if (answers.nonEmergencyVolume === "major" || answers.nonEmergencyVolume === "moderate") {
    caps.push({
      title: "NEXiQ — Non-Emergency Call Automation",
      description:
        "Conversational AI for police non-emergency lines and 311 services — reduces call volume handled by dispatchers without touching emergency operations.",
      link: "/nexiq",
      linkLabel: "NEXiQ Overview",
      relevanceScore: answers.nonEmergencyVolume === "major" ? 95 : 80,
    });
  }

  // Translation — triggered by language needs
  if (answers.translationNeeds === "frequent" || answers.translationNeeds === "occasional") {
    caps.push({
      title: "RC Translate — Real-Time Emergency Call Translation",
      description:
        "AI-powered live translation for emergency calls — helps dispatchers communicate with callers in multiple languages in real time.",
      link: "/ng911-software",
      linkLabel: "NG911 & Translation Capabilities",
      relevanceScore: answers.translationNeeds === "frequent" ? 90 : 70,
    });
  }

  // CAD interoperability — triggered by cadInterop
  if (
    answers.cadInterop === "yes_critical" ||
    answers.cadInterop === "yes_helpful" ||
    answers.cadInterop === "evaluating"
  ) {
    caps.push({
      title: "CAD-to-CAD Interoperability Hub",
      description:
        "Bridges different CAD platforms for mutual-aid, automatic-aid, and border incident scenarios — without replacing either agency's CAD.",
      link: "/cad-interoperability",
      linkLabel: "CAD Interoperability Details",
      relevanceScore: answers.cadInterop === "yes_critical" ? 95 : 75,
    });
  }

  // iQ Vision — triggered by camera infrastructure
  if (answers.cameraInfra === "extensive" || answers.cameraInfra === "some") {
    caps.push({
      title: "iQ Vision — AI Scene Intelligence",
      description:
        "AI monitoring for existing camera feeds — generates real-time observations and incident notifications for security operations centers.",
      link: "/iq-vision",
      linkLabel: "iQ Vision Overview",
      relevanceScore: answers.cameraInfra === "extensive" ? 85 : 65,
    });
  }

  // Supervisor visibility — triggered by limited visibility
  if (answers.supervisorVisibility === "limited" || answers.supervisorVisibility === "manual") {
    caps.push({
      title: "Supervisor Dashboard & Live Ops Visibility",
      description:
        "Real-time supervisor monitoring, dispatcher session visibility, and operations dashboards for 911 center supervisors.",
      link: "/supervisor-dashboard",
      linkLabel: "Supervisor Dashboard",
      relevanceScore: 80,
    });
  }

  // NG911 — triggered by NG911 planning
  if (answers.ngNineOneOne === "planning" || answers.ngNineOneOne === "early") {
    caps.push({
      title: "NG911 Modernization Support",
      description:
        "NexCort iQ is designed to work alongside NG911-compatible infrastructure — Two-Way Text, multimedia intake, and AI-assisted call handling align with NG911 service transition goals.",
      link: "/ng911-software",
      linkLabel: "NG911 Capabilities",
      relevanceScore: 75,
    });
  }

  // Sort by relevance score
  return caps.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ── Main component ────────────────────────────────────────────────────────────

type ViewState = "assessment" | "results" | "consult_form" | "consult_sent";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY",
  "LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND",
  "OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50";
const labelCls = "block mb-1 text-xs font-medium text-slate-400";

export function ReadinessAssessment() {
  const [view, setView] = useState<ViewState>("assessment");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<QuestionId, string>>>({});
  const [consultForm, setConsultForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    state: "",
    agencyName: "",
  });
  const [consultError, setConsultError] = useState<string | null>(null);
  const [consultSending, setConsultSending] = useState(false);

  const question = QUESTIONS[currentQ];
  const isLast = currentQ === QUESTIONS.length - 1;
  const progress = ((currentQ) / QUESTIONS.length) * 100;

  const handleAnswer = useCallback(
    (value: string) => {
      const id = QUESTIONS[currentQ].id;
      const newAnswers = { ...answers, [id]: value };
      setAnswers(newAnswers);

      if (isLast) {
        setView("results");
      } else {
        setCurrentQ((q) => q + 1);
      }
    },
    [currentQ, answers, isLast],
  );

  const capabilities = matchCapabilities(answers);

  async function submitConsult(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (consultSending) return;
    setConsultSending(true);
    setConsultError(null);

    const body = {
      firstName: consultForm.firstName.trim(),
      lastName: consultForm.lastName.trim(),
      email: consultForm.email.trim().toLowerCase(),
      state: consultForm.state,
      referrer:
        typeof window !== "undefined" ? document.referrer || null : null,
      landingPage: "/modernization-assessment",
      capturedAt: new Date().toISOString(),
      utmSource: typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("utm_source") ?? undefined
        : undefined,
    };

    try {
      const res = await fetch(marketingLeadSubmitUrl(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setView("consult_sent");
      } else {
        setConsultError("Unable to submit right now. Please try again.");
      }
    } catch {
      setConsultError("Unable to connect. Please try again.");
    } finally {
      setConsultSending(false);
    }
  }

  // ── Assessment view ────────────────────────────────────────────────────────
  if (view === "assessment") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 text-center">
          <div className="mb-2 inline-block rounded-full bg-sky-900/40 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-sky-400">
            NexCort iQ
          </div>
          <h1 className="mb-3 text-3xl font-bold text-white">
            911 Modernization Readiness Assessment
          </h1>
          <p className="text-sm text-slate-400">
            Answer {QUESTIONS.length} brief questions about your center's current situation. We'll
            match you with relevant NexCort iQ capabilities and suggest a next step.
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-sky-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <p className="mb-1 text-xs text-slate-500">
            Question {currentQ + 1} of {QUESTIONS.length}
          </p>
          <h2 className="mb-6 text-lg font-semibold text-white">{question.text}</h2>

          <div className="space-y-3">
            {question.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleAnswer(opt.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:border-sky-700/40 hover:bg-sky-900/20 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                {opt.label}
              </button>
            ))}
          </div>

          {currentQ > 0 && (
            <button
              type="button"
              onClick={() => setCurrentQ((q) => q - 1)}
              className="mt-4 text-xs text-slate-500 hover:text-slate-400"
            >
              ← Back
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Results view ───────────────────────────────────────────────────────────
  if (view === "results") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 text-center">
          <div className="mb-2 inline-block rounded-full bg-emerald-900/40 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Assessment complete
          </div>
          <h1 className="mb-3 text-2xl font-bold text-white">
            Relevant NexCort iQ Capabilities
          </h1>
          <p className="text-sm text-slate-400">
            Based on your responses, these capabilities are most relevant to your center's
            current situation. This is a discussion starting point, not a formal assessment
            or procurement recommendation.
          </p>
        </div>

        <div className="space-y-4">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5"
            >
              <h3 className="mb-1 text-sm font-semibold text-sky-300">{cap.title}</h3>
              <p className="mb-3 text-sm text-slate-400">{cap.description}</p>
              <a
                href={cap.link}
                className="text-xs text-sky-500 hover:text-sky-400 hover:underline"
              >
                {cap.linkLabel} →
              </a>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="mt-6 rounded-lg border border-amber-900/30 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-200/70">
          Completing this assessment does not indicate compliance, certification, or procurement
          readiness. These are capability suggestions based on your described situation — not a
          formal evaluation or recommendation.
        </div>

        {/* CTA */}
        <div className="mt-8 rounded-2xl border border-sky-900/30 bg-sky-950/20 p-6 text-center">
          <h3 className="mb-2 text-base font-semibold text-sky-200">
            Ready to discuss your agency's situation?
          </h3>
          <p className="mb-4 text-sm text-slate-400">
            Request an agency-specific consultation to discuss how these capabilities apply to
            your center's CAD, workflows, and modernization timeline.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setView("consult_form")}
              className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600"
            >
              Request a consultation
            </button>
            <a
              href="/free-60-day-pilot"
              className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-slate-300 hover:border-white/20"
            >
              Apply for a Free Pilot
            </a>
          </div>
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => { setAnswers({}); setCurrentQ(0); setView("assessment"); }}
            className="text-xs text-slate-500 hover:text-slate-400"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  // ── Consultation form ──────────────────────────────────────────────────────
  if (view === "consult_form") {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <h2 className="mb-6 text-xl font-bold text-white">Request an Agency Consultation</h2>
        <form onSubmit={submitConsult} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>First name *</label>
              <input
                type="text"
                className={inputCls}
                required
                value={consultForm.firstName}
                onChange={(e) => setConsultForm((p) => ({ ...p, firstName: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Last name *</label>
              <input
                type="text"
                className={inputCls}
                required
                value={consultForm.lastName}
                onChange={(e) => setConsultForm((p) => ({ ...p, lastName: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Work email *</label>
            <input
              type="email"
              className={inputCls}
              required
              placeholder="yourname@agency.gov"
              value={consultForm.email}
              onChange={(e) => setConsultForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls}>Agency / organization name</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Your agency name"
              value={consultForm.agencyName}
              onChange={(e) => setConsultForm((p) => ({ ...p, agencyName: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls}>State *</label>
            <select
              className={inputCls}
              required
              value={consultForm.state}
              onChange={(e) => setConsultForm((p) => ({ ...p, state: e.target.value }))}
            >
              <option value="">Select state…</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {consultError && (
            <p className="rounded-lg border border-red-800/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              {consultError}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={consultSending}
              className="flex-1 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
            >
              {consultSending ? "Sending…" : "Request consultation"}
            </button>
            <button
              type="button"
              onClick={() => setView("results")}
              className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-400 hover:border-white/20"
            >
              Back
            </button>
          </div>

          <p className="text-xs text-slate-600">
            By submitting this form you agree that NexCort iQ may contact you about this
            assessment and related products.
          </p>
        </form>
      </div>
    );
  }

  // ── Sent ──────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div
        className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-6 py-10"
        role="status"
      >
        <p className="mb-2 text-xl font-semibold text-emerald-100">
          Consultation request received.
        </p>
        <p className="text-sm text-emerald-200/80">
          A member of our team will be in touch within one business day to discuss your
          agency's situation and the capabilities we identified.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="/product/core"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:border-white/20"
          >
            Explore the Platform
          </a>
          <a
            href="/free-60-day-pilot"
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
          >
            Apply for a Free Pilot
          </a>
        </div>
      </div>
    </div>
  );
}
