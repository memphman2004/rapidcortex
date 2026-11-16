"use client";

import { useState } from "react";

const VENDORS = [
  "CentralSquare",
  "Motorola Solutions",
  "Tyler Technologies",
  "Axon",
  "Hexagon",
  "Harris Computer / Constellation",
  "Versaterm",
  "Mark43",
  "Oracle",
  "Plus more via open integration",
] as const;

const STEPS = [
  {
    name: "Read-only bridge",
    description:
      "NexCort iQ reads from connected CAD systems — no write access and no operational risk. The safe first step for any pilot.",
  },
  {
    name: "Assisted transfer",
    description:
      "One-click incident transfer across connected agencies. Dispatchers review and confirm before data is committed.",
  },
  {
    name: "Bidirectional sync",
    description:
      "Two-way sync across the bridge. Status updates, unit assignments, and dispositions flow when your agency is ready.",
  },
] as const;

export function WorksWithSystems() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = STEPS[activeIndex] ?? STEPS[0];

  return (
    <section
      className="bg-[#060910] px-4 py-20 sm:px-6 md:py-24"
      aria-labelledby="works-with-heading"
    >
      <div className="mx-auto max-w-7xl">
        <h2
          id="works-with-heading"
          className="text-balance text-center text-3xl font-semibold tracking-tight text-white md:text-4xl lg:text-[2.75rem]"
        >
          Works with the CAD systems your agency already uses.
        </h2>

        <ul className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
          {VENDORS.map((name) => (
            <li
              key={name}
              className="rounded-lg border border-[#1A2940] bg-[#0B1220] px-3.5 py-2 text-sm font-medium text-[#E8EEF8]"
            >
              {name}
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-8 max-w-3xl text-center text-base leading-relaxed text-[#6A7B9D] md:text-lg">
          NexCort iQ is a decision-support layer — not a replacement for your CAD, telephony, or
          records systems.
        </p>

        <div className="mx-auto mt-12 max-w-3xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#3A4F72]">
            Integration path
          </p>
          <div className="flex flex-col gap-1.5" role="tablist" aria-label="CAD integration steps">
            {STEPS.map((step, i) => {
              const isActive = i === activeIndex;
              return (
                <button
                  key={step.name}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveIndex(i)}
                  className="flex min-h-11 w-full items-start gap-3 rounded-xl p-3.5 text-left transition-colors duration-150"
                  style={{
                    background: isActive ? "rgba(20, 105, 255, 0.10)" : "transparent",
                    border: isActive ? "1px solid rgba(30, 57, 100, 0.9)" : "1px solid transparent",
                  }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-medium"
                    style={{
                      background: isActive ? "#1469FF" : "#0B1220",
                      border: `1px solid ${isActive ? "#1469FF" : "#1A2940"}`,
                      color: isActive ? "#fff" : "#6A7B9D",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[#E8EEF8]">{step.name}</span>
                    {isActive ? (
                      <span className="mt-1 block text-sm leading-relaxed text-[#6A7B9D]">
                        {active.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
