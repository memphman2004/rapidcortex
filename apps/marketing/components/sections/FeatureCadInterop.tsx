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
      "RC reads each connected CAD — up to eight systems on one bridge. No write access, no operational risk. The safe first step for any pilot.",
    badge: "Read-only bridge",
    status: "ACTIVE — READ-ONLY",
    color: "#00C87A",
    bidirectional: false,
    requiresApi: false,
  },
  {
    name: "Assisted transfer",
    description:
      "One-click incident transfer across connected agencies. Dispatcher reviews and confirms before data is committed.",
    badge: "Assisted transfer",
    status: "ACTIVE — ASSISTED",
    color: "#1469FF",
    bidirectional: true,
    requiresApi: false,
  },
  {
    name: "Bidirectional sync",
    description:
      "Fully automated two-way sync across the bridge. Status updates, unit assignments, and dispositions flow in real time.",
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

const BOX = { w: 88, h: 58 };
const HUB = { x: 136, y: 100, w: 108, h: 56 };

type CadNode = {
  agency: string;
  vendor: string;
  x: number;
  y: number;
  /** Connection point on the CAD box (toward the hub). */
  from: { x: number; y: number };
  /** Connection point on the hub. */
  to: { x: number; y: number };
};

const CAD_NODES: CadNode[] = [
  {
    agency: "Agency A",
    vendor: "PremierOne",
    x: 8,
    y: 8,
    from: { x: 96, y: 37 },
    to: { x: 136, y: 118 },
  },
  {
    agency: "Agency B",
    vendor: "New World",
    x: 284,
    y: 8,
    from: { x: 284, y: 37 },
    to: { x: 244, y: 118 },
  },
  {
    agency: "Agency C",
    vendor: "CentralSquare",
    x: 8,
    y: 188,
    from: { x: 96, y: 217 },
    to: { x: 136, y: 138 },
  },
  {
    agency: "Agency D",
    vendor: "Hexagon",
    x: 284,
    y: 188,
    from: { x: 284, y: 217 },
    to: { x: 244, y: 138 },
  },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function arrowHead(from: { x: number; y: number }, to: { x: number; y: number }, size = 6): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = to.x - ux * size;
  const by = to.y - uy * size;
  const px = -uy;
  const py = ux;
  const left = `${bx + px * 3.2},${by + py * 3.2}`;
  const tip = `${to.x},${to.y}`;
  const right = `${bx - px * 3.2},${by - py * 3.2}`;
  return `${left} ${tip} ${right}`;
}

function CadBox({ node }: { node: CadNode }) {
  const { x, y, agency, vendor } = node;
  return (
    <g>
      <rect x={x} y={y} width={BOX.w} height={BOX.h} rx={6} fill="#060910" stroke="#1A2940" strokeWidth={1} />
      <rect x={x + 8} y={y + 10} width={72} height={3} rx={1.5} fill="#1A2940" />
      <rect x={x + 8} y={y + 17} width={52} height={3} rx={1.5} fill="#1A2940" />
      <rect
        x={x + 8}
        y={y + 28}
        width={72}
        height={16}
        rx={3}
        fill="rgba(20,105,255,.1)"
        stroke="rgba(20,105,255,.25)"
        strokeWidth={1}
      />
      <text x={x + BOX.w / 2} y={y + 39.5} textAnchor="middle" fill="#6A7B9D" fontSize={7} fontFamily="monospace">
        CAD LIVE
      </text>
      <text x={x + BOX.w / 2} y={y + BOX.h + 12} textAnchor="middle" fill="#E8EEF8" fontSize={8} fontWeight={500}>
        {agency}
      </text>
      <text x={x + BOX.w / 2} y={y + BOX.h + 22} textAnchor="middle" fill="#6A7B9D" fontSize={7}>
        {vendor}
      </text>
    </g>
  );
}

function CadFlowDiagram({ phase }: { phase: Phase }) {
  const rafRef = useRef<number>(0);
  const dotsRef = useRef<Array<SVGCircleElement | null>>([null, null, null, null]);
  const tRef = useRef(0);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return undefined;

    function tick() {
      tRef.current = (tRef.current + 1.6) % 100;
      const pct = tRef.current / 100;
      CAD_NODES.forEach((node, i) => {
        const el = dotsRef.current[i];
        if (!el) return;
        el.setAttribute("cx", String(lerp(node.from.x, node.to.x, pct)));
        el.setAttribute("cy", String(lerp(node.from.y, node.to.y, pct)));
      });
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
        viewBox="0 0 380 278"
        className="w-full"
        role="img"
        aria-label="CAD-to-CAD intelligence bridge connecting multiple agency CAD systems — up to eight"
      >
        <title>CAD-to-CAD intelligence bridge</title>
        <desc>
          Diagram showing incident data flowing from four agency CAD systems — PremierOne, New World,
          CentralSquare, and Hexagon — through the Rapid Cortex intelligence bridge. The platform supports
          up to eight CAD systems on one bridge.
        </desc>

        {CAD_NODES.map((node) => (
          <CadBox key={node.agency} node={node} />
        ))}

        {CAD_NODES.map((node) => (
          <g key={`${node.agency}-spoke`}>
            <line
              x1={node.from.x}
              y1={node.from.y}
              x2={node.to.x}
              y2={node.to.y}
              stroke={c}
              strokeWidth={1.5}
            />
            <polygon points={arrowHead(node.from, node.to)} fill={c} />
            {phase.bidirectional ? (
              <>
                <line
                  x1={node.to.x}
                  y1={node.to.y}
                  x2={node.from.x}
                  y2={node.from.y}
                  stroke={c}
                  strokeWidth={1}
                  strokeDasharray="3,2"
                  opacity={0.45}
                />
                <polygon points={arrowHead(node.to, node.from, 5)} fill={c} opacity={0.45} />
              </>
            ) : null}
          </g>
        ))}

        <rect
          x={HUB.x}
          y={HUB.y}
          width={HUB.w}
          height={HUB.h}
          rx={6}
          fill="#060910"
          stroke={c}
          strokeWidth={1.5}
        />
        <text x={190} y={HUB.y + 22} textAnchor="middle" fill={c} fontSize={10} fontWeight={700}>
          RAPID CORTEX
        </text>
        <text x={190} y={HUB.y + 34} textAnchor="middle" fill="#6A7B9D" fontSize={7}>
          Intelligence Bridge
        </text>
        <text x={190} y={HUB.y + 47} textAnchor="middle" fill={c} fontSize={7} fontFamily="monospace">
          {phase.status}
        </text>

        {CAD_NODES.map((node, i) => (
          <circle
            key={`${node.agency}-dot`}
            ref={(el) => {
              dotsRef.current[i] = el;
            }}
            cx={node.from.x}
            cy={node.from.y}
            r={3}
            fill={c}
          />
        ))}

        <rect x={116} y={162} width={148} height={18} rx={9} fill={cA} stroke={cB} strokeWidth={1} />
        <text x={190} y={174.5} textAnchor="middle" fill={c} fontSize={8} fontWeight={500}>
          {phase.badge}
        </text>
      </svg>
      <p className="mt-3 text-center text-[11px] text-[#6A7B9D]">
        Four of up to eight CAD systems on one Rapid Cortex bridge
      </p>
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
            jurisdictions as fast as the incident itself. One bridge supports up to eight CAD systems. No
            manual re-entry. No version conflicts. No lag.
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
