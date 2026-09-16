"use client";

import { useEffect, useRef, useState } from "react";

interface Phase {
  name: string;
  description: string;
  badge: string;
  status: string;
  color: string;
  bidirectional: boolean;
  requiresApi: boolean;
}

const PHASES: Phase[] = [
  {
    name: "Read-only bridge",
    description:
      "RC reads both CAD systems. No write access, no operational risk. The safe first step for any pilot.",
    badge: "Read-only bridge",
    status: "ACTIVE — READ-ONLY",
    color: "#00C87A",
    bidirectional: false,
    requiresApi: false,
  },
  {
    name: "Assisted transfer",
    description:
      "One-click incident transfer between agencies. Dispatcher reviews and confirms before data is committed.",
    badge: "Assisted transfer",
    status: "ACTIVE — ASSISTED",
    color: "#1469FF",
    bidirectional: true,
    requiresApi: false,
  },
  {
    name: "Bidirectional sync",
    description:
      "Fully automated two-way sync. Status updates, unit assignments, and dispositions flow in real time.",
    badge: "Bidirectional sync",
    status: "ACTIVE — BIDIRECTIONAL",
    color: "#00D4FF",
    bidirectional: true,
    requiresApi: true,
  },
];

const CAD_VENDORS = [
  "CentralSquare Technologies",
  "Motorola Solutions",
  "Tyler Technologies",
  "Axon",
  "Hexagon",
  "Harris Computer / Constellation Software",
  "Versaterm",
  "Mark43",
  "Oracle",
  "Plus More…",
];

function CadFlowDiagram({ phase }: { phase: Phase }) {
  const rafRef = useRef<number>(0);
  const dotARef = useRef<SVGCircleElement>(null);
  const dotBRef = useRef<SVGCircleElement>(null);
  const tRef = useRef(0);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return undefined;

    function tick() {
      tRef.current = (tRef.current + 1.8) % 100;
      const pct = tRef.current / 100;
      if (dotARef.current) dotARef.current.setAttribute("cx", String(92 + pct * 22));
      if (dotBRef.current) dotBRef.current.setAttribute("cx", String(226 + pct * 20));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const c = phase.color;
  const cA = `${c}1A`;
  const cB = `${c}40`;

  return (
    <div className="rounded-xl border border-[#1A2940] bg-[#0B1220] p-4">
      <svg
        viewBox="0 0 340 130"
        className="w-full"
        role="img"
        aria-label="CAD-to-CAD intelligence bridge — animated data flow diagram"
      >
        <title>CAD-to-CAD intelligence bridge</title>
        <desc>
          Diagram showing incident data flowing from Agency A&apos;s CAD system through the Rapid
          Cortex intelligence bridge to Agency B&apos;s CAD system.
        </desc>

        <rect x="4" y="20" width="88" height="72" rx="6" fill="#060910" stroke="#1A2940" strokeWidth="1" />
        <rect x="12" y="32" width="72" height="4" rx="2" fill="#1A2940" />
        <rect x="12" y="40" width="52" height="4" rx="2" fill="#1A2940" />
        <rect x="12" y="48" width="62" height="4" rx="2" fill="#1A2940" />
        <rect
          x="12"
          y="58"
          width="72"
          height="18"
          rx="3"
          fill="rgba(20,105,255,.1)"
          stroke="rgba(20,105,255,.25)"
          strokeWidth="1"
        />
        <text x="48" y="70.5" textAnchor="middle" fill="#6A7B9D" fontSize="7" fontFamily="monospace">
          CAD LIVE
        </text>
        <text x="48" y="104" textAnchor="middle" fill="#E8EEF8" fontSize="8" fontWeight="500">
          Agency A
        </text>
        <text x="48" y="114" textAnchor="middle" fill="#6A7B9D" fontSize="7">
          PremierOne
        </text>

        <rect x="248" y="20" width="88" height="72" rx="6" fill="#060910" stroke="#1A2940" strokeWidth="1" />
        <rect x="256" y="32" width="72" height="4" rx="2" fill="#1A2940" />
        <rect x="256" y="40" width="52" height="4" rx="2" fill="#1A2940" />
        <rect x="256" y="48" width="62" height="4" rx="2" fill="#1A2940" />
        <rect
          x="256"
          y="58"
          width="72"
          height="18"
          rx="3"
          fill="rgba(20,105,255,.1)"
          stroke="rgba(20,105,255,.25)"
          strokeWidth="1"
        />
        <text x="292" y="70.5" textAnchor="middle" fill="#6A7B9D" fontSize="7" fontFamily="monospace">
          CAD LIVE
        </text>
        <text x="292" y="104" textAnchor="middle" fill="#E8EEF8" fontSize="8" fontWeight="500">
          Agency B
        </text>
        <text x="292" y="114" textAnchor="middle" fill="#6A7B9D" fontSize="7">
          New World
        </text>

        <rect x="116" y="28" width="108" height="56" rx="6" fill="#060910" stroke={c} strokeWidth="1.5" />
        <text x="170" y="51" textAnchor="middle" fill={c} fontSize="10" fontWeight="700">
          RAPID CORTEX
        </text>
        <text x="170" y="63" textAnchor="middle" fill="#6A7B9D" fontSize="7">
          Intelligence Bridge
        </text>
        <text x="170" y="76" textAnchor="middle" fill={c} fontSize="7" fontFamily="monospace">
          {phase.status}
        </text>

        <line x1="92" y1="57" x2="114" y2="57" stroke={c} strokeWidth="1.5" />
        <polygon points="110,54 116,57 110,60" fill={c} />
        <line x1="226" y1="57" x2="246" y2="57" stroke={c} strokeWidth="1.5" />
        <polygon points="242,54 248,57 242,60" fill={c} />

        {phase.bidirectional ? (
          <>
            <line
              x1="114"
              y1="65"
              x2="92"
              y2="65"
              stroke={c}
              strokeWidth="1"
              strokeDasharray="3,2"
              opacity="0.45"
            />
            <polygon points="96,62 90,65 96,68" fill={c} opacity="0.45" />
            <line
              x1="246"
              y1="65"
              x2="226"
              y2="65"
              stroke={c}
              strokeWidth="1"
              strokeDasharray="3,2"
              opacity="0.45"
            />
            <polygon points="230,62 224,65 230,68" fill={c} opacity="0.45" />
          </>
        ) : null}

        <circle ref={dotARef} cx="92" cy="57" r="3" fill={c} />
        <circle ref={dotBRef} cx="226" cy="57" r="3" fill={c} />

        <rect x="116" y="96" width="108" height="18" rx="9" fill={cA} stroke={cB} strokeWidth="1" />
        <text x="170" y="108.5" textAnchor="middle" fill={c} fontSize="8" fontWeight="500">
          {phase.badge}
        </text>
      </svg>
    </div>
  );
}

export function FeatureCadInterop() {
  const [activeIndex, setActiveIndex] = useState(0);
  const phase = PHASES[activeIndex] ?? PHASES[0];

  return (
    <section
      id="cad-interop"
      className="scroll-mt-28 bg-[#060910] px-6 py-20 md:py-28"
      aria-labelledby="cad-interop-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: "rgba(232, 25, 44, 0.1)",
              border: "1px solid rgba(232, 25, 44, 0.3)",
              color: "#E8192C",
            }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#E8192C]" aria-hidden="true" />
            CAD-to-CAD interoperability
          </span>
        </div>

        <div className="mb-12 max-w-2xl">
          <h2
            id="cad-interop-heading"
            className="rc-title-gradient mb-4 text-3xl font-semibold leading-tight md:text-4xl lg:text-5xl"
          >
            Incident data crosses jurisdictions when mutual aid activates
          </h2>
          <p className="text-base leading-relaxed text-[#6A7B9D] md:text-lg">
            Rapid Cortex bridges separate agency CAD environments in real time — so intelligence flows across
            jurisdictions as fast as the incident itself. No manual re-entry. No version conflicts. No lag.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#3A4F72]">
              Integration path
            </p>

            <div className="flex flex-col gap-1.5">
              {PHASES.map((p, i) => {
                const isActive = i === activeIndex;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    aria-pressed={isActive}
                    className="flex w-full items-start gap-3 rounded-xl p-3.5 text-left transition-colors duration-150"
                    style={{
                      background: isActive ? "rgba(20, 105, 255, 0.10)" : "transparent",
                      border: isActive ? "1px solid rgba(30, 57, 100, 0.9)" : "1px solid transparent",
                    }}
                  >
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-medium transition-colors duration-150"
                      style={{
                        background: isActive ? "#1469FF" : "#0B1220",
                        border: `1px solid ${isActive ? "#1469FF" : "#1A2940"}`,
                        color: isActive ? "#fff" : "#6A7B9D",
                      }}
                    >
                      {i + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-medium text-[#E8EEF8]">{p.name}</span>
                        {p.requiresApi ? (
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px]"
                            style={{ background: "rgba(58,79,114,.15)", color: "#6A7B9D" }}
                          >
                            Requires CAD API
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] leading-relaxed text-[#6A7B9D]">{p.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-8">
              <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#3A4F72]">
                Compatible vendors
              </p>
              <div className="flex flex-wrap gap-2">
                {CAD_VENDORS.map((name) => (
                  <span
                    key={name}
                    className="rounded px-2.5 py-1 text-xs text-[#6A7B9D]"
                    style={{ background: "#0B1220", border: "1px solid #1A2940" }}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <CadFlowDiagram phase={phase} />
            <p
              className="mt-4 text-xs leading-relaxed text-[#6A7B9D]"
              style={{ borderLeft: `2px solid ${phase.color}30`, paddingLeft: "12px" }}
            >
              {phase.description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
