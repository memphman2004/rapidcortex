"use client";

import { useMemo, useState } from "react";
import type { RoiVertical } from "rapid-cortex-shared";
import { verticalLabelForSales } from "rapid-cortex-shared";
import { SafetySourceLookupLink } from "@/components/psap/safety-source-lookup-link";

type PainId =
  | "language"
  | "overload"
  | "tip"
  | "qa"
  | "cad"
  | "clery";

type PainDef = {
  id: PainId;
  label: string;
  /** Which verticals this pain is most relevant for */
  verticals: RoiVertical[] | "all";
  /** What the salesperson is actually selling into this pain */
  offer: string;
  /** Free / low-friction entry (if any) — never call it a “trial” */
  freeEntry?: string;
  /** Paid upsell after the wedge */
  upsell: string;
  discovery: string[];
  close: string[];
};

const PAINS: PainDef[] = [
  {
    id: "language",
    label: "Language / translation cost",
    verticals: "all",
    offer: "NC Translate — bidirectional live voice translation (100+ languages), no interpreter hold.",
    freeEntry:
      "Agency Intelligence Scan (limited): CAD export → language % / peak windows so they see the cost gap in their own data.",
    upsell:
      "Paid NC Translate on the console (and field/ops Translate outside the ECC). Never mark live translation complimentary.",
    discovery: [
      "Top non-English languages in the service area — and monthly interpreter / language-line spend?",
      "Where do language calls create the most friction (queue, transfer, field units)?",
      "Average hold time waiting on an interpreter today?",
      "Any bilingual staff coverage by shift — gaps on nights/weekends?",
    ],
    close: [
      "Lead with dollars: language-line cost vs NC Translate seat economics.",
      "If eligible, offer a one-time Agency Intelligence Scan so language % shows up in their own CAD mix.",
      "Book a peak-window demo of live Translate — human-in-the-loop, not ‘AI replaces interpreters.’",
    ],
  },
  {
    id: "overload",
    label: "Dispatcher overload",
    verticals: ["rc911", "transit", "hospital"],
    offer:
      "Live transcription + AI triage / confidence scoring so dispatchers spend less time typing and catching up mid-call.",
    freeEntry:
      "Dispatcher Wellness (911 / accredited PSAPs): anonymous 60-second end-of-shift check-in — goodwill, no CJIS exposure.",
    upsell:
      "Paid console: live transcription, AI assist, supervisor monitoring. Transcription / AI triage stay paid-only — never free.",
    discovery: [
      "How many dispatcher seats per shift / total? Vacancy or OT pressure?",
      "Live transcription or call recording today — who reads it after the call?",
      "What burns the most time mid-call (typing, language, CAD lookups, transfers)?",
      "How do supervisors see overload in real time today?",
    ],
    close: [
      "If PSAP-eligible, open with Dispatcher Wellness (free) to build trust without a platform buy.",
      "Frame the paid wedge as time-back on the console: transcription + AI suggestions, humans still decide.",
      "Book a live call / peak-window demo — do not lead with CAD write-back.",
    ],
  },
  {
    id: "tip",
    label: "No tip console",
    verticals: ["campus", "venue", "transit", "hospital"],
    offer:
      "Tip / guest-assist console — QR/NFC intake, two-way chat, zone routing, analytics (Campus / Venue / Transit).",
    freeEntry:
      "Community Tip Line (Campus + Venue): one QR, one zone, email forwarding only — permanent free wedge, not a trial.",
    upsell:
      "Full tip console, multi-zone QR/NFC, two-way chat, analytics, Clery where applicable. Community Tip Line has no dispatcher console / AI / Clery.",
    discovery: [
      "How do students / fans / riders report issues today (app, phone, walk-up, paper)?",
      "How many physical zones need coverage (gates, halls, stations, parking)?",
      "Who owns response — security vs guest services vs facilities?",
      "What is in vs out of scope vs 911 / local LE handoff?",
    ],
    close: [
      "Offer Community Tip Line (one QR / one zone / email) if Campus or Venue — permanent free, not a trial.",
      "Show the ceiling clearly: no console, analytics, two-way chat, or Clery on free — that is the upgrade story.",
      "Book a demo of the full tip console after they feel the gap on real volume.",
    ],
  },
  {
    id: "qa",
    label: "QA backlog",
    verticals: ["rc911"],
    offer:
      "QA / review workflows tied to live transcription and call scoring — less scrubbing through raw audio alone.",
    freeEntry:
      "Agency Intelligence Scan: volume-by-hour and call-mix PDF from a short CAD export — proves peak load before a QA pilot.",
    upsell:
      "Paid QA + transcription stack. Live transcription and AI scoring stay paid-only.",
    discovery: [
      "How is QA currently staffed and scored — % of calls reviewed?",
      "Biggest backlog driver (volume, language, policy changes, new hires)?",
      "What tools do QA reviewers use today (player, spreadsheet, CAD notes)?",
      "Supervisor scorecard needs — coaching vs compliance?",
    ],
    close: [
      "Offer Intelligence Scan if they lack a clean peak/call-mix picture for staffing QA.",
      "Demo transcription + review queue on a recent call sample — AI suggests, humans score.",
      "Pilot framing: reduce backlog hours, not ‘replace QA staff.’",
    ],
  },
  {
    id: "cad",
    label: "CAD friction",
    verticals: ["rc911", "transit", "hospital"],
    offer:
      "CAD Assist (read enrichment first) — context on the call without forcing write-back on day one.",
    freeEntry:
      "Agency Intelligence Scan from a CAD export — shows mix/peaks so IT sees value before integration talks.",
    upsell:
      "Deeper CAD Assist → optional CAD write-back only after signed addendum (fail-closed). Never lead a pilot with write-back as a casual include.",
    discovery: [
      "What CAD vendor and version are you on today?",
      "What is the most painful CAD step mid-call (duplicate entry, unit status, premise hazards)?",
      "Any prior CAD integrations — what broke trust with IT?",
      "Would read-only enrichment be acceptable before any write path?",
    ],
    close: [
      "Lead with CAD Assist / read enrichment — safer first step than write-back.",
      "Say write-back is optional, dispatcher-reviewed, fail-closed, and needs a signed addendum.",
      "Offer Intelligence Scan if they want proof from their own CAD before IT commits.",
    ],
  },
  {
    id: "clery",
    label: "Clery / compliance documentation",
    verticals: ["campus"],
    offer:
      "Campus tip console + structured incident logging that supports Clery documentation (human-owned; not ‘auto-compliant’).",
    freeEntry:
      "Community Tip Line gets reporting in the door (email only). Clery tooling is on the paid campus console — not on free.",
    upsell:
      "Multi-zone tip console, Clery-oriented logging, analytics, LE handoff workflow. Do not claim automatic Clery certification.",
    discovery: [
      "Higher-ed Clery tracking vs K-12 daily incident / school safety logging — which applies?",
      "What is manual vs automated in Clery / compliance documentation today?",
      "Who owns Clery reporting — campus safety, Title IX, police, counsel?",
      "How do tip reports become countable incidents today?",
    ],
    close: [
      "Start with Community Tip Line if they have zero digital intake — then show the Clery documentation gap on free.",
      "Upsell the campus console for structured logging + multi-zone tips — humans still own compliance decisions.",
      "Never promise ‘we make you Clery compliant automatically.’",
    ],
  },
];

const BASE_QUESTIONS: Record<RoiVertical, string[]> = {
  rc911: [
    "How many dispatcher seats per shift / total?",
    "What CAD vendor and version are you on today?",
    "Approximate monthly / annual call volume?",
    "NG911 upgrade status?",
    "What would make a pilot low-risk for your IT team?",
    "Budget cycle and grant funding for tech upgrades?",
  ],
  campus: [
    "Higher-ed Clery tracking vs K-12 daily incident / school safety logging?",
    "How many physical zones need coverage?",
    "QR vs app adoption reality on campus?",
    "Who owns student safety vs facilities?",
    "How does campus security hand off to local LE?",
  ],
  venue: [
    "How do fans report issues today?",
    "Seat / section / gate labeling?",
    "Peak event volume and guest assistance channels?",
    "Security vs guest-services split?",
    "Camera / VMS vendor? Who approves guest-facing QR placement?",
  ],
  hospital: [
    "Diversion frequency and how is it communicated to EMS?",
    "Who updates live capacity / bed board today?",
    "EMS pre-alert process today?",
    "MCI coordination gaps with the local PSAP?",
    "Internal staff safety reporting?",
  ],
  transit: [
    "Fleet size by mode?",
    "Passenger report channels today — on-vehicle vs station?",
    "Route vs station coverage priorities?",
    "CAD / AVL vendor?",
    "Security vs ops ownership? After-hours model?",
  ],
};

function painsForVertical(vertical: RoiVertical): PainDef[] {
  return PAINS.filter((p) => p.verticals === "all" || p.verticals.includes(vertical));
}

function uniquePreserve(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function PreCallPlanner() {
  const [vertical, setVertical] = useState<RoiVertical>("rc911");
  const [agency, setAgency] = useState("");
  const [selected, setSelected] = useState<PainId[]>([]);
  const [guide, setGuide] = useState<string | null>(null);

  const painOptions = useMemo(() => painsForVertical(vertical), [vertical]);

  function togglePain(id: PainId) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function onVerticalChange(next: RoiVertical) {
    setVertical(next);
    const allowed = new Set(painsForVertical(next).map((p) => p.id));
    setSelected((prev) => prev.filter((id) => allowed.has(id)));
    setGuide(null);
  }

  function generate() {
    const chosen = PAINS.filter((p) => selected.includes(p.id));
    const painDiscovery = chosen.flatMap((p) => p.discovery);
    const qs = uniquePreserve([...painDiscovery, ...BASE_QUESTIONS[vertical]]).slice(0, 12);

    const lines: string[] = [
      `Pre-call guide — ${agency || "Agency"} (${verticalLabelForSales(vertical)})`,
      "",
      "Pain points to confirm:",
      ...(chosen.length ? chosen.map((p) => `• ${p.label}`) : ["• (none selected — pick pains above for a tailored close)"]),
    ];

    if (chosen.length) {
      lines.push("", "What we are offering (by pain):");
      for (const p of chosen) {
        lines.push(`• ${p.label}`);
        lines.push(`  Offer: ${p.offer}`);
        if (p.freeEntry) lines.push(`  Free entry: ${p.freeEntry}`);
        lines.push(`  Upsell: ${p.upsell}`);
      }
    }

    lines.push("", "Discovery questions:", ...qs.map((q, i) => `${i + 1}. ${q}`));

    lines.push("", "Close:");
    if (chosen.length) {
      for (const p of chosen) {
        lines.push(`• [${p.label}]`);
        for (const c of p.close) lines.push(`  – ${c}`);
      }
    } else {
      lines.push(
        "• Pick at least one pain point so the close matches the offer (Translate, tip console, CAD Assist, QA, Wellness, etc.).",
        "• Do not default to a generic free-tier pitch — map free entry (Community Tip Line / Wellness / Intelligence Scan) to the pain.",
      );
    }

    setGuide(lines.join("\n"));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-400">
          Agency
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
          />
          {vertical === "rc911" && (
            <span className="mt-1.5 block">
              <SafetySourceLookupLink hint="Look up missing PSAP contacts in the national directory." />
            </span>
          )}
        </label>
        <label className="text-xs text-slate-400">
          Vertical
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
            value={vertical}
            onChange={(e) => onVerticalChange(e.target.value as RoiVertical)}
          >
            {(Object.keys(BASE_QUESTIONS) as RoiVertical[]).map((v) => (
              <option key={v} value={v}>
                {verticalLabelForSales(v)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
          Pain points — each drives a different offer &amp; close
        </p>
        <div className="flex flex-wrap gap-2">
          {painOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePain(p.id)}
              className={[
                "rounded-full border px-3 py-1.5 text-[11px]",
                selected.includes(p.id)
                  ? "border-sky-500 bg-sky-500/10 text-sky-300"
                  : "border-white/10 text-slate-500",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={generate}
        className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300"
      >
        Generate call guide
      </button>
      {guide && (
        <pre className="whitespace-pre-wrap rounded-xl border border-white/5 bg-[#0a1628] p-4 text-xs text-slate-300">
          {guide}
        </pre>
      )}
    </div>
  );
}
