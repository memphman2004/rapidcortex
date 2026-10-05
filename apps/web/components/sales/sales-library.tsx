"use client";

import Link from "next/link";
import { FeatureArchitectureMaps } from "@/components/help/feature-architecture-maps";
import { SalesFeatureCatalogPanel } from "@/components/sales/sales-feature-catalog-panel";

const FREE_TIER = [
  {
    title: "Permanent free tier framing",
    body: "Do not call it a free trial. Community Connect, complimentary intelligence reports, and Wellness are permanent or selective free offerings that create awareness of capability gaps — then upsell the paid console.",
  },
  {
    title: "Community Tip Line (Campus + Venue)",
    body: "One QR, one zone, email forwarding only. No dispatcher console, analytics, two-way chat, AI, or Clery. Upsell: tip console, two-way chat, Clery, analytics, multi-zone QR/NFC.",
  },
  {
    title: "Agency Intelligence Scan (all verticals)",
    body: "One-time anonymized CAD export (30–60 days) → 3–5 page PDF (volume by hour, call mix, language %, peaks). Limited availability. Follow with a peak-window demo of full iQ.",
  },
  {
    title: "Dispatcher Wellness (911)",
    body: "Anonymous 60-second end-of-shift check-in. Supervisors see aggregates only — no call data or CJIS exposure. Free for accredited PSAPs. Builds goodwill without a full platform purchase.",
  },
  {
    title: "Never free",
    body: "Live transcription, AI triage/confidence scoring, CAD write-back, CAD-to-CAD mesh, and NexIQ Vision™ stay paid-only. Never mark them complimentary on a pilot or order.",
  },
  {
    title: "Conversion path",
    body: "Register free → 30–60 days real use → hit ceiling → upgrade demo → structured pilot → reference account. Lead with outcome, not SKU name.",
  },
];

const PLATFORM_TERMS = [
  {
    term: "Human in the loop",
    def: "AI suggests; humans decide. Never tell a buyer NC iQ autonomously dispatches, diagnoses, or writes to CAD without review.",
  },
  {
    term: "Fail-closed",
    def: "CAD write-back and Call Assist emergency handoff stay safe by default. Write-back needs a signed addendum; TRANSFER_911 cannot be suppressed.",
  },
  {
    term: "NC Translate",
    def: "Bidirectional live voice translation (100+ languages). No interpreter hold. Also available as field/ops Translate outside the ECC.",
  },
  {
    term: "NexiQ Vision™",
    def: "AI scene intelligence from live cameras (agency + citizen share). Observations to authorized roles. Human-in-the-loop — never free.",
  },
  {
    term: "Call Assist",
    def: "Separate non-emergency product. Users land on /app/call-assist/* — never the 911 dispatcher console. Emergency mid-call uses hardcoded TRANSFER_911.",
  },
  {
    term: "CAD Assist vs write-back",
    def: "Read enrichment is the safe first step. Write-back is optional, dispatcher-reviewed, fail-closed, and never in pilot base pricing without discovery.",
  },
];

const DISCOVERY: { vertical: string; questions: string[] }[] = [
  {
    vertical: "NC 911",
    questions: [
      "How many dispatcher seats per shift / total?",
      "What CAD system (Tyler, CentralSquare, Hexagon, Spillman, other)?",
      "Monthly / annual call volume?",
      "Live transcription or call recording today?",
      "Top non-English languages in the service area?",
      "QA process today — manual, scored, or ad hoc?",
      "How do you handle callers who cannot or will not speak?",
      "NG911 upgrade status?",
      "Biggest operational challenge in the ECC right now?",
      "Budget cycle and grant funding for tech upgrades?",
    ],
  },
  {
    vertical: "NC Campus",
    questions: [
      "How do students/staff report safety concerns today?",
      "Higher-ed Clery tracking vs K-12 daily incident / school safety logging?",
      "QR vs app adoption reality on campus?",
      "Most common incident types?",
      "Existing campus safety app and adoption rate?",
      "How does campus security hand off to local LE?",
    ],
  },
  {
    vertical: "NC Venue",
    questions: [
      "How do fans report issues today?",
      "Seat / section / gate labeling?",
      "Security vs guest-services split?",
      "Peak event capacity?",
      "Camera / VMS vendor?",
      "Union or contracted security?",
    ],
  },
  {
    vertical: "NC Transit",
    questions: [
      "Fleet size by mode?",
      "On-vehicle vs station reporting need?",
      "CAD / AVL vendor?",
      "After-hours security model?",
      "Rider language mix?",
    ],
  },
  {
    vertical: "NC Hospital",
    questions: [
      "Diversion frequency?",
      "EMS pre-alert process today?",
      "Bed / ED capacity visibility?",
      "MCI drills with local PSAP?",
      "Internal staff safety reporting?",
    ],
  },
];

const COMPLIANCE = [
  {
    situation: "CJIS",
    say: "Designed with CJIS alignment — RBAC, audit logging, MFA, encryption at rest and in transit.",
    dont: "We are CJIS certified.",
  },
  {
    situation: "SOC 2",
    say: "SOC 2 Type II documentation corpus substantially complete; formal certification in progress.",
    dont: "We are SOC 2 certified.",
  },
  {
    situation: "AI decisions",
    say: "Every AI recommendation is shown for human review. AI does not take action autonomously.",
    dont: "AI handles it automatically.",
  },
  {
    situation: "CAD write-back",
    say: "Fail-closed by default. Only after signed addendum and explicit configuration.",
    dont: "Lead with write-back as a casual pilot include.",
  },
  {
    situation: "Pricing (public)",
    say: "Tailored deployment · Custom quote · Contact sales.",
    dont: "Email Section 5 rate tables without Sales Director approval.",
  },
];

export function SalesLibrary() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Feature catalog — in-depth
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Full offerable-feature definitions for sales conversations. Mirrors the Sales Guide
              Section 10 catalog.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href="/sales/pricing-catalog"
              className="rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-sky-300 hover:border-sky-500"
            >
              Open Pricing Catalog
            </Link>
            <Link
              href="/sales/document-library"
              className="rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-300 hover:border-slate-500"
            >
              Document Library
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 md:p-5">
          <SalesFeatureCatalogPanel embedded />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Platform terms to know
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {PLATFORM_TERMS.map((t) => (
            <article key={t.term} className="rounded-xl border border-white/5 bg-[#0a1628] p-4">
              <h3 className="text-sm font-semibold text-white">{t.term}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{t.def}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Free-tier talking points
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {FREE_TIER.map((s) => (
            <article key={s.title} className="rounded-xl border border-white/5 bg-[#0a1628] p-4">
              <h3 className="text-sm font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Discovery questions by vertical
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {DISCOVERY.map((block) => (
            <article key={block.vertical} className="rounded-xl border border-white/5 bg-[#0a1628] p-4">
              <h3 className="text-sm font-semibold text-white">{block.vertical}</h3>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-400">
                {block.questions.map((q) => (
                  <li key={q}>• {q}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Compliance language (say / don&apos;t say)
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Situation</th>
                <th className="px-3 py-2 font-semibold">Say this</th>
                <th className="px-3 py-2 font-semibold">Do not say</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {COMPLIANCE.map((row) => (
                <tr key={row.situation} className="bg-[#0a1628]/hover:bg-slate-900/40">
                  <td className="px-3 py-2.5 font-semibold text-slate-200">{row.situation}</td>
                  <td className="px-3 py-2.5 text-slate-400">{row.say}</td>
                  <td className="px-3 py-2.5 text-rose-300/80">{row.dont}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Feature architecture maps
        </h2>
        <p className="max-w-3xl text-sm text-slate-400">
          Interactive product path diagrams for demos and technical discovery. Same maps as Admin /
          IT Document Library.
        </p>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 md:p-5">
          <FeatureArchitectureMaps />
        </div>
      </section>
    </div>
  );
}
