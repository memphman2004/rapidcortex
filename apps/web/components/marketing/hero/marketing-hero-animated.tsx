"use client";

import Image from "next/image";
import { useEffect, useRef, type ReactNode } from "react";
import {
  SITE_HERO_LOGO_HEIGHT,
  SITE_HERO_LOGO_PATH,
  SITE_HERO_LOGO_WIDTH,
} from "@/lib/site";

// ─── Neural network canvas animation ─────────────────────────────────────────

function useNeuralCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const ctxRaw = canvas.getContext("2d");
    if (!ctxRaw) return;
    const ctx: CanvasRenderingContext2D = ctxRaw;

    let animFrameId: number;
    let W = 0;
    let H = 0;

    interface Node {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      pulsePhase: number;
      pulseSpeed: number;
      color: "blue" | "red";
    }

    interface Beam {
      fromIdx: number;
      toIdx: number;
      progress: number;
      speed: number;
      color: "blue" | "red";
      alpha: number;
      tailLength: number;
    }

    let nodes: Node[] = [];
    let edges: [number, number][] = [];
    let beams: Beam[] = [];

    const NODE_COUNT = 44;
    const CONNECT_DIST_RATIO = 0.27;
    const MAX_EDGES_PER_NODE = 4;
    const NODE_DRIFT_SPEED = 0.10;
    const BEAM_SPAWN_INTERVAL_MS = 750;
    const MAX_BEAMS = 20;

    const BLUE = { r: 56,  g: 152, b: 255 };
    const RED  = { r: 239, g: 68,  b: 68  };

    function colorRgb(c: "blue" | "red") {
      return c === "blue" ? BLUE : RED;
    }

    function buildNodes() {
      nodes = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * NODE_DRIFT_SPEED,
          vy: (Math.random() - 0.5) * NODE_DRIFT_SPEED,
          radius: 1.5 + Math.random() * 2.5,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.010 + Math.random() * 0.016,
          color: Math.random() < 0.72 ? "blue" : "red",
        });
      }
    }

    function buildEdges() {
      edges = [];
      const maxDist = Math.hypot(W, H) * CONNECT_DIST_RATIO;
      const edgeCount: number[] = new Array(NODE_COUNT).fill(0);
      for (let i = 0; i < NODE_COUNT; i++) {
        const candidates: { j: number; d: number }[] = [];
        for (let j = i + 1; j < NODE_COUNT; j++) {
          const d = Math.hypot(nodes[i]!.x - nodes[j]!.x, nodes[i]!.y - nodes[j]!.y);
          if (d < maxDist) candidates.push({ j, d });
        }
        candidates.sort((a, b) => a.d - b.d);
        for (const { j } of candidates) {
          if (edgeCount[i]! < MAX_EDGES_PER_NODE && edgeCount[j]! < MAX_EDGES_PER_NODE) {
            edges.push([i, j]);
            edgeCount[i]!++;
            edgeCount[j]!++;
          }
        }
      }
    }

    function spawnBeam() {
      if (beams.length >= MAX_BEAMS || edges.length === 0) return;
      const edge = edges[Math.floor(Math.random() * edges.length)]!;
      const fromNode = nodes[edge[0]]!;
      const color: "blue" | "red" =
        Math.random() < 0.68 ? fromNode.color : fromNode.color === "blue" ? "red" : "blue";
      beams.push({
        fromIdx: edge[0],
        toIdx: edge[1],
        progress: 0,
        speed: 0.0035 + Math.random() * 0.005,
        color,
        alpha: 0.65 + Math.random() * 0.35,
        tailLength: 0.16 + Math.random() * 0.24,
      });
    }

    function resize() {
      if (!canvas) return;
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W;
      canvas.height = H;
      buildNodes();
      buildEdges();
      beams = [];
    }

    resize();
    window.addEventListener("resize", resize);

    function drawEdges() {
      const maxDist = Math.hypot(W, H) * CONNECT_DIST_RATIO;
      for (const [i, j] of edges) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const alpha = (1 - dist / maxDist) * 0.13;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(56,152,255,${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    function drawNodes() {
      for (const node of nodes) {
        node.pulsePhase += node.pulseSpeed;
        const pulse = 0.5 + 0.5 * Math.sin(node.pulsePhase);
        const { r, g, b } = colorRgb(node.color);

        // Outer glow halo
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * (3 + pulse * 2), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${0.06 + pulse * 0.10})`;
        ctx.fill();

        // Core node
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${0.55 + pulse * 0.45})`;
        ctx.fill();
      }
    }

    function drawBeams() {
      for (let i = beams.length - 1; i >= 0; i--) {
        const beam = beams[i]!;
        beam.progress += beam.speed;

        if (beam.progress > 1 + beam.tailLength) {
          beams.splice(i, 1);
          continue;
        }

        const from = nodes[beam.fromIdx]!;
        const to   = nodes[beam.toIdx]!;
        const { r, g, b } = colorRgb(beam.color);

        const headT = Math.min(beam.progress, 1);
        const tailT = Math.max(0, beam.progress - beam.tailLength);

        const steps = 45;
        for (let s = 0; s < steps; s++) {
          const t1 = tailT + (headT - tailT) * (s / steps);
          const t2 = tailT + (headT - tailT) * ((s + 1) / steps);
          const fadePos = s / steps;
          const alpha = fadePos * beam.alpha;

          const x1 = from.x + t1 * (to.x - from.x);
          const y1 = from.y + t1 * (to.y - from.y);
          const x2 = from.x + t2 * (to.x - from.x);
          const y2 = from.y + t2 * (to.y - from.y);

          // Outer glow
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.22})`;
          ctx.lineWidth = 5;
          ctx.lineCap = "round";
          ctx.stroke();

          // Mid glow
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.55})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Core laser
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        // Bright head
        if (beam.progress <= 1) {
          const hx = from.x + headT * (to.x - from.x);
          const hy = from.y + headT * (to.y - from.y);

          // Glow bloom
          ctx.beginPath();
          ctx.arc(hx, hy, 6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${beam.alpha * 0.25})`;
          ctx.fill();

          // Bright dot
          ctx.beginPath();
          ctx.arc(hx, hy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${beam.alpha})`;
          ctx.fill();

          // White hot center
          ctx.beginPath();
          ctx.arc(hx, hy, 1, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.fill();
        }
      }
    }

    function updateNodes() {
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > W) { node.vx *= -1; node.x = Math.max(0, Math.min(W, node.x)); }
        if (node.y < 0 || node.y > H) { node.vy *= -1; node.y = Math.max(0, Math.min(H, node.y)); }
      }
    }

    let lastSpawn = 0;
    let lastEdgeRebuild = 0;
    const EDGE_REBUILD_INTERVAL = 5000;

    function animate(ts: number) {
      ctx.clearRect(0, 0, W, H);
      updateNodes();

      if (ts - lastEdgeRebuild > EDGE_REBUILD_INTERVAL) {
        buildEdges();
        lastEdgeRebuild = ts;
      }

      drawEdges();
      drawNodes();
      drawBeams();

      if (ts - lastSpawn > BEAM_SPAWN_INTERVAL_MS) {
        spawnBeam();
        lastSpawn = ts;
      }

      animFrameId = requestAnimationFrame(animate);
    }

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef]);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Marketing hero: procedural laser neural-network canvas backdrop,
 * red/blue glow accents, readability overlay, logo + children.
 */
export function MarketingHeroAnimated({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useNeuralCanvas(canvasRef);

  return (
    <div className="relative isolate flex min-h-[min(92vh,820px)] w-full flex-col overflow-hidden bg-[#020818]">

      {/* Layer 0: laser neural network canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full motion-reduce:hidden"
        style={{ zIndex: 0 }}
      />

      {/* Layer 1: red glow — left */}
      <div className="pointer-events-none absolute inset-0 z-[1] rc-hero-red-glow" aria-hidden />

      {/* Layer 1: blue glow — right */}
      <div className="pointer-events-none absolute inset-0 z-[1] rc-hero-blue-glow" aria-hidden />

      {/* Layer 2: shimmer sweep */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] overflow-hidden motion-reduce:hidden"
        aria-hidden
      >
        <div className="rc-hero-center-sweep" />
      </div>

      {/* Layer 3: readability gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          zIndex: 3,
          background: `linear-gradient(
            180deg,
            rgba(2, 8, 24, 0.30) 0%,
            rgba(2, 8, 24, 0.58) 30%,
            rgba(2, 8, 24, 0.72) 60%,
            rgba(2, 8, 24, 0.40) 100%
          )`,
        }}
      />

      {/* Layer 4: inner vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-[4] shadow-[inset_0_0_140px_rgba(0,0,0,0.45)]"
        aria-hidden
      />

      {/* Layer 10: content */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 py-10 text-center sm:px-6 sm:py-14 md:px-8 md:py-20">
        <div className="mb-8 flex justify-center md:mb-11">
          <div className="relative mx-auto max-w-[min(100%,360px)]" aria-hidden>
            <div className="absolute inset-0 scale-125 rounded-full bg-blue-500/20 blur-[4rem] motion-reduce:opacity-50" />
            <Image
              src={SITE_HERO_LOGO_PATH}
              alt=""
              width={SITE_HERO_LOGO_WIDTH}
              height={SITE_HERO_LOGO_HEIGHT}
              priority
              className="relative z-10 mx-auto h-24 max-h-[200px] w-auto object-contain object-center drop-shadow-[0_4px_24px_rgba(0,0,0,0.75)] sm:h-32 md:h-44 lg:h-52"
              sizes="(max-width:768px) 70vw, 420px"
            />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-3xl flex-col drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]">
          {children}
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-[5] h-28 bg-gradient-to-t from-[#020617] via-[#020617]/85 to-transparent"
        aria-hidden
      />

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .rc-hero-red-glow {
            background: radial-gradient(ellipse 65% 90% at 18% 48%, rgba(239, 68, 68, 0.18) 0%, rgba(239, 68, 68, 0.05) 38%, transparent 62%);
            mix-blend-mode: screen;
            animation: rc-hero-red-pulse 5.8s ease-in-out infinite;
          }
          .rc-hero-blue-glow {
            background: radial-gradient(ellipse 65% 90% at 82% 52%, rgba(59, 130, 246, 0.22) 0%, rgba(59, 130, 246, 0.06) 38%, transparent 62%);
            mix-blend-mode: screen;
            animation: rc-hero-blue-pulse 6.4s ease-in-out infinite;
            animation-delay: 0.9s;
          }
          .rc-hero-center-sweep {
            position: absolute;
            inset: -10% -30%;
            width: 55%;
            background: linear-gradient(
              105deg,
              transparent 0%,
              rgba(255,255,255,0) 38%,
              rgba(255,255,255,0.07) 50%,
              rgba(255,255,255,0) 62%,
              transparent 100%
            );
            filter: blur(1px);
            animation: rc-hero-shimmer 16s ease-in-out infinite;
            opacity: 0.65;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .rc-hero-red-glow {
            background: radial-gradient(ellipse 65% 90% at 18% 48%, rgba(239, 68, 68, 0.10) 0%, transparent 60%);
            mix-blend-mode: screen;
          }
          .rc-hero-blue-glow {
            background: radial-gradient(ellipse 65% 90% at 82% 52%, rgba(59, 130, 246, 0.10) 0%, transparent 60%);
            mix-blend-mode: screen;
          }
        }
        @keyframes rc-hero-red-pulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 0.95; }
        }
        @keyframes rc-hero-blue-pulse {
          0%, 100% { opacity: 0.45; }
          50%       { opacity: 0.9; }
        }
        @keyframes rc-hero-shimmer {
          0%        { transform: translate3d(-35%, 0, 0) skewX(-8deg); opacity: 0; }
          12%       { opacity: 0.6; }
          48%       { transform: translate3d(95%, 0, 0) skewX(-8deg); opacity: 0.45; }
          55%, 100% { transform: translate3d(120%, 0, 0) skewX(-8deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
