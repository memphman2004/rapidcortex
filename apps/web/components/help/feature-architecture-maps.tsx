"use client";

import { useMemo, useState } from "react";
import {
  FEATURE_ARCHITECTURE_FLOWS,
  type FlowDef,
  type FlowId,
} from "@/lib/feature-architecture/flows";
import { computeVerticalDagLayout } from "@/lib/feature-architecture/dag-layout";

function kindTone(kind: FlowDef["nodes"][0]["kind"]): string {
  switch (kind) {
    case "start":
      return "bg-sky-900/50 text-sky-200 ring-sky-700/60";
    case "branch":
      return "bg-amber-900/40 text-amber-100 ring-amber-700/50";
    case "end":
      return "bg-emerald-900/40 text-emerald-100 ring-emerald-700/50";
    case "parallel":
      return "bg-slate-800 text-slate-300 ring-slate-600/50";
    default:
      return "bg-slate-800 text-slate-300 ring-slate-600/50";
  }
}

function FlowDiagram({ flow }: { flow: FlowDef }) {
  const layout = useMemo(
    () =>
      computeVerticalDagLayout({
        nodes: flow.nodes.map((n) => ({ id: n.id })),
        edges: flow.edges.map((e) => ({ from: e.from, to: e.to })),
        nodeWidth: 168,
        nodeHeight: 52,
        rankGap: 56,
        nodeGap: 28,
        padding: 16,
      }),
    [flow],
  );

  const byId = useMemo(() => new Map(flow.nodes.map((n) => [n.id, n])), [flow]);
  const edgeLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of flow.edges) {
      if (e.label) m.set(`${e.from}->${e.to}`, e.label);
    }
    return m;
  }, [flow]);

  return (
    <div
      className="relative overflow-auto rounded-lg border border-slate-800 bg-[#0a0f18]"
      style={{ width: "100%", height: Math.max(layout.height + 8, 220) }}
    >
      <svg
        width={layout.width}
        height={layout.height}
        className="absolute inset-0"
        aria-hidden
      >
        <defs>
          <marker
            id="arch-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
          </marker>
        </defs>
        {layout.edges.map((e, i) => {
          const midY = (e.sourceY + e.targetY) / 2;
          const path = `M ${e.sourceX} ${e.sourceY} C ${e.sourceX} ${midY}, ${e.targetX} ${midY}, ${e.targetX} ${e.targetY}`;
          const label = edgeLabel.get(`${e.from}->${e.to}`);
          return (
            <g key={`${e.from}-${e.to}-${i}`}>
              <path
                d={path}
                fill="none"
                stroke="#64748b"
                strokeWidth={1.5}
                opacity={0.85}
                markerEnd="url(#arch-arrow)"
              />
              {label ? (
                <text
                  x={(e.sourceX + e.targetX) / 2}
                  y={midY - 4}
                  fill="#94a3b8"
                  fontSize={10}
                  textAnchor="middle"
                >
                  {label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {layout.nodes.map((n) => {
        const def = byId.get(n.id);
        const lines = (def?.label ?? n.id).split("\n");
        return (
          <div
            key={n.id}
            className="absolute box-border flex flex-col justify-center gap-0.5 rounded-md border border-slate-700 bg-slate-900/90 px-2 py-1.5"
            style={{ left: n.x, top: n.y, width: 168, height: 52 }}
          >
            <div className="flex justify-end">
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ${kindTone(def?.kind)}`}
              >
                {def?.kind ?? "action"}
              </span>
            </div>
            {lines.map((line) => (
              <div key={line} className="text-[11px] font-medium leading-tight text-slate-100">
                {line}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function FeatureArchitectureMaps({
  compact = false,
  initialFlowId = "ca_confirm",
}: {
  compact?: boolean;
  initialFlowId?: FlowId;
}) {
  const [active, setActive] = useState<FlowId>(initialFlowId);
  const flow = FEATURE_ARCHITECTURE_FLOWS.find((f) => f.id === active) ?? FEATURE_ARCHITECTURE_FLOWS[0]!;

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {!compact ? (
        <div>
          <h2 className="text-base font-semibold text-white">Feature architecture maps</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Flowchart-style maps for major product paths. Select a feature to explore start →
            actions → branch → outcomes. Sources point at live code and docs.
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-sky-900/40 bg-sky-950/20 px-3 py-2 text-xs text-sky-100/90">
        Select a feature below. Boxes use start → actions → branch (match / no-match) → terminal
        outcomes.
      </div>

      <div className="flex flex-wrap gap-2">
        {FEATURE_ARCHITECTURE_FLOWS.map((f) => {
          const selected = active === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setActive(f.id)}
              className={`rounded-md px-2.5 py-1.5 text-xs transition ${
                selected
                  ? "bg-slate-800 text-white ring-1 ring-sky-500"
                  : "bg-slate-950/60 text-slate-300 ring-1 ring-slate-700 hover:bg-slate-900 hover:text-white"
              }`}
            >
              {f.title}
            </button>
          );
        })}
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">{flow.title}</h3>
            <p className="mt-1 text-sm text-slate-300">{flow.summary}</p>
            <p className="mt-2 font-mono text-[11px] text-slate-500">Source: {flow.source}</p>
          </div>
          <span className="rounded-md bg-sky-950/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-200 ring-1 ring-sky-800/60">
            {flow.vertical}
          </span>
        </div>
        <FlowDiagram flow={flow} />
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${kindTone("start")}`}>
            start
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${kindTone("action")}`}>
            action / parallel
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${kindTone("branch")}`}>
            branch
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${kindTone("end")}`}>
            end
          </span>
        </div>
      </section>

      {!compact ? (
        <div className="space-y-1 text-xs text-slate-500">
          <p>
            <span className="font-semibold text-slate-400">Mapped:</span> 21 flows — Call Assist,
            PSAP AI, Multilingual, QR/NFC, K-12, CAD, Media SMS, Vision, Campus events, Translate,
            Hospital, Clery DCL, EAP, Transit, Automation, Venue Guest Services, Venue QR, Pickup
            Auth, ASR, Camera registry.
          </p>
        </div>
      ) : null}
    </div>
  );
}
