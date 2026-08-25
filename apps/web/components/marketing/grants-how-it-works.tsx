"use client";

import { useState } from "react";

const STEPS = [
  {
    title: "Agency profile",
    desc: "Enter your agency name, type, location, and population served. This becomes the factual backbone of your application — no guessing, no generic filler.",
    previewLabel: "Step 1 of 4 — Agency profile",
    fields: [
      { label: "Agency name", value: "Cortex County Sheriff's Office", highlight: true },
      { label: "Agency type", value: "County Sheriff's Office" },
      { label: "Location", value: "Rapid, Delaware" },
      { label: "Population served", value: "34,854" },
    ],
  },
  {
    title: "Grant opportunity",
    desc: "Select the grant program, enter the solicitation number and amount requested. The system knows the specific requirements and evaluation criteria for each program.",
    previewLabel: "Step 2 of 4 — Grant opportunity",
    fields: [
      { label: "Program", value: "COPS Technology Program", highlight: true },
      { label: "Solicitation", value: "O-COPS-2026-171368" },
      { label: "Amount requested", value: "$185,000" },
    ],
  },
  {
    title: "Project details",
    desc: "Describe your need — staffing shortages, aging technology, call volume. Select the Rapid Cortex capabilities you're requesting funding for. Take two minutes.",
    previewLabel: "Step 3 of 4 — Project details",
    fields: [
      {
        label: "Need",
        value: "38% dispatcher vacancy; 2008-era CAD without real-time intelligence",
        highlight: true,
      },
    ],
    chips: ["AI Transcription", "QA Automation", "Supervisor Dashboard", "CAD Integration"],
  },
  {
    title: "Review & download",
    desc: "Automaticallygenerates a complete, agency-specific grant package in under 3 minutes. Review, edit inline, and download a formatted Word document ready for submission.",
    previewLabel: "Step 4 of 4 — Review & download",
    fields: [
      { label: "Output", value: "Formatted Word document (.docx)", highlight: true },
      { label: "Generation time", value: "Under 3 minutes" },
    ],
  },
] as const;

export function GrantsHowItWorks() {
  const [active, setActive] = useState(0);
  const step = STEPS[active] ?? STEPS[0]!;

  return (
    <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
      <ol className="divide-y divide-slate-800">
        {STEPS.map((item, i) => {
          const isActive = i === active;
          return (
            <li key={item.title}>
              <button
                type="button"
                onClick={() => setActive(i)}
                className="flex w-full gap-4 py-6 text-left first:pt-0"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg border font-mono text-sm font-semibold ${
                    isActive
                      ? "border-sky-500/50 bg-sky-950/40 text-sky-200"
                      : "border-slate-800 bg-slate-900/50 text-slate-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-semibold ${isActive ? "text-white" : "text-slate-300"}`}
                  >
                    {item.title}
                  </span>
                  <span
                    className={`mt-1 block text-sm leading-relaxed ${isActive ? "text-slate-300" : "text-slate-500"}`}
                  >
                    {item.desc}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="h-fit rounded-lg border border-slate-800 bg-slate-900/40 p-6 lg:sticky lg:top-28">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{step.previewLabel}</p>
        <dl className="mt-5 space-y-4">
          {step.fields.map((field) => (
            <div key={field.label}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{field.label}</dt>
              <dd
                className={`mt-1.5 rounded-lg border px-3.5 py-2.5 text-sm ${
                  "highlight" in field && field.highlight
                    ? "border-sky-500/35 bg-sky-950/30 text-sky-100"
                    : "border-slate-800 bg-slate-950/50 text-slate-300"
                }`}
              >
                {field.value}
              </dd>
            </div>
          ))}
          {"chips" in step && step.chips ? (
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                RC modules requested
              </dt>
              <dd className="mt-2 flex flex-wrap gap-1.5">
                {step.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-200"
                  >
                    {chip}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
