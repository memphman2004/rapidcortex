"use client";

import { useState } from "react";
import type { RoiVertical } from "rapid-cortex-shared";
import { verticalLabelForSales } from "rapid-cortex-shared";

const QUESTIONS: Record<RoiVertical, string[]> = {
  rc911: [
    "What CAD vendor and version are you on today?",
    "Where do language calls create the most friction?",
    "How is QA currently staffed and scored?",
    "What would make a pilot low-risk for your IT team?",
  ],
  campus: [
    "How do tip reports reach security today?",
    "Clery documentation — what is manual vs automated?",
    "How many physical zones need coverage?",
    "Who owns student safety vs facilities?",
  ],
  venue: [
    "Peak event volume and guest assistance channels?",
    "How are section/gate incidents coordinated?",
    "What is in vs out of scope vs 911?",
    "Who approves guest-facing QR placement?",
  ],
  hospital: [
    "How is ER diversion communicated to EMS?",
    "Who updates live capacity today?",
    "MCI coordination gaps?",
    "HL7 / bed-board integrations in place?",
  ],
  transit: [
    "Passenger report channels today?",
    "Route vs station coverage priorities?",
    "Security vs ops ownership?",
    "Peak corridor pain points?",
  ],
};

export function PreCallPlanner() {
  const [vertical, setVertical] = useState<RoiVertical>("rc911");
  const [agency, setAgency] = useState("");
  const [pains, setPains] = useState<string[]>([]);
  const [guide, setGuide] = useState<string | null>(null);

  const painOptions = [
    "Language / translation cost",
    "Dispatcher overload",
    "No tip console",
    "QA backlog",
    "CAD friction",
    "Clery / compliance documentation",
  ];

  function togglePain(p: string) {
    setPains((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function generate() {
    const qs = QUESTIONS[vertical];
    const text = [
      `Pre-call guide — ${agency || "Agency"} (${verticalLabelForSales(vertical)})`,
      "",
      "Pain points to confirm:",
      ...(pains.length ? pains.map((p) => `• ${p}`) : ["• (none selected)"]),
      "",
      "Discovery questions:",
      ...qs.map((q, i) => `${i + 1}. ${q}`),
      "",
      "Close:",
      "• Offer free tier if eligible (Community Connect / Wellness / Intelligence Scan).",
      "• Book demo of full console after they hit the free-tier ceiling.",
    ].join("\n");
    setGuide(text);
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
        </label>
        <label className="text-xs text-slate-400">
          Vertical
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
            value={vertical}
            onChange={(e) => setVertical(e.target.value as RoiVertical)}
          >
            {(Object.keys(QUESTIONS) as RoiVertical[]).map((v) => (
              <option key={v} value={v}>
                {verticalLabelForSales(v)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {painOptions.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => togglePain(p)}
            className={[
              "rounded-full border px-3 py-1.5 text-[11px]",
              pains.includes(p)
                ? "border-sky-500 bg-sky-500/10 text-sky-300"
                : "border-white/10 text-slate-500",
            ].join(" ")}
          >
            {p}
          </button>
        ))}
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
