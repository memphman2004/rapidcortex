"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function EnterTheCortexClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasEl = canvas;
    const ctxRaw = canvasEl.getContext("2d");
    if (!ctxRaw) return;
    const ctx = ctxRaw;

    let W = 0;
    let H = 0;
    let animId: number;
    let lastRebuild = 0;

    interface Node {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      phase: number;
      speed: number;
      col: [number, number, number];
    }
    interface Signal {
      ei: [number, number, number];
      progress: number;
      speed: number;
      col: [number, number, number];
      alpha: number;
      tail: number;
      rev: boolean;
    }

    const BLUE: [number, number, number] = [59, 130, 246];
    const RED: [number, number, number] = [239, 68, 68];
    const WHITE: [number, number, number] = [255, 255, 255];

    let nodes: Node[] = [];
    let edges: [number, number, number][] = [];
    let signals: Signal[] = [];

    function rnd(a: number, b: number) {
      return a + Math.random() * (b - a);
    }

    function init() {
      W = canvasEl.width = window.innerWidth;
      H = canvasEl.height = window.innerHeight;
      nodes = [];
      for (let i = 0; i < 90; i++) {
        nodes.push({
          x: rnd(0, W),
          y: rnd(0, H),
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          r: rnd(1.4, 3.2),
          phase: rnd(0, Math.PI * 2),
          speed: rnd(0.01, 0.022),
          col: Math.random() < 0.55 ? BLUE : Math.random() < 0.6 ? RED : WHITE,
        });
      }
      rebuildEdges();
      signals = [];
      for (let i = 0; i < 18; i++) spawnSig();
    }

    function rebuildEdges() {
      edges = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i]!.x - nodes[j]!.x, nodes[i]!.y - nodes[j]!.y);
          if (d < W * 0.16) edges.push([i, j, d]);
        }
      }
    }

    function spawnSig() {
      if (!edges.length) return;
      const e = edges[Math.floor(Math.random() * edges.length)]!;
      const col = Math.random() < 0.55 ? BLUE : Math.random() < 0.55 ? RED : WHITE;
      signals.push({
        ei: e,
        progress: 0,
        speed: rnd(0.004, 0.009),
        col,
        alpha: rnd(0.55, 1),
        tail: rnd(0.2, 0.35),
        rev: Math.random() < 0.4,
      });
    }

    function draw(ts: number) {
      ctx.clearRect(0, 0, W, H);

      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55);
      g.addColorStop(0, "rgba(20,40,80,0.55)");
      g.addColorStop(0.5, "rgba(10,20,50,0.3)");
      g.addColorStop(1, "rgba(0,4,14,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      for (const [i, j, d] of edges) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const [r, gv, bv] = a.col;
        const al = (1 - d / (W * 0.16)) * 0.09;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(${r},${gv},${bv},${al})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      for (let k = signals.length - 1; k >= 0; k--) {
        const s = signals[k]!;
        s.progress += s.speed;
        if (s.progress > 1 + s.tail) {
          signals.splice(k, 1);
          spawnSig();
          continue;
        }
        const [i, j] = s.ei;
        const a = s.rev ? nodes[j]! : nodes[i]!;
        const b = s.rev ? nodes[i]! : nodes[j]!;
        const [r, gv, bv] = s.col;
        const headT = Math.min(s.progress, 1);
        const tailT = Math.max(0, s.progress - s.tail);
        const steps = 36;
        for (let st = 0; st < steps; st++) {
          const t1 = tailT + (headT - tailT) * (st / steps);
          const t2 = tailT + (headT - tailT) * ((st + 1) / steps);
          const fade = (st / steps) * s.alpha;
          const x1 = a.x + t1 * (b.x - a.x);
          const y1 = a.y + t1 * (b.y - a.y);
          const x2 = a.x + t2 * (b.x - a.x);
          const y2 = a.y + t2 * (b.y - a.y);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(${r},${gv},${bv},${fade * 0.18})`;
          ctx.lineWidth = 6;
          ctx.lineCap = "round";
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(${r},${gv},${bv},${fade * 0.5})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(${r},${gv},${bv},${fade})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
        if (s.progress <= 1) {
          const hx = a.x + headT * (b.x - a.x);
          const hy = a.y + headT * (b.y - a.y);
          ctx.beginPath();
          ctx.arc(hx, hy, 7, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${gv},${bv},${s.alpha * 0.18})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(hx, hy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${gv},${bv},${s.alpha})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(hx, hy, 0.9, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.96)";
          ctx.fill();
        }
      }

      for (const n of nodes) {
        n.phase += n.speed;
        const pulse = 0.5 + 0.5 * Math.sin(n.phase);
        const [r, gv, bv] = n.col;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * (3.5 + pulse * 2.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${gv},${bv},${0.04 + pulse * 0.06})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * (1.8 + pulse), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${gv},${bv},${0.12 + pulse * 0.15})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${gv},${bv},${0.6 + pulse * 0.4})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.55 + pulse * 0.45})`;
        ctx.fill();
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = W + 20;
        if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20;
        if (n.y > H + 20) n.y = -20;
      }

      if (ts - lastRebuild > 4000) {
        rebuildEdges();
        lastRebuild = ts;
      }
      animId = requestAnimationFrame(draw);
    }

    init();
    window.addEventListener("resize", init);
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", init);
    };
  }, []);

  function handleEnter() {
    document.cookie = "cortex_entered=1; path=/; max-age=86400; SameSite=Lax";
    const btn = document.getElementById("enter-btn");
    if (btn) {
      btn.setAttribute("disabled", "true");
      (btn as HTMLButtonElement).textContent = "ACCESSING...";
      (btn as HTMLElement).style.color = "rgba(239,68,68,0.9)";
      (btn as HTMLElement).style.borderColor = "rgba(239,68,68,0.45)";
    }
    const msgs = ["NEURAL LINK ESTABLISHED", "CORTEX ONLINE", "ROUTING..."];
    const colors = ["rgba(147,197,253,0.9)", "rgba(239,68,68,0.9)", "rgba(255,255,255,0.9)"];
    const overlay = document.getElementById("act-overlay");
    const line = document.getElementById("act-line");
    if (overlay) overlay.style.display = "flex";

    let step = 0;
    const showStep = () => {
      if (!line) return;
      line.style.color = colors[step]!;
      line.textContent = msgs[step]!;
      if (step >= msgs.length - 1) {
        setTimeout(() => router.replace("/"), 650);
        return;
      }
      step += 1;
      setTimeout(showStep, 520);
    };
    showStep();
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        background: "#00040e",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />

      <div style={{ position: "relative", zIndex: 10, textAlign: "center", padding: "2rem 1rem" }}>
        <p
          style={{
            fontSize: 10,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            color: "rgba(147,197,253,0.55)",
            marginBottom: 18,
            fontWeight: 500,
          }}
        >
          Rapid Cortex
        </p>

        <h1
          className="rc-page-title-plain"
          style={{
            fontSize: "clamp(42px,7vw,72px)",
            fontWeight: 700,
            letterSpacing: "0.01em",
            lineHeight: 1.02,
            color: "#fff",
            margin: 0,
          }}
        >
          Enter the
          <br />
          <span style={{ color: "#ef4444" }}>Cortex</span>
        </h1>

        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.18)",
            marginTop: 16,
          }}
        >
          Intelligence at the speed of response
        </p>

        <div style={{ marginTop: 42, position: "relative", display: "inline-block" }}>
          <div
            style={{
              position: "absolute",
              inset: -14,
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 3,
              animation: "rp 3s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: -28,
              border: "1px solid rgba(59,130,246,0.05)",
              borderRadius: 5,
              animation: "rp 3s ease-in-out infinite 1s",
            }}
          />

          <button
            id="enter-btn"
            type="button"
            onClick={handleEnter}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.22)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              padding: "17px 60px",
              borderRadius: 2,
              cursor: "pointer",
              position: "relative",
              fontFamily: "inherit",
              transition: "all 0.3s",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: -1,
                left: -1,
                width: 9,
                height: 9,
                borderTop: "1.5px solid #ef4444",
                borderLeft: "1.5px solid #ef4444",
              }}
            />
            <span
              style={{
                position: "absolute",
                top: -1,
                right: -1,
                width: 9,
                height: 9,
                borderTop: "1.5px solid #3b82f6",
                borderRight: "1.5px solid #3b82f6",
              }}
            />
            <span
              style={{
                position: "absolute",
                bottom: -1,
                left: -1,
                width: 9,
                height: 9,
                borderBottom: "1.5px solid #3b82f6",
                borderLeft: "1.5px solid #3b82f6",
              }}
            />
            <span
              style={{
                position: "absolute",
                bottom: -1,
                right: -1,
                width: 9,
                height: 9,
                borderBottom: "1.5px solid #ef4444",
                borderRight: "1.5px solid #ef4444",
              }}
            />
            Initialize
          </button>
        </div>
      </div>

      <div
        id="act-overlay"
        style={{
          display: "none",
          position: "absolute",
          inset: 0,
          zIndex: 30,
          background: "#00040e",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <p
          id="act-line"
          style={{
            fontSize: "clamp(15px, 2.8vw, 22px)",
            fontWeight: 600,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            fontFamily: "monospace",
            color: "rgba(147,197,253,0.9)",
            animation: "bf 0.4s ease-in-out infinite",
          }}
        >
          CORTEX INITIALIZED
        </p>
      </div>

      <style>{`
        @keyframes rp { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.2;transform:scale(1.07)} }
        @keyframes bf { 0%,100%{opacity:1} 50%{opacity:.1} }
      `}</style>
    </div>
  );
}
