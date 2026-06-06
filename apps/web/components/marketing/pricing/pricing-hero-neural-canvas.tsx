"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";

const BG = "#0a0f1e";
const EDGE_COLOR = "rgba(56, 189, 248, 0.14)";
const NODE_CORE = "rgba(125, 211, 252, 0.95)";
const NODE_GLOW = "rgba(56, 189, 248, 0.55)";
const PULSE_CORE = "#e0f2fe";
const PULSE_RING = "rgba(56, 189, 248, 0.9)";
const MAX_EDGE_DIST = 180;
const NODE_COUNT_DESKTOP = 80;
const NODE_COUNT_MOBILE = 40;
const TARGET_PULSE_COUNT_MIN = 15;
const TARGET_PULSE_COUNT_MAX = 22;
const EPS = 1e-6;

type NodePt = { x: number; y: number };
type Edge = { a: number; b: number; len: number };
type Pulse = {
  edgeIdx: number;
  /** 0..1 along edge from a→b */
  t: number;
  /** Units per ms (normalized edge length ≈ proportion of screen) */
  speed: number;
};

function randomInRange(seed: number, min: number, max: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  const f = x - Math.floor(x);
  return min + f * (max - min);
}

function buildNodes(w: number, h: number, nodeCount: number, seedOffset: number): NodePt[] {
  const nodes: NodePt[] = [];
  const padding = Math.min(w, h) * 0.06;
  for (let i = 0; i < nodeCount; i++) {
    const seed = seedOffset + i * 7919;
    nodes.push({
      x: padding + randomInRange(seed, 0, 1) * Math.max(1, w - 2 * padding),
      y: padding + randomInRange(seed + 1, 0, 1) * Math.max(1, h - 2 * padding),
    });
  }
  return nodes;
}

function buildEdges(nodes: NodePt[], maxDist: number): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const len = Math.hypot(dx, dy);
      if (len <= maxDist && len > EPS) edges.push({ a: i, b: j, len });
    }
  }
  return edges;
}

function buildGraphAdaptive(
  w: number,
  h: number,
  nodeCount: number,
  seedOffset: number,
): { nodes: NodePt[]; edges: Edge[] } {
  const nodes = buildNodes(w, h, nodeCount, seedOffset);
  const minEdges = Math.max(24, Math.floor(nodeCount * 2.8));
  let maxDist = MAX_EDGE_DIST;
  let edges = buildEdges(nodes, maxDist);
  for (let attempt = 0; attempt < 5 && edges.length < minEdges; attempt++) {
    maxDist *= 1.2;
    edges = buildEdges(nodes, maxDist);
  }
  return { nodes, edges };
}

function pickRandomEdge(edges: Edge[], seed: number): number {
  if (edges.length === 0) return 0;
  const idx = Math.floor(randomInRange(seed, 0, 1) * edges.length);
  return Math.min(edges.length - 1, idx);
}

export type PricingHeroNeuralCanvasProps = {
  className?: string;
};

export function PricingHeroNeuralCanvas({ className = "" }: PricingHeroNeuralCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const stateRef = useRef<{
    nodes: NodePt[];
    edges: Edge[];
    pulses: Pulse[];
    nodeGlow: Float32Array;
    w: number;
    h: number;
    dpr: number;
    mobile: boolean;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const mobile = typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false;
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const nodeCount = mobile ? NODE_COUNT_MOBILE : NODE_COUNT_DESKTOP;
      const seed = Math.floor(w + h + nodeCount);
      const { nodes, edges } = buildGraphAdaptive(w, h, nodeCount, seed);
      const nodeGlow = new Float32Array(nodes.length);

      const pulseTarget = prefersReducedMotion
        ? Math.max(4, Math.floor((TARGET_PULSE_COUNT_MIN + TARGET_PULSE_COUNT_MAX) / 4))
        : TARGET_PULSE_COUNT_MIN +
          Math.floor(randomInRange(seed + 3, 0, 1) * (TARGET_PULSE_COUNT_MAX - TARGET_PULSE_COUNT_MIN + 1));

      const pulses: Pulse[] = [];
      if (edges.length > 0) {
        const edgeCount = edges.length;
        for (let i = 0; i < pulseTarget; i++) {
          const eIdx = pickRandomEdge(edges, seed + i * 17 + 401);
          const speedBase = prefersReducedMotion ? 0.00008 : randomInRange(seed + i * 31 + 701, 0.00009, 0.00026);
          pulses.push({
            edgeIdx: Math.min(eIdx, edgeCount - 1),
            t: randomInRange(seed + i * 91, 0, 0.95),
            speed: speedBase,
          });
        }
      }

      stateRef.current = { nodes, edges, pulses, nodeGlow, w, h, dpr, mobile };
    };

    const ro = new ResizeObserver(() => {
      resize();
    });
    ro.observe(parent);

    resize();

    const flashNode = (nodeIndex: number, amount: number) => {
      const s = stateRef.current;
      if (!s || nodeIndex < 0 || nodeIndex >= s.nodeGlow.length) return;
      s.nodeGlow[nodeIndex] = Math.min(1.2, s.nodeGlow[nodeIndex] + amount);
    };

    const drawFrame = (now: number) => {
      const dt = Math.min(48, Math.max(0, now - last));
      last = now;
      const s = stateRef.current;
      if (!s || s.edges.length === 0 || s.nodes.length === 0) {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        raf = requestAnimationFrame(drawFrame);
        return;
      }

      const { nodes, edges, pulses, nodeGlow } = s;
      const { dpr, w: cw, h: ch } = s;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, cw, ch);

      ctx.lineCap = "round";
      edges.forEach((e) => {
        const pa = nodes[e.a];
        const pb = nodes[e.b];
        ctx.beginPath();
        ctx.strokeStyle = EDGE_COLOR;
        ctx.lineWidth = 1;
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      });

      for (let i = 0; i < pulses.length; i++) {
        const pulse = pulses[i];
        const eIdx = pulse.edgeIdx;
        if (!edges[eIdx]) {
          pulse.edgeIdx = pickRandomEdge(edges, now + i);
          pulse.t = 0;
          continue;
        }
        const prevT = pulse.t;
        pulse.t += pulse.speed * dt;
        if (pulse.t >= 1) {
          const edge = edges[eIdx];
          flashNode(edge.a, 0.45);
          flashNode(edge.b, 0.75);
          pulse.edgeIdx = pickRandomEdge(edges, now + i * 997);
          pulse.t = 0;
          pulse.speed = prefersReducedMotion
            ? 0.00007
            : randomInRange(now + i * 133 + 511, 0.00009, 0.00028);
        } else {
          const edge = edges[eIdx];
          if (prevT < 0.06 && pulse.t >= 0.06) flashNode(edge.a, 0.15);
          if (prevT < 0.94 && pulse.t >= 0.94) flashNode(edge.b, 0.12);
        }
      }

      for (let i = 0; i < nodeGlow.length; i++) {
        nodeGlow[i] *= 0.935;
      }

      nodes.forEach((n, i) => {
        const g = Math.min(1, nodeGlow[i]);
        const r = prefersReducedMotion ? 2 : 2 + g * 1.6;
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4 + g * 6);
        grad.addColorStop(0, NODE_CORE);
        grad.addColorStop(0.4, NODE_GLOW);
        grad.addColorStop(1, "rgba(14, 116, 168, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 4.5 + g * 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = NODE_CORE;
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
      });

      pulses.forEach((pulse) => {
        const edge = edges[pulse.edgeIdx];
        if (!edge) return;
        const pa = nodes[edge.a];
        const pb = nodes[edge.b];
        const x = pa.x + (pb.x - pa.x) * pulse.t;
        const y = pa.y + (pb.y - pa.y) * pulse.t;
        const pr = prefersReducedMotion ? 2 : 3.5;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, pr * 3);
        rg.addColorStop(0, PULSE_CORE);
        rg.addColorStop(0.35, PULSE_RING);
        rg.addColorStop(1, "rgba(224,242,254,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, pr * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = PULSE_CORE;
        ctx.arc(x, y, prefersReducedMotion ? 1.4 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = requestAnimationFrame(drawFrame);
    };

    raf = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={["absolute inset-0 h-full w-full", className].filter(Boolean).join(" ")}
      aria-hidden
      role="presentation"
    />
  );
}
